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
    check('GET /attendance/top-absences', (await call(g, `/attendance/top-absences?class_id=${FAKE_UUID}`)).status, [403]);
    check('GET /classes/:id/students', (await call(g, `/classes/${FAKE_UUID}/students`)).status, [403]);
    check('GET /students (lista da escola)', (await call(g, '/students')).status, [403]);
    check('GET /staff (equipe)', (await call(g, '/staff')).status, [403]);

    console.log('RESPONSAVEL — deve conseguir ver os proprios filhos:');
    check('GET /grades/my-boletim', (await call(g, '/grades/my-boletim')).status, [200]);
    check('GET /attendance/my-children', (await call(g, '/attendance/my-children')).status, [200]);
    check('GET /invoices/mine', (await call(g, '/invoices/mine')).status, [200]);

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
    check('GET /classes/:id/students (turma inexistente)', (await call(a, `/classes/${FAKE_UUID}/students`)).status, [200, 403, 404],
      'deve vir vazio ou negado, nunca dado de outra escola');

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

    console.log('GESTOR — IDOR cross-tenant em turmas (teacher_id de outra escola):');
    const all = await call(a, '/classes');
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
