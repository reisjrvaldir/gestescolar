import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { withTenant } from '../../db/withTenant';
import { requireAuth, requireRole } from '../../middleware/auth';
import { buildDocument, formatCpf, formatCnpj, brl, type SchoolHeader } from '../../lib/pdf/documentBuilder';
import type { PoolClient } from '@neondatabase/serverless';

/**
 * Emissão de documentos oficiais (PDF) — Declaração, Ficha de Transferência,
 * Histórico Escolar e Informe de Rendimentos.
 *
 * Postura de segurança:
 *  - Gerado sob demanda, NUNCA persistido em disco/banco (menos dado sensível
 *    em repouso; ver documentBuilder.ts).
 *  - Toda emissão é uma linha em audit_logs (quem, quando, sobre quem) —
 *    mesmo que o PDF não fique salvo, o rastro fica.
 *  - Acesso: staff da própria escola (school_admin/coordinator/financial/
 *    superadmin) OU o responsável (guardian) apenas sobre o próprio filho —
 *    nunca sobre aluno de outro responsável. RLS (withTenant) cobre o
 *    isolamento entre escolas; a checagem de posse do aluno/responsável é
 *    feita em código, em cima disso (defesa em profundidade).
 *  - Rate limit dedicado (20 req/min): estes endpoints exportam dados
 *    pessoais/financeiros em lote — mais sensível a scraping que uma rota
 *    de leitura comum.
 */
export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.use(rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { code: 'rate_limit', message: 'Muitas emissões de documento. Aguarde 1 minuto.' },
}));

const STAFF_ROLES = ['school_admin', 'coordinator', 'financial', 'superadmin'];

async function getSchoolHeader(c: PoolClient, schoolId: string): Promise<SchoolHeader> {
  const { rows } = await c.query(
    `select name, legal_name, cnpj from public.schools where id = $1`,
    [schoolId],
  );
  return rows[0] ?? { name: 'Escola' };
}

async function logIssuance(
  c: PoolClient, schoolId: string, userId: string, action: string, entityId: string, metadata: object,
) {
  await c.query(
    `insert into public.audit_logs (school_id, user_id, action, entity_type, entity_id, metadata)
     values ($1,$2,$3,'document',$4,$5)`,
    [schoolId, userId, action, entityId, JSON.stringify(metadata)],
  );
}

/**
 * Resolve o aluno garantindo posse — em DUAS camadas, não uma:
 *  1) `st.school_id = ctx.schoolId` explícito na query. NÃO dá pra confiar
 *     só na RLS aqui: a 0011_force_rls está deliberadamente adiada e o role
 *     de conexão atual (neondb_owner) tem BYPASSRLS=true, ou seja, hoje a
 *     RLS não filtra nada de fato (ver withTenant.ts). Sem este filtro,
 *     qualquer staff autenticado poderia ler o aluno de OUTRA escola só
 *     sabendo o id — exatamente o vazamento que este endpoint não pode ter.
 *  2) guardian só enxerga o(s) próprio(s) filho(s) — checado em código.
 */
async function resolveStudentForAccess(
  c: PoolClient, ctx: { role: string; profileId: string; schoolId: string | null }, studentId: string,
) {
  const { rows } = await c.query(
    `select st.id, st.name, st.birth_date, st.rg, st.class_id, st.guardian_id,
            cl.name as class_name, cl.year as class_year, cl.shift as class_shift,
            g.user_id as guardian_user_id
       from public.students st
       left join public.classes cl on cl.id = st.class_id
       left join public.guardians g on g.id = st.guardian_id
      where st.id = $1 and st.school_id = $2`,
    [studentId, ctx.schoolId],
  );
  const student = rows[0];
  if (!student) return null;
  if (STAFF_ROLES.includes(ctx.role)) return student;
  if (ctx.role === 'guardian' && student.guardian_user_id === ctx.profileId) return student;
  return null; // encontrado, mas sem posse — trata como 404 pra não confirmar existência
}

