/**
 * Teste de isolamento multi-tenant e por papel.
 *
 * Roda contra um ambiente REAL e tenta cruzar dados de propósito: responsável
 * lendo turma alheia, professor lendo/escrevendo turma que não leciona, e
 * qualquer papel alcançando outra escola.
 *
 * As senhas ficam nas variáveis de ambiente da SUA máquina — nada é gravado
 * em disco nem impresso. O script só mostra status HTTP.
 *
 * Uso (PowerShell):
 *   $env:API_URL="https://backend-pi-snowy-15.vercel.app/api"
 *   $env:AUTH_URL="https://ep-red-dew-ac308bfw.neonauth.sa-east-1.aws.neon.tech/neondb/auth"
 *   $env:GUARDIAN_EMAIL="..."; $env:GUARDIAN_PASSWORD="..."
 *   $env:TEACHER_EMAIL="...";  $env:TEACHER_PASSWORD="..."
 *   $env:ADMIN_EMAIL="...";    $env:ADMIN_PASSWORD="..."
 *   node backend/scripts/test-isolation.mjs
 *
 * Papéis opcionais: se um par de variáveis faltar, os testes dele são pulados.
 */

const API = process.env.API_URL || 'https://backend-pi-snowy-15.vercel.app/api';
const AUTH = process.env.AUTH_URL;

if (!AUTH) {
  console.error('Defina AUTH_URL (URL do Neon Auth). Veja o cabeçalho deste arquivo.');
  process.exit(1);
}

/** Autentica e devolve o JWT. A senha não sai desta função. */
async function login(email, password) {
  const r = await fetch(`${AUTH}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: false }),
  });
  const jwt = r.headers.get('set-auth-jwt');
  if (!r.ok || !jwt) throw new Error(`login falhou (HTTP ${r.status})`);
  return jwt;
}

async function call(token, path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  let body = null;
  try { body = await r.json(); } catch { /* resposta sem corpo */ }
  return { status: r.status, body };
}

const results = [];
function check(name, actual, expected, detail = '') {
  const ok = expected.includes(actual);
  results.push({ ok, name, actual, expected: expected.join('/'), detail });
  console.log(`  ${ok ? 'PASSA ' : 'FALHA '} [${actual}] ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Um id que com certeza não existe: prova que a rota nega por posse, não por dado ausente. */
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

async function main() {
  const sessions = {};
  for (const role of ['GUARDIAN', 'TEACHER', 'ADMIN']) {
    const email = process.env[`${role}_EMAIL`];
    const pwd = process.env[`${role}_PASSWORD`];
    if (!email || !pwd) { console.log(`(pulando ${role}: variáveis não definidas)`); continue; }
    try {
      sessions[role] = await login(email, pwd);
      console.log(`login ${role}: ok`);
    } catch (e) {
      console.log(`login ${role}: ${e.message}`);
    }
  }
  console.log('');

  // ---------------------------------------------------------------------
  // 1. Responsável não pode ler turma nenhuma
  // ---------------------------------------------------------------------
  if (sessions.GUARDIAN) {
    console.log('RESPONSAVEL — nao pode ler dados de turma:');
    const g = sessions.GUARDIAN;
    check('GET /grades/boletim', (await call(g, `/grades/boletim?class_id=${FAKE_UUID}`)).status, [403]);
    check('GET /grades', (await call(g, `/grades?class_id=${FAKE_UUID}&subject=x&period=1`)).status, [403]);
    check('GET /attendance', (await call(g, `/attendance?class_id=${FAKE_UUID}&date=2026-01-01`)).status, [403]);
    // Atestado com aluno/turma falsos deve retornar 404 — nunca expor file_data.
    check('GET /attendance/attestation aluno alheio (guardian)', (await call(g,
      `/attendance/attestation?student_id=${FAKE_UUID}&class_id=${FAKE_UUID}&date=2026-01-01`
    )).status, [404], 'guardian sem filho nesta tupla deve receber 404 nao 200');
    check('GET /attendance/top-absences', (await call(g, `/attendance/top-absences?class_id=${FAKE_UUID}`)).status, [403]);
    check('GET /classes/:id/students', (await call(g, `/classes/${FAKE_UUID}/students`)).status, [403]);
    check('GET /students (lista da escola)', (await call(g, '/students')).status, [403]);
    check('GET /staff (equipe)', (await call(g, '/staff')).status, [403]);
    check('GET /payout (guardian)', (await call(g, '/payout')).status, [403],
      'responsavel nao pode ver dados bancarios da escola');

    console.log('RESPONSAVEL — deve conseguir ver os proprios filhos:');
    check('GET /grades/my-boletim', (await call(g, '/grades/my-boletim')).status, [200]);
    check('GET /attendance/my-children', (await call(g, '/attendance/my-children')).status, [200]);
    check('GET /invoices/mine', (await call(g, '/invoices/mine')).status, [200]);

    console.log('RESPONSAVEL — dashboard (eventos restritos as turmas dos filhos):');
    const guardianDash = await call(g, '/dashboard/stats');
    check('GET /dashboard/stats (guardian)', guardianDash.status, [200]);
    if (guardianDash.status === 200) {
      const gd = guardianDash.body?.data ?? {};
      // upcoming_events deve ser array (query pode retornar vazio, nao deve crashar).
      if (Array.isArray(gd.upcoming_events)) {
        console.log(`  PASSA  upcoming_events e array (${gd.upcoming_events.length} evento(s))`);
      } else {
        console.log('  FALHA  upcoming_events nao e array');
        results.push({ ok: false, name: 'GET /dashboard/stats upcoming_events type (guardian)', actual: typeof gd.upcoming_events, expected: 'array', detail: '' });
      }
      // Calendário publico (global): verificar que responsavel nao ve eventos de turmas alheias.
      // Estrategia: comparar com GET /calendar e verificar que todos os eventos da turma
      // presentes no dashboard tambem aparecem no calendario do proprio responsavel.
      const guardianCal = await call(g, '/calendar');
      if (guardianCal.status === 200 && Array.isArray(gd.upcoming_events)) {
        const calIds = new Set((guardianCal.body?.data ?? []).map((e) => e.id));
        const leaked = (gd.upcoming_events).filter((e) => !calIds.has(e.id));
        if (leaked.length === 0) {
          console.log('  PASSA  todos os eventos do dashboard estao dentro do escopo do calendario');
        } else {
          console.log(`  FALHA  ${leaked.length} evento(s) do dashboard nao passam pelo filtro do /calendar`);
          results.push({ ok: false, name: 'GET /dashboard/stats eventos fora do escopo (guardian)', actual: `${leaked.length} fora`, expected: 'todos dentro de /calendar', detail: '' });
        }
      }
    }

    console.log('RESPONSAVEL — autorizacao de destinatario (POST /messages):');
    // Destinatario inexistente/nao autorizado: 403 (nao 400 — nao revelar existencia).
    check('POST /messages destinatario nao autorizado (guardian → 403)', (await call(g, '/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: FAKE_UUID, subject: 'Test', body: 'Test' }),
    })).status, [403], 'guardian deve receber 403, nunca 400, para destinatario invalido');
    // Se admin disponivel: pegar profile de outro guardian e confirmar 403.
    if (sessions.ADMIN) {
      // Admin ve todos os profiles; procura um guardian diferente do atual.
      const allProfiles = await call(sessions.ADMIN, '/messages/contacts');
      const otherGuardian = (allProfiles.body?.data ?? []).find((p) => p.role === 'guardian');
      if (otherGuardian) {
        check('POST /messages guardian → outro guardian = 403', (await call(g, '/messages', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: otherGuardian.id, subject: 'Test', body: 'Test' }),
        })).status, [403], 'guardian nao pode enviar msg para outro guardian');
      }
      // Positivo: pegar um contato autorizado (professor do filho) e verificar 201.
      const guardianContacts2 = await call(g, '/messages/contacts');
      const allowedTeacher = (guardianContacts2.body?.data ?? []).find((p) => p.role === 'teacher');
      if (allowedTeacher) {
        check('POST /messages guardian → professor do filho = 201', (await call(g, '/messages', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: allowedTeacher.id, subject: 'Teste autorizado', body: 'Mensagem de teste' }),
        })).status, [201], 'guardian DEVE poder enviar mensagem ao professor do filho');
      } else {
        console.log('  (sem professor vinculado ao filho — teste positivo de guardian→teacher pulado)');
      }
    }

    console.log('RESPONSAVEL — IDOR student_id em mensagens:');
    // student_id de UUID falso: responsavel nao pode referenciar aluno alheio.
    // Deve retornar 403 (nao 400/invalid_student) para nao confirmar existencia.
    check('POST /messages student_id IDOR (guardian)', (await call(g, '/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: FAKE_UUID,
        subject: 'IDOR test',
        body: 'Teste',
        student_id: FAKE_UUID,
      }),
    })).status, [400, 403], '400 invalid_recipient ou 403 forbidden esperado (nao 200)');
    // Testa especificamente student_id sem recipient invalido: precisa de recipient valido.
    // Como nao temos recipient real aqui, apenas garantimos que student_id=FAKE retorna >= 400.

    console.log('RESPONSAVEL — contatos de mensagens (nunca lista outros responsaveis):');
    const guardianContacts = await call(g, '/messages/contacts');
    check('GET /messages/contacts (guardian)', guardianContacts.status, [200]);
    if (guardianContacts.status === 200) {
      const contacts = guardianContacts.body?.data ?? [];
      const otherGuardians = contacts.filter((c) => c.role === 'guardian');
      const hasEmail = contacts.some((c) => c.email !== undefined);
      if (otherGuardians.length === 0) {
        console.log('  PASSA  nenhum responsavel exposto nos contatos');
      } else {
        console.log(`  FALHA  ${otherGuardians.length} responsaveis vazaram nos contatos`);
        results.push({ ok: false, name: 'GET /messages/contacts guardian leak', actual: 'guardian presente', expected: 'sem guardians', detail: '' });
      }
      if (!hasEmail) {
        console.log('  PASSA  e-mail nao exposto nos contatos');
      } else {
        console.log('  FALHA  e-mail exposto nos contatos do responsavel');
        results.push({ ok: false, name: 'GET /messages/contacts email exposed (guardian)', actual: 'email presente', expected: 'sem email', detail: '' });
      }
    }
    console.log('RESPONSAVEL — tickets de suporte (apenas os proprios):');
    // Criar ticket proprio e verificar acesso.
    const gtCreate = await call(g, '/tickets', {
      method: 'POST',
      body: JSON.stringify({ title: 'Ticket teste responsavel', description: 'Teste isolamento' }),
    });
    check('POST /tickets (guardian cria)', gtCreate.status, [201], 'guardian deve poder criar ticket');
    const guardianTicketId = gtCreate.body?.data?.id ?? null;
    if (guardianTicketId) {
      check('GET /tickets/:id proprio (guardian)', (await call(g, `/tickets/${guardianTicketId}`)).status, [200],
        'guardian deve acessar o proprio ticket');
      // Ticket do proprio responsavel deve aparecer na listagem.
      const gtList = await call(g, '/tickets');
      if (gtList.status === 200) {
        const ids = (gtList.body?.data ?? []).map((t) => t.id);
        if (ids.includes(guardianTicketId)) {
          console.log('  PASSA  ticket criado aparece na listagem propria');
        } else {
          console.log('  FALHA  ticket criado nao aparece na listagem');
          results.push({ ok: false, name: 'GET /tickets guardian ticket missing', actual: 'ausente', expected: 'presente', detail: '' });
        }
        // Listagem nao deve conter tickets de outros usuarios (todos devem ser do guardian).
        const foreignTickets = (gtList.body?.data ?? []).filter((t) => t.opened_by_name && false); // nao temos opened_by no response
        // Verificar indiretamente: se professor tem ticket, guardian nao deve ve-lo.
        if (sessions.TEACHER) {
          const tCreate = await call(sessions.TEACHER, '/tickets', {
            method: 'POST',
            body: JSON.stringify({ title: 'Ticket teste professor', description: 'Teste isolamento' }),
          });
          const teacherTicketId = tCreate.body?.data?.id ?? null;
          if (teacherTicketId) {
            check('GET /tickets/:id ticket do professor (guardian)', (await call(g, `/tickets/${teacherTicketId}`)).status, [404],
              'guardian nao deve acessar ticket de outro usuario');
            check('POST /tickets/:id/comments ticket do professor (guardian)', (await call(g, `/tickets/${teacherTicketId}/comments`, {
              method: 'POST',
              body: JSON.stringify({ message: 'Tentativa de comentar' }),
            })).status, [404], 'guardian nao pode comentar ticket alheio');
            check('PATCH /tickets/:id/close ticket do professor (guardian)', (await call(g, `/tickets/${teacherTicketId}/close`, {
              method: 'PATCH',
            })).status, [403, 404], 'guardian nao pode fechar ticket alheio');
            // Listagem do guardian nao deve conter ticket do professor.
            const gtList2 = await call(g, '/tickets');
            const leaked = (gtList2.body?.data ?? []).some((t) => t.id === teacherTicketId);
            if (!leaked) {
              console.log('  PASSA  ticket do professor nao aparece na listagem do responsavel');
            } else {
              console.log('  FALHA  ticket de outro usuario vazou na listagem do responsavel');
              results.push({ ok: false, name: 'GET /tickets ticket vazou (guardian)', actual: 'presente', expected: 'ausente', detail: '' });
            }
          }
        }
      }
      // FAKE_UUID: ticket inexistente → 404.
      check('GET /tickets/:id inexistente (guardian)', (await call(g, `/tickets/${FAKE_UUID}`)).status, [404]);
      check('PATCH /tickets/:id/close inexistente (guardian)', (await call(g, `/tickets/${FAKE_UUID}/close`, { method: 'PATCH' })).status, [404]);
    }

    console.log('');
  }

  // ---------------------------------------------------------------------
  // 2. Professor só acessa turma que leciona
  // ---------------------------------------------------------------------
  if (sessions.TEACHER) {
    console.log('PROFESSOR — turmas proprias:');
    const t = sessions.TEACHER;
    const mine = await call(t, '/classes/mine');
    check('GET /classes/mine', mine.status, [200]);
    const myClass = mine.body?.data?.[0]?.id ?? null;
    if (myClass) {
      check('GET /classes/:id/students (turma dele)', (await call(t, `/classes/${myClass}/students`)).status, [200]);
      check('GET /attendance (turma dele)', (await call(t, `/attendance?class_id=${myClass}&date=2026-01-01`)).status, [200]);
    } else {
      console.log('  (professor sem turma vinculada — testes de turma propria pulados)');
    }

    console.log('PROFESSOR — GET /classes escopo restrito (nao ve escola inteira):');
    // GET /classes deve retornar o mesmo escopo de /classes/mine — nunca todas as turmas.
    const classesAll = await call(t, '/classes');
    check('GET /classes (professor)', classesAll.status, [200]);
    if (classesAll.status === 200) {
      const returned = (classesAll.body?.data ?? []).map((c) => c.id);
      const mineIds = new Set((mine.body?.data ?? []).map((c) => c.id));
      const leaked = returned.filter((id) => !mineIds.has(id));
      if (leaked.length === 0) {
        console.log('  PASSA  GET /classes retornou apenas turmas proprias do professor');
      } else {
        console.log(`  FALHA  ${leaked.length} turma(s) alheia(s) vazaram em GET /classes`);
        results.push({ ok: false, name: 'GET /classes turmas alheias (teacher)', actual: `${leaked.length} turmas extras`, expected: 'apenas proprias', detail: leaked.slice(0, 3).join(', ') });
      }
      // teacher_name de professores de outras turmas nao deve aparecer.
      if (leaked.length === 0 && sessions.ADMIN) {
        const allAdmin = await call(sessions.ADMIN, '/classes');
        const allIds = new Set((allAdmin.body?.data ?? []).map((c) => c.id));
        const notMine = [...allIds].filter((id) => !mineIds.has(id));
        if (notMine.length > 0) {
          const returnedIds = new Set(returned);
          const exposedOther = notMine.filter((id) => returnedIds.has(id));
          if (exposedOther.length === 0) {
            console.log('  PASSA  turmas de outros professores nao expostas');
          } else {
            console.log(`  FALHA  ${exposedOther.length} turma(s) de outros professores presentes`);
            results.push({ ok: false, name: 'GET /classes teacher_name de turmas alheias', actual: 'expostas', expected: 'ausentes', detail: '' });
          }
        }
      }
    }

    console.log('PROFESSOR — turma que NAO leciona:');
    // Descobre uma turma de outro professor usando o admin, se disponível.
    let otherClass = null;
    if (sessions.ADMIN) {
      const all = await call(sessions.ADMIN, '/classes');
      otherClass = (all.body?.data ?? []).map((c) => c.id).find((id) => id !== myClass) ?? null;
    }
    const target = otherClass ?? FAKE_UUID;
    const label = otherClass ? 'turma real de outro professor' : 'id inexistente (sem admin p/ achar turma real)';
    check('GET /classes/:id/students', (await call(t, `/classes/${target}/students`)).status, [403], label);
    check('GET /grades/boletim', (await call(t, `/grades/boletim?class_id=${target}`)).status, [403], label);
    check('GET /attendance', (await call(t, `/attendance?class_id=${target}&date=2026-01-01`)).status, [403], label);

    console.log('PROFESSOR — ESCRITA em turma alheia (mais grave):');
    check('POST /grades/batch', (await call(t, '/grades/batch', {
      method: 'POST',
      body: JSON.stringify({ class_id: target, subject: 'Matematica', period: '1', entries: [] }),
    })).status, [403, 400], label);
    check('POST /attendance/batch', (await call(t, '/attendance/batch', {
      method: 'POST',
      body: JSON.stringify({ class_id: target, date: '2026-01-01', entries: [] }),
    })).status, [403, 400], label);

    console.log('PROFESSOR — listagem de alunos (escopo por turma):');
    // Sem filtro: deve devolver APENAS alunos das turmas do professor (200, não escola inteira).
    const studentsAll = await call(t, '/students');
    check('GET /students (sem filtro, escopo restrito)', studentsAll.status, [200]);
    if (studentsAll.status === 200 && myClass) {
      // Todos os alunos retornados devem pertencer a turmas do professor.
      const ids = (studentsAll.body?.data ?? []).map((s) => s.class_id);
      const leaked = ids.filter((id) => id !== myClass && id !== null);
      if (leaked.length === 0) {
        console.log('  PASSA  alunos retornados pertencem apenas a turmas proprias');
      } else {
        console.log(`  FALHA  alunos de turmas alheias vazaram: ${leaked.slice(0, 3).join(', ')}`);
        results.push({ ok: false, name: 'GET /students sem filtro (leak de turma alheia)', actual: 'vazou', expected: 'escopo restrito', detail: '' });
      }
    }
    if (myClass) {
      // class_id própria → deve funcionar
      check('GET /students?class_id=propria', (await call(t, `/students?class_id=${myClass}`)).status, [200], 'turma do professor');
    }
    // class_id alheia → deve retornar 403
    check('GET /students?class_id=alheia', (await call(t, `/students?class_id=${target}`)).status, [403], label);

    console.log('PROFESSOR — dashboard escopo restrito (proprias turmas):');
    const teacherDash = await call(t, '/dashboard/stats');
    check('GET /dashboard/stats (teacher)', teacherDash.status, [200]);
    if (teacherDash.status === 200) {
      const td = teacherDash.body?.data ?? {};
      // Contagem de turmas do dashboard deve bater com /classes/mine.
      const mineCount = (mine.body?.data ?? []).length;
      if (td.classes === mineCount) {
        console.log(`  PASSA  dashboard.classes=${td.classes} bate com /classes/mine (${mineCount})`);
      } else {
        console.log(`  FALHA  dashboard.classes=${td.classes} != /classes/mine=${mineCount} — escola inteira vazou?`);
        results.push({ ok: false, name: 'GET /dashboard/stats classes count (teacher)', actual: String(td.classes), expected: String(mineCount), detail: '' });
      }
      // professor nao deve receber contagem de professores da escola (campo teachers).
      if ('teachers' in td) {
        console.log(`  FALHA  dashboard de professor expoe teachers=${td.teachers} (dado da escola inteira)`);
        results.push({ ok: false, name: 'GET /dashboard/stats teachers exposed (teacher)', actual: String(td.teachers), expected: 'campo ausente', detail: '' });
      } else {
        console.log('  PASSA  campo teachers ausente no dashboard do professor');
      }
      // Se admin disponivel, confirmar que professor nao recebe escola inteira.
      if (sessions.ADMIN) {
        const adminDash = await call(sessions.ADMIN, '/dashboard/stats');
        if (adminDash.status === 200) {
          const ad = adminDash.body?.data ?? {};
          if (ad.classes > mineCount) {
            if (td.classes <= mineCount) {
              console.log(`  PASSA  escola tem ${ad.classes} turmas, professor ve apenas ${td.classes} (subconjunto correto)`);
            } else {
              console.log(`  FALHA  professor recebeu ${td.classes} turmas mas deveria ver no maximo ${mineCount}`);
              results.push({ ok: false, name: 'GET /dashboard/stats teacher classes > mine', actual: String(td.classes), expected: `<=${mineCount}`, detail: '' });
            }
          }
          // Alunos do professor devem ser subconjunto dos da escola.
          if (ad.students >= td.students) {
            console.log(`  PASSA  dashboard.students professor (${td.students}) <= escola (${ad.students})`);
          } else {
            console.log(`  FALHA  professor reporta mais alunos (${td.students}) que a escola (${ad.students})`);
            results.push({ ok: false, name: 'GET /dashboard/stats teacher students > school', actual: String(td.students), expected: `<=${ad.students}`, detail: '' });
          }
        }
      }
    }

    console.log('PROFESSOR — jornada (somente propria, user_id externo ignorado):');
    const ownSched = await call(t, '/schedules');
    check('GET /schedules (sem filtro)', ownSched.status, [200]);
    // Mesmo passando user_id de outro perfil, deve retornar apenas dados proprios.
    const spoofSched = await call(t, `/schedules?user_id=${FAKE_UUID}`);
    check('GET /schedules?user_id=outro (ignorado)', spoofSched.status, [200]);
    if (spoofSched.status === 200) {
      // Nenhum registro com user_id = FAKE_UUID pode aparecer: o backend ignora o param para professor.
      const fakeInResult = (spoofSched.body?.data ?? []).some((s) => s.user_id === FAKE_UUID);
      if (!fakeInResult) {
        console.log('  PASSA  user_id externo nao contaminou resultado');
      } else {
        console.log('  FALHA  resultado contem registros do user_id forjado');
        results.push({ ok: false, name: 'GET /schedules spoofed user_id', actual: 'vazou', expected: 'apenas proprios dados', detail: '' });
      }
    }

    console.log('PROFESSOR — busca global (escopo restrito a turmas proprias):');
    const teacherSearch = await call(t, '/search?q=a');
    check('GET /search?q=a (professor)', teacherSearch.status, [200]);
    if (teacherSearch.status === 200) {
      const items = teacherSearch.body?.data ?? [];
      // Nenhum resultado deve ser de outra escola: verificacao implicita via school_id no backend.
      // Turmas retornadas (se houver) devem ser apenas as do professor.
      const foreignClasses = myClass
        ? items.filter((i) => i.type === 'class' && i.id !== myClass)
        : [];
      if (foreignClasses.length === 0) {
        console.log('  PASSA  busca nao retornou turmas alheias');
      } else {
        console.log(`  FALHA  turmas alheias na busca: ${foreignClasses.map((c) => c.id).slice(0, 3).join(', ')}`);
        results.push({ ok: false, name: 'GET /search turma alheia vazou', actual: 'vazou', expected: 'escopo restrito', detail: '' });
      }
    }

    console.log('PROFESSOR — atestado medico (isolamento por turma):');
    // Turma propria com student/turma falsos → 404 (atestado nao existe, mas acesso correto).
    if (myClass) {
      check('GET /attendance/attestation turma propria (teacher)', (await call(t,
        `/attendance/attestation?student_id=${FAKE_UUID}&class_id=${myClass}&date=2026-01-01`
      )).status, [404], 'turma propria: 404 esperado (sem atestado real, mas acesso ok)');
    }
    // Turma alheia → 404 (nao confirma existencia, mas acesso negado internamente).
    check('GET /attendance/attestation turma alheia (teacher)', (await call(t,
      `/attendance/attestation?student_id=${FAKE_UUID}&class_id=${target}&date=2026-01-01`
    )).status, [404], label + ' — professor nao deve acessar atestado de turma alheia');
    // Aluno de outra turma com class_id propria → 404 (student nao pertence a essa turma).
    if (myClass && otherClass) {
      const otherStu = sessions.ADMIN
        ? (await call(sessions.ADMIN, `/students?class_id=${otherClass}`)).body?.data?.[0]
        : null;
      if (otherStu) {
        check('GET /attendance/attestation aluno outra turma + class_id propria (teacher)', (await call(t,
          `/attendance/attestation?student_id=${otherStu.id}&class_id=${myClass}&date=2026-01-01`
        )).status, [404], 'student_id de outra turma: deve ser bloqueado mesmo com class_id propria');
      }
    }

    // POST /attendance/attestation — isolamento de escrita por turma.
    const FAKE_PDF = { filename: 'test.pdf', file_size: 4, file_data: 'dGVzdA==' };
    console.log('PROFESSOR — atestado medico POST (escrita isolada por turma):');
    // Turma alheia como class_id → 403 (teacherCanAccessClass falha).
    const attPostWrongClass = await call(t, '/attendance/attestation', {
      method: 'POST',
      body: JSON.stringify({ student_id: FAKE_UUID, class_id: target, date: '2026-01-01', ...FAKE_PDF }),
    });
    check('POST /attendance/attestation turma alheia (teacher)', attPostWrongClass.status, [403],
      'professor nao leciona nessa turma — deve ser 403');
    // UUID qualquer como class_id → 403 (nao e turma do professor).
    const attPostFakeClass = await call(t, '/attendance/attestation', {
      method: 'POST',
      body: JSON.stringify({ student_id: FAKE_UUID, class_id: FAKE_UUID, date: '2026-01-01', ...FAKE_PDF }),
    });
    check('POST /attendance/attestation class_id falso (teacher)', attPostFakeClass.status, [403],
      'class_id inexistente nao e do professor — deve ser 403');
    // Turma propria + aluno de outra turma → 404 (validacao atomica).
    if (myClass && otherClass && sessions.ADMIN) {
      const stOther = (await call(sessions.ADMIN, `/students?class_id=${otherClass}`)).body?.data?.[0];
      if (stOther) {
        const attPostCrossStudent = await call(t, '/attendance/attestation', {
          method: 'POST',
          body: JSON.stringify({ student_id: stOther.id, class_id: myClass, date: '2026-01-01', ...FAKE_PDF }),
        });
        check('POST /attendance/attestation aluno outra turma + class_id propria (teacher)', attPostCrossStudent.status, [404],
          'aluno nao pertence a essa turma — validacao atomica deve barrar (404)');
      }
    }

    console.log('PROFESSOR — autorizacao de destinatario (POST /messages):');
    // Destinatario inexistente/nao autorizado: 403, nunca 400.
    check('POST /messages destinatario nao autorizado (teacher → 403)', (await call(t, '/messages', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: FAKE_UUID, subject: 'Test', body: 'Test' }),
    })).status, [403], 'professor deve receber 403, nunca 400, para destinatario invalido');
    // Positivo: pegar responsavel autorizado dos proprios contatos e testar 201.
    const teacherContacts2 = await call(t, '/messages/contacts');
    const allowedGuardian = (teacherContacts2.body?.data ?? []).find((p) => p.role === 'guardian');
    if (allowedGuardian) {
      check('POST /messages teacher → responsavel do proprio aluno = 201', (await call(t, '/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: allowedGuardian.id, subject: 'Teste autorizado', body: 'Mensagem de teste' }),
      })).status, [201], 'professor DEVE poder enviar mensagem ao responsavel de aluno da propria turma');
    } else {
      console.log('  (sem responsavel vinculado a turma do professor — teste positivo de teacher→guardian pulado)');
    }
    // Negativo: guardian de turma alheia (via admin) → 403.
    if (sessions.ADMIN && otherClass) {
      const otherStudents2 = await call(sessions.ADMIN, `/students?class_id=${otherClass}`);
      const otherStu2 = otherStudents2.body?.data?.[0];
      if (otherStu2?.guardian_id) {
        // Buscar profile do guardian via admin contacts
        const adminContacts = await call(sessions.ADMIN, '/messages/contacts');
        const otherGuardianProfile = (adminContacts.body?.data ?? []).find(
          (p) => p.role === 'guardian' && !(teacherContacts2.body?.data ?? []).some((tc) => tc.id === p.id)
        );
        if (otherGuardianProfile) {
          check('POST /messages teacher → responsavel turma alheia = 403', (await call(t, '/messages', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: otherGuardianProfile.id, subject: 'IDOR', body: 'Test' }),
          })).status, [403], 'professor nao pode msg responsavel de turma que nao leciona');
        }
      }
    }

    console.log('PROFESSOR — IDOR student_id em mensagens:');
    // Professor nao pode referenciar aluno de turma alheia via student_id.
    // Com FAKE_UUID deve obter 403 (nao 400 invalid_student).
    const teacherMsgIdr = await call(t, '/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: FAKE_UUID,
        subject: 'IDOR test',
        body: 'Teste',
        student_id: FAKE_UUID,
      }),
    });
    check('POST /messages student_id IDOR (teacher)', teacherMsgIdr.status, [400, 403], '400 invalid_recipient ou 403 forbidden esperado');
    // Se admin disponivel: pega um aluno real de outra turma e confirma 403.
    if (sessions.ADMIN && otherClass) {
      const otherStudents = await call(sessions.ADMIN, `/students?class_id=${otherClass}`);
      const otherStudent = otherStudents.body?.data?.[0];
      if (otherStudent) {
        const idrRes = await call(t, '/messages', {
          method: 'POST',
          body: JSON.stringify({
            recipient_id: FAKE_UUID,
            subject: 'IDOR',
            body: 'Teste',
            student_id: otherStudent.id,
          }),
        });
        check('POST /messages student_id de turma alheia (teacher)', idrRes.status, [400, 403],
          `aluno ${otherStudent.id} nao e da turma do professor — 403 esperado`);
      }
    }

    console.log('PROFESSOR — contatos de mensagens (apenas admin + responsaveis das turmas proprias):');
    const teacherContacts = await call(t, '/messages/contacts');
    check('GET /messages/contacts (teacher)', teacherContacts.status, [200]);
    if (teacherContacts.status === 200) {
      const contacts = teacherContacts.body?.data ?? [];
      // Nenhum e-mail pode vazar.
      const hasEmail = contacts.some((c) => c.email !== undefined);
      if (!hasEmail) {
        console.log('  PASSA  e-mail nao exposto nos contatos do professor');
      } else {
        console.log('  FALHA  e-mail exposto nos contatos do professor');
        results.push({ ok: false, name: 'GET /messages/contacts email exposed (teacher)', actual: 'email presente', expected: 'sem email', detail: '' });
      }
      // Professores nao devem aparecer nos contatos de um professor
      // (o endpoint retorna apenas admin/coord + responsaveis das turmas).
      const teachersInContacts = contacts.filter((c) => c.role === 'teacher');
      if (teachersInContacts.length === 0) {
        console.log('  PASSA  nenhum professor exposto nos contatos de professor');
      } else {
        console.log(`  FALHA  ${teachersInContacts.length} professores vazaram nos contatos (esperado: apenas admin/coord/guardian)`);
        results.push({ ok: false, name: 'GET /messages/contacts teacher role in teacher contacts', actual: 'teacher presente', expected: 'sem teachers', detail: '' });
      }
    }

    console.log('PROFESSOR — nao pode ver equipe alheia:');
    check('GET /staff (listagem geral)', (await call(t, '/staff')).status, [403], 'professor nao pode listar equipe');
    check('GET /staff/:id/full (dados sensiveis)', (await call(t, `/staff/${FAKE_UUID}/full`)).status, [403]);
    check('GET /staff/me (proprios dados)', (await call(t, '/staff/me')).status, [200, 404], 'deve ver apenas os proprios dados');

    console.log('PROFESSOR — broadcast de mensagens (escopo por turma):');
    // Sem class_id → 400 (professor nao pode fazer broadcast global).
    check('POST /messages/broadcast sem class_id', (await call(t, '/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Teste', body: 'Teste broadcast' }),
    })).status, [400], 'class_id_required esperado');
    // Turma propria → permitido (200 ou 201).
    if (myClass) {
      check('POST /messages/broadcast turma propria', (await call(t, '/messages/broadcast', {
        method: 'POST',
        body: JSON.stringify({ subject: 'Aviso turma', body: 'Teste', class_id: myClass }),
      })).status, [200, 201], 'deve enviar para responsaveis da turma');
    }
    // Turma alheia → 403.
    check('POST /messages/broadcast turma alheia', (await call(t, '/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Tentativa', body: 'Teste', class_id: target }),
    })).status, [403], label);
    // UUID de turma de outra escola (FAKE) → 403.
    check('POST /messages/broadcast class_id invalido', (await call(t, '/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Tentativa', body: 'Teste', class_id: FAKE_UUID }),
    })).status, [403], 'turma inexistente deve ser 403 para professor');

    check('GET /payout (teacher)', (await call(t, '/payout')).status, [403],
      'professor nao pode ver dados bancarios da escola');

    console.log('PROFESSOR — nao pode administrar:');
    check('POST /classes (criar turma)', (await call(t, '/classes', {
      method: 'POST',
      body: JSON.stringify({ name: 'teste', year: 2026, shift: 'morning' }),
    })).status, [403]);
    check('GET /saas/schools (outras escolas)', (await call(t, '/saas/schools')).status, [403]);
    console.log('');
  }

  // ---------------------------------------------------------------------
  // 3. Gestor não alcança outra escola nem o painel da plataforma
  // ---------------------------------------------------------------------
  if (sessions.ADMIN) {
    console.log('GESTOR — limites:');
    const a = sessions.ADMIN;
    check('GET /saas/schools (painel da plataforma)', (await call(a, '/saas/schools')).status, [403]);
    check('GET /saas/dashboard', (await call(a, '/saas/dashboard')).status, [403]);
    // Atestado com UUIDs falsos → 404 (nao encontrado, acesso escola ok).
    check('GET /attendance/attestation IDs falsos (admin)', (await call(a,
      `/attendance/attestation?student_id=${FAKE_UUID}&class_id=${FAKE_UUID}&date=2026-01-01`
    )).status, [404], 'IDs inexistentes: 404 esperado');
    check('GET /classes/:id/students (turma inexistente)', (await call(a, `/classes/${FAKE_UUID}/students`)).status, [200, 403, 404],
      'deve vir vazio ou negado, nunca dado de outra escola');

    console.log('GESTOR — IDOR student_id em mensagens (admin: valida apenas escola):');
    // Admin com student_id invalido deve receber 400 invalid_student (nao 403).
    const adminMsgIdr = await call(a, '/messages', {
      method: 'POST',
      body: JSON.stringify({
        recipient_id: FAKE_UUID,
        subject: 'IDOR test',
        body: 'Teste',
        student_id: FAKE_UUID,
      }),
    });
    // 400 porque recipient_id invalido é verificado antes de student_id.
    check('POST /messages student_id IDOR (admin)', adminMsgIdr.status, [400], 'invalid_recipient esperado antes de student check');

    console.log('GESTOR — broadcast de mensagens (acesso global permitido):');
    check('POST /messages/broadcast global (sem class_id)', (await call(a, '/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Aviso geral', body: 'Teste broadcast admin' }),
    })).status, [200, 201], 'admin pode fazer broadcast global');
    check('POST /messages/broadcast turma invalida (admin)', (await call(a, '/messages/broadcast', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Teste', body: 'Teste', class_id: FAKE_UUID }),
    })).status, [400], 'invalid_class esperado');

    console.log('GESTOR — jornadas (equipe da propria escola):');
    check('GET /schedules (admin)', (await call(a, '/schedules')).status, [200]);
    check('GET /schedules?user_id=inexistente (admin, filtro valido)', (await call(a, `/schedules?user_id=${FAKE_UUID}`)).status, [200]);

    console.log('GESTOR — busca global (escola inteira, nunca outra escola):');
    const adminSearch = await call(a, '/search?q=a');
    check('GET /search?q=a (admin)', adminSearch.status, [200]);

    console.log('GESTOR — listagem de equipe (acesso completo da propria escola):');
    check('GET /staff (admin ve equipe)', (await call(a, '/staff')).status, [200]);
    check('GET /staff/me (admin ve os proprios dados)', (await call(a, '/staff/me')).status, [200, 404]);

    console.log('GESTOR — listagem de alunos (acesso completo da propria escola):');
    const adminStudents = await call(a, '/students');
    check('GET /students (gestor ve todos)', adminStudents.status, [200]);
    check('GET /students?class_id=inexistente (vazio, nao 403)', (await call(a, `/students?class_id=${FAKE_UUID}`)).status, [200]);

    console.log('GESTOR — GET /classes ve todas as turmas da propria escola:');
    const all = await call(a, '/classes');
    check('GET /classes (admin)', all.status, [200], 'gestor deve ver todas as turmas');
    if (all.status === 200 && sessions.TEACHER) {
      const adminCount = (all.body?.data ?? []).length;
      const teacherClassesAll = await call(sessions.TEACHER, '/classes');
      const teacherCount = (teacherClassesAll.body?.data ?? []).length;
      if (adminCount >= teacherCount) {
        console.log(`  PASSA  admin ve ${adminCount} turma(s), professor ve ${teacherCount} turma(s) (subconjunto correto)`);
      } else {
        console.log(`  FALHA  admin (${adminCount}) ve menos turmas que professor (${teacherCount}) — inesperado`);
        results.push({ ok: false, name: 'GET /classes admin >= teacher count', actual: `admin=${adminCount} teacher=${teacherCount}`, expected: 'admin>=teacher', detail: '' });
      }
    }

    console.log('GESTOR — IDOR cross-tenant em turmas (teacher_id de outra escola):')
    // Tenta criar turma com teacher_id que nao existe nesta escola (UUID falso).
    // Deve ser rejeitado com 400 teacher_not_found — nunca inserido silenciosamente.
    const badTeacher = await call(a, '/classes', {
      method: 'POST',
      body: JSON.stringify({ name: 'turma-idor-test', year: 2026, shift: 'morning', teacher_id: FAKE_UUID }),
    });
    check('POST /classes com teacher_id invalido', badTeacher.status, [400], 'teacher_not_found esperado');
    if (badTeacher.status === 400) {
      const code = badTeacher.body?.code;
      if (code === 'teacher_not_found') {
        console.log('  PASSA  code=teacher_not_found recebido corretamente');
      } else {
        console.log(`  FALHA  esperava code=teacher_not_found, recebeu code=${code}`);
        results.push({ ok: false, name: 'POST /classes teacher_not_found code', actual: code, expected: 'teacher_not_found', detail: '' });
      }
    }
    // PUT com teacher_id invalido tambem deve ser 400.
    if (all.body?.data?.length) {
      const firstClass = all.body.data[0];
      const badPut = await call(a, `/classes/${firstClass.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: firstClass.name, year: firstClass.year, shift: firstClass.shift, teacher_id: FAKE_UUID }),
      });
      check('PUT /classes/:id com teacher_id invalido', badPut.status, [400], 'teacher_not_found esperado');
    }

    console.log('GESTOR — IDOR cross-tenant em schedules.user_id:');
    // Tenta criar jornada para user_id que nao existe nesta escola.
    // O backend valida em profiles antes do INSERT — nunca permite school A + profileId school B.
    const badUserSched = await call(a, '/schedules', {
      method: 'POST',
      body: JSON.stringify({ user_id: FAKE_UUID, weekday: 1, start_time: '08:00', end_time: '12:00' }),
    });
    check('POST /schedules com user_id invalido', badUserSched.status, [400], 'user_not_found esperado');
    if (badUserSched.status === 400) {
      const code = badUserSched.body?.code;
      if (code === 'user_not_found') {
        console.log('  PASSA  code=user_not_found recebido corretamente');
      } else {
        console.log(`  FALHA  esperava code=user_not_found, recebeu code=${code}`);
        results.push({ ok: false, name: 'POST /schedules user_not_found code', actual: code, expected: 'user_not_found', detail: '' });
      }
    }

    console.log('GESTOR — IDOR cross-tenant em students.class_id:');
    // POST com class_id de outra escola (UUID falso) deve ser rejeitado antes de criar qualquer usuario.
    // Usamos dados minimos; o erro deve ser 400 class_not_found antes de chegar na criacao de auth.
    const badClassPost = await call(a, '/students', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Teste IDOR', cpf: '000.000.000-00', birth_date: '2010-01-01',
        father_name: 'Pai', mother_name: 'Mae',
        class_id: FAKE_UUID,
        plan_id: FAKE_UUID,
        guardian: { name: 'Resp IDOR', email: `idor-${Date.now()}@example.com`, cpf: '000.000.000-00' },
      }),
    });
    check('POST /students com class_id invalido', badClassPost.status, [400], 'class_not_found ou plan_not_found esperado');

    // PUT: tenta mover aluno para turma de outra escola.
    const firstStudent = adminStudents.body?.data?.[0];
    if (firstStudent) {
      const badClassPut = await call(a, `/students/${firstStudent.id}`, {
        method: 'PUT',
        body: JSON.stringify({ class_id: FAKE_UUID }),
      });
      check('PUT /students/:id com class_id invalido', badClassPut.status, [400], 'class_not_found esperado');
    } else {
      console.log('  (sem alunos cadastrados — teste de PUT com class_id invalido pulado)');
    }
    console.log('GESTOR — tickets de suporte (ve todos da escola):');
    const adminTickets = await call(a, '/tickets');
    check('GET /tickets (admin ve todos)', adminTickets.status, [200], 'admin deve ver todos os tickets da escola');
    if (adminTickets.status === 200 && sessions.GUARDIAN) {
      // Admin deve ver ticket criado pelo guardian no bloco anterior.
      const allIds = (adminTickets.body?.data ?? []).map((t) => t.id);
      // Criar ticket como admin e verificar acesso e fechamento.
      const adminCreate = await call(a, '/tickets', {
        method: 'POST',
        body: JSON.stringify({ title: 'Ticket do admin', description: 'Teste acesso admin' }),
      });
      const adminTicketId = adminCreate.body?.data?.id ?? null;
      if (adminTicketId) {
        check('GET /tickets/:id proprio (admin)', (await call(a, `/tickets/${adminTicketId}`)).status, [200]);
        // Admin pode fechar qualquer ticket (inclusive o do guardian).
        if (sessions.GUARDIAN) {
          const guardianTicketList = await call(sessions.GUARDIAN, '/tickets');
          const guardianTid = guardianTicketList.body?.data?.[0]?.id ?? null;
          if (guardianTid) {
            check('PATCH /tickets/:id/close ticket do guardian (admin)', (await call(a, `/tickets/${guardianTid}/close`, {
              method: 'PATCH',
            })).status, [200], 'admin deve poder fechar ticket de qualquer usuario da escola');
          }
        }
      }
    }
    // Escola A nunca acessa ticket escola B: FAKE_UUID de outra escola → 404.
    check('GET /tickets/:id escola B (admin)', (await call(a, `/tickets/${FAKE_UUID}`)).status, [404],
      'ticket de outra escola deve retornar 404 mesmo para admin');

    console.log('GESTOR — campanhas de cobrança (/charges):');
    // Admin e financial podem listar campanhas; guardian e teacher não.
    check('GET /charges (admin)', (await call(a, '/charges')).status, [200],
      'school_admin deve acessar campanhas de cobrança');
    if (sessions.FINANCIAL) {
      check('GET /charges (financial)', (await call(sessions.FINANCIAL, '/charges')).status, [200],
        'financial deve acessar campanhas de cobrança');
    }
    if (sessions.GUARDIAN) {
      check('GET /charges (guardian) → 403', (await call(sessions.GUARDIAN, '/charges')).status, [403],
        'guardian nao deve acessar campanhas administrativas');
    }
    if (sessions.TEACHER) {
      check('GET /charges (teacher) → 403', (await call(sessions.TEACHER, '/charges')).status, [403],
        'teacher nao deve acessar campanhas administrativas');
    }

    console.log('GESTOR — dados bancarios (payout com PII mascarado):');
    const payoutRes = await call(a, '/payout');
    check('GET /payout (admin)', payoutRes.status, [200], 'gestor deve ter acesso ao endpoint de payout');
    if (payoutRes.status === 200) {
      const pd = payoutRes.body?.data ?? {};
      // wallet_id e account_id nao devem mais ser retornados.
      const hasInternalIds = 'wallet_id' in pd || 'account_id' in pd;
      if (!hasInternalIds) {
        console.log('  PASSA  wallet_id e account_id nao expostos');
      } else {
        console.log('  FALHA  IDs internos do ASAAS expostos no GET /payout');
        results.push({ ok: false, name: 'GET /payout wallet_id/account_id exposed', actual: 'IDs presentes', expected: 'sem IDs internos', detail: '' });
      }
      // CPF nao pode estar em plain text — se preenchido, precisa conter •.
      const cpf = pd.onboarding?.responsible_cpf ?? '';
      if (!cpf || cpf.includes('•')) {
        console.log('  PASSA  CPF mascarado ou vazio');
      } else {
        console.log(`  FALHA  CPF em plain text exposto: ${cpf.slice(0, 4)}***`);
        results.push({ ok: false, name: 'GET /payout CPF nao mascarado', actual: 'plain text', expected: 'mascarado com •', detail: '' });
      }
    }

    console.log('');
  }

  // ---------------------------------------------------------------------
  // 4. Sem token
  // ---------------------------------------------------------------------
  console.log('SEM TOKEN:');
  for (const p of ['/students', '/grades/boletim?class_id=x', '/invoices/mine', '/saas/schools', '/recurring']) {
    const r = await fetch(`${API}${p}`);
    check(`GET ${p}`, r.status, [401]);
  }

  // ---------------------------------------------------------------------
  const falhas = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.length - falhas.length}/${results.length} passaram`);
  if (falhas.length) {
    console.log('\nFALHAS:');
    for (const f of falhas) console.log(`  - ${f.name}: recebeu ${f.actual}, esperava ${f.expected}`);
    process.exit(1);
  }
  console.log('Isolamento OK.');
}

main().catch((e) => { console.error('erro:', e.message); process.exit(1); });