// GET /api/documents/students/:id/declaration?type=matricula|conclusao
documentsRouter.get('/students/:id/declaration', async (req, res) => {
  const type = req.query.type === 'conclusao' ? 'conclusao' : 'matricula';
  try {
    const pdf = await withTenant(req.ctx!, async (c) => {
      const student = await resolveStudentForAccess(c, req.ctx!, req.params.id);
      if (!student) return null;
      const school = await getSchoolHeader(c, req.ctx!.schoolId!);

      const idade = student.birth_date
        ? `nascido(a) em ${new Date(student.birth_date).toLocaleDateString('pt-BR')}`
        : null;
      const identificacao = student.rg ? `portador(a) do RG ${student.rg}` : idade;

      const buf = await buildDocument(school, 'Declaração de Matrícula', (doc) => {
        const corpo = type === 'conclusao'
          ? `Declaramos, para os devidos fins, que o(a) aluno(a) ${student.name}` +
            (identificacao ? `, ${identificacao},` : ',') +
            ` concluiu, com aproveitamento, o ano letivo de ${student.class_year ?? '—'}` +
            ` na turma ${student.class_name ?? '—'} desta instituição de ensino.`
          : `Declaramos, para os devidos fins, que o(a) aluno(a) ${student.name}` +
            (identificacao ? `, ${identificacao},` : ',') +
            ` está regularmente matriculado(a) nesta instituição de ensino, cursando a turma` +
            ` ${student.class_name ?? '—'} (ano letivo ${student.class_year ?? '—'})` +
            (student.class_shift ? `, turno ${SHIFT_LABEL[student.class_shift] ?? student.class_shift}.` : '.');

        doc.text(corpo, { align: 'justify', lineGap: 4 });
        doc.moveDown(3);
        doc.text(`${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
          { align: 'center' });
        doc.moveDown(2);
        doc.text('_______________________________________', { align: 'center' });
        doc.text('Direção Escolar', { align: 'center' });
      });

      await logIssuance(c, req.ctx!.schoolId!, req.ctx!.profileId, 'DECLARATION_ISSUED', student.id, { type });
      return buf;
    });

    if (!pdf) return res.status(404).json({ code: 'not_found', message: 'Aluno não encontrado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err: any) {
    console.error('[documents.declaration] erro:', err?.message ?? err);
    res.status(500).json({ code: 'document_failed', message: 'Não foi possível gerar o documento.' });
  }
});

const SHIFT_LABEL: Record<string, string> = { morning: 'manhã', afternoon: 'tarde', night: 'noite', full: 'integral' };

// GET /api/documents/students/:id/transfer — Ficha de Transferência (staff).
documentsRouter.get('/students/:id/transfer', requireRole(...STAFF_ROLES), async (req, res) => {
  try {
    const pdf = await withTenant(req.ctx!, async (c) => {
      const student = await resolveStudentForAccess(c, req.ctx!, req.params.id);
      if (!student) return null;
      const school = await getSchoolHeader(c, req.ctx!.schoolId!);

      const settings = await c.query(
        `select passing_grade::float8, final_passing_grade::float8
           from public.school_grade_settings where school_id = $1`,
        [req.ctx!.schoolId],
      );
      const pg = settings.rows[0]?.passing_grade ?? 7;
      const fpg = settings.rows[0]?.final_passing_grade ?? 5;

      const grades = await c.query(
        `select sub.name as subject_name, avg(gr.grade)::float8 as media
           from public.grades gr
           join public.subjects sub on sub.id = gr.subject_id
          where gr.student_id = $1 and gr.class_id = $2 and gr.school_id = $3
          group by sub.name order by sub.name`,
        [student.id, student.class_id, req.ctx!.schoolId],
      );

      const buf = await buildDocument(school, 'Ficha de Transferência', (doc) => {
        doc.font('Helvetica-Bold').text('Aluno(a): ', { continued: true }).font('Helvetica').text(student.name);
        if (student.birth_date) {
          doc.font('Helvetica-Bold').text('Data de nascimento: ', { continued: true })
            .font('Helvetica').text(new Date(student.birth_date).toLocaleDateString('pt-BR'));
        }
        if (student.rg) doc.font('Helvetica-Bold').text('RG: ', { continued: true }).font('Helvetica').text(student.rg);
        doc.font('Helvetica-Bold').text('Turma de origem: ', { continued: true })
          .font('Helvetica').text(`${student.class_name ?? '—'} (${student.class_year ?? '—'})`);
        doc.moveDown(1.5);

        doc.font('Helvetica-Bold').fontSize(11).text('Situação acadêmica na data desta transferência');
        doc.moveDown(0.5);
        if (grades.rows.length === 0) {
          doc.font('Helvetica').fontSize(10).fillColor('#555')
            .text('Nenhuma nota lançada para esta turma até o momento.');
        } else {
          for (const g of grades.rows) {
            const media = Number(g.media);
            const situ = media >= pg ? 'Aprovado' : media >= fpg ? 'Recuperação' : 'Abaixo do mínimo';
            doc.font('Helvetica').fontSize(10)
              .text(`${g.subject_name}: média ${media.toFixed(1)} — ${situ}`);
          }
        }
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(11).fillColor('#000').text(
          `Este documento formaliza a transferência do(a) aluno(a) acima identificado(a) desta ` +
          `instituição de ensino, referente ao ano letivo de ${student.class_year ?? '—'}. ` +
          `O(A) aluno(a) está apto(a) a prosseguir seus estudos em outra instituição de ensino.`,
          { align: 'justify', lineGap: 4 },
        );
        doc.moveDown(3);
        doc.text('_______________________________________', { align: 'center' });
        doc.text('Direção Escolar', { align: 'center' });
      });

      await logIssuance(c, req.ctx!.schoolId!, req.ctx!.profileId, 'TRANSFER_FORM_ISSUED', student.id, {});
      return buf;
    });

    if (!pdf) return res.status(404).json({ code: 'not_found', message: 'Aluno não encontrado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err: any) {
    console.error('[documents.transfer] erro:', err?.message ?? err);
    res.status(500).json({ code: 'document_failed', message: 'Não foi possível gerar o documento.' });
  }
});

// GET /api/documents/students/:id/transcript — Histórico Escolar.
documentsRouter.get('/students/:id/transcript', async (req, res) => {
  try {
    const pdf = await withTenant(req.ctx!, async (c) => {
      const student = await resolveStudentForAccess(c, req.ctx!, req.params.id);
      if (!student) return null;
      const school = await getSchoolHeader(c, req.ctx!.schoolId!);

      const settings = await c.query(
        `select passing_grade::float8, final_passing_grade::float8
           from public.school_grade_settings where school_id = $1`,
        [req.ctx!.schoolId],
      );
      const pg = settings.rows[0]?.passing_grade ?? 7;
      const fpg = settings.rows[0]?.final_passing_grade ?? 5;

      // Agrupado por turma (cada turma carrega seu próprio ano letivo) — é a
      // unidade de "ano cursado" disponível no modelo de dados hoje.
      const rows = await c.query(
        `select cl.id as class_id, cl.name as class_name, cl.year as class_year,
                sub.name as subject_name, avg(gr.grade)::float8 as media
           from public.grades gr
           join public.classes cl  on cl.id = gr.class_id
           join public.subjects sub on sub.id = gr.subject_id
          where gr.student_id = $1 and gr.school_id = $2
          group by cl.id, cl.name, cl.year, sub.name
          order by cl.year desc nulls last, cl.name, sub.name`,
        [student.id, req.ctx!.schoolId],
      );

      const buf = await buildDocument(school, 'Histórico Escolar', (doc) => {
        doc.font('Helvetica-Bold').text('Aluno(a): ', { continued: true }).font('Helvetica').text(student.name);
        if (student.birth_date) {
          doc.font('Helvetica-Bold').text('Data de nascimento: ', { continued: true })
            .font('Helvetica').text(new Date(student.birth_date).toLocaleDateString('pt-BR'));
        }
        doc.moveDown(1.2);

        if (rows.rows.length === 0) {
          doc.font('Helvetica').fontSize(10).fillColor('#555')
            .text('Nenhuma nota registrada para este aluno no sistema até o momento.');
        } else {
          const byClass = new Map<string, { name: string; year: number | null; subjects: { name: string; media: number }[] }>();
          for (const r of rows.rows) {
            if (!byClass.has(r.class_id)) byClass.set(r.class_id, { name: r.class_name, year: r.class_year, subjects: [] });
            byClass.get(r.class_id)!.subjects.push({ name: r.subject_name, media: Number(r.media) });
          }
          for (const cls of byClass.values()) {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111')
              .text(`${cls.year ?? '—'} — ${cls.name}`);
            doc.moveDown(0.3);
            for (const s of cls.subjects) {
              const situ = s.media >= pg ? 'Aprovado' : s.media >= fpg ? 'Recuperação' : 'Reprovado';
              doc.font('Helvetica').fontSize(10).fillColor('#000')
                .text(`   ${s.name}: média ${s.media.toFixed(1)} — ${situ}`);
            }
            doc.moveDown(0.8);
          }
        }
      });

      await logIssuance(c, req.ctx!.schoolId!, req.ctx!.profileId, 'TRANSCRIPT_ISSUED', student.id, {});
      return buf;
    });

    if (!pdf) return res.status(404).json({ code: 'not_found', message: 'Aluno não encontrado.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf);
  } catch (err: any) {
    console.error('[documents.transcript] erro:', err?.message ?? err);
    res.status(500).json({ code: 'document_failed', message: 'Não foi possível gerar o documento.' });
  }
});

// GET /api/documents/income-report?year=YYYY&guardian_id=... (guardian_id só p/ staff)
documentsRouter.get('/income-report', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear() - 1;
  if (year < 2000 || year > 2100) return res.status(400).json({ code: 'invalid_year' });

  try {
    const pdf = await withTenant(req.ctx!, async (c): Promise<
      { error: 'guardian_required' | 'not_found' } | { data: Buffer }
    > => {
      let guardianId: string | null = null;

      if (req.ctx!.role === 'guardian') {
        const g = await c.query(
          `select id from public.guardians where user_id = $1 and school_id = $2`,
          [req.ctx!.profileId, req.ctx!.schoolId],
        );
        guardianId = g.rows[0]?.id ?? null;
      } else if (STAFF_ROLES.includes(req.ctx!.role)) {
        guardianId = typeof req.query.guardian_id === 'string' ? req.query.guardian_id : null;
      }
      if (!guardianId) return { error: 'guardian_required' as const };

      const guardian = await c.query(
        `select id, name, cpf from public.guardians where id = $1 and school_id = $2`,
        [guardianId, req.ctx!.schoolId],
      );
      if (guardian.rows.length === 0) return { error: 'not_found' as const };
      const g = guardian.rows[0];

      const school = await getSchoolHeader(c, req.ctx!.schoolId!);

      // Só mensalidade e matrícula entram no informe: são as despesas educacionais
      // dedutíveis pela Receita Federal. "Cobrança avulsa" pode ser material,
      // uniforme, evento etc. — não dedutível, e incluir por engano seria uma
      // informação fiscal incorreta na declaração do responsável.
      const payments = await c.query(
        `select paid_at, amount::float8 as amount, kind, student_name
           from public.invoices
          where guardian_id = $1 and school_id = $2 and status = 'paid'
            and kind in ('mensalidade', 'matricula')
            and paid_at >= $3::date and paid_at < $4::date
          order by paid_at asc`,
        [guardianId, req.ctx!.schoolId, `${year}-01-01`, `${year + 1}-01-01`],
      );

      const total = payments.rows.reduce((s: number, r: any) => s + Number(r.amount), 0);

      const buf = await buildDocument(school, `Informe de Rendimentos ${year}`, (doc) => {
        doc.font('Helvetica-Bold').text('Responsável: ', { continued: true }).font('Helvetica').text(g.name);
        doc.font('Helvetica-Bold').text('CPF: ', { continued: true }).font('Helvetica')
          .text(g.cpf ? formatCpf(g.cpf) : 'não cadastrado — solicite a atualização na secretaria');
        doc.font('Helvetica-Bold').text('Instituição de ensino: ', { continued: true }).font('Helvetica')
          .text(`${school.legal_name || school.name} (CNPJ ${formatCnpj(school.cnpj)})`);
        doc.moveDown(1);
        doc.font('Helvetica').fontSize(10).fillColor('#555').text(
          'Documento para uso na declaração de Imposto de Renda (ficha "Pagamentos Efetuados", ' +
          'código 01 — Instrução). Relaciona apenas mensalidade e matrícula — despesas educacionais ' +
          'dedutíveis; cobranças avulsas (material, uniforme, eventos etc.) não estão incluídas.',
          { align: 'justify', lineGap: 3 },
        );
        doc.moveDown(1.2);

        if (payments.rows.length === 0) {
          doc.font('Helvetica').fontSize(10).fillColor('#000')
            .text('Nenhum pagamento dedutível confirmado neste ano-calendário.');
        } else {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text('Data          Aluno                          Tipo            Valor');
          doc.moveTo(56, doc.y + 2).lineTo(539, doc.y + 2).strokeColor('#DDD').stroke();
          doc.moveDown(0.4);
          doc.font('Helvetica').fontSize(9.5).fillColor('#000');
          for (const p of payments.rows) {
            const data = new Date(p.paid_at).toLocaleDateString('pt-BR');
            const kind = p.kind === 'matricula' ? 'Matrícula' : 'Mensalidade';
            doc.text(`${data}     ${(p.student_name ?? '—').padEnd(28).slice(0, 28)}   ${kind.padEnd(16)}   ${brl(Number(p.amount))}`);
          }
          doc.moveDown(0.8);
          doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor('#DDD').stroke();
          doc.moveDown(0.4);
          doc.font('Helvetica-Bold').fontSize(11).text(`Total pago em ${year}: ${brl(total)}`, { align: 'right' });
        }
      });

      await logIssuance(c, req.ctx!.schoolId!, req.ctx!.profileId, 'INCOME_REPORT_ISSUED', g.id, { year, total });
      return { data: buf };
    });

    if ('error' in pdf) {
      const map = {
        guardian_required: [400, 'Informe o responsável (guardian_id).'],
        not_found: [404, 'Responsável não encontrado.'],
      } as const;
      const [status, message] = map[pdf.error];
      return res.status(status).json({ code: pdf.error, message });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdf.data);
  } catch (err: any) {
    console.error('[documents.incomeReport] erro:', err?.message ?? err);
    res.status(500).json({ code: 'document_failed', message: 'Não foi possível gerar o documento.' });
  }
});
