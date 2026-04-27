// =============================================
//  GESTESCOLAR SaaS – DATA LAYER (Supabase)
//  Fase 2.2: Cache-first + Supabase sync
// =============================================

const DB = {
  _schoolId: null,
  _ready: false,

  // Cache em memoria — leituras sao sincronas, escritas atualizam cache + Supabase
  _cache: {
    schools: [],
    users: [],
    students: [],
    classes: [],
    invoices: [],
    expenses: [],
    transactions: [],
    messages: [],
    audit_log: [],
    grades: [],
    attendance: [],
    // Dados locais (sem tabela Supabase ainda)
    documents: [],
    declarations: [],
    saas_payments: [],
  },

  // Colunas validas por tabela (para filtrar campos extras antes de enviar ao Supabase)
  _cols: {
    schools:      ['id','name','cnpj','email','phone','address','address_number','complement','province','city','state','postal_code','plan_id','billing','pix_key','logo_url','upgraded_at','created_at','updated_at','status','owner_id','custom_student_limit','commission_rate','asaas_account_id','asaas_wallet_id','asaas_sub_api_key','plan_expires_at','plan_payment_id','plan_subscription_id','school_status','trial_started_at','asaas_person_type','asaas_documents_status','asaas_documents','asaas_verification_message','asaas_documents_submitted_at'],
    users:        ['id','auth_id','school_id','name','email','username','cpf','phone','role','active','student_id','matricula','is_demo_user','created_at','updated_at'],
    students:     ['id','school_id','name','cpf','birth_date','gender','address','matricula','class_id','status','monthly_fee','due_day','responsaveis','parent_id','parent_name','parent_email','active_since','inactivated_at','access_link','login_matricula','created_at','updated_at'],
    classes:      ['id','school_id','name','year','shift','level','teacher_id','created_at'],
    invoices:     ['id','school_id','student_id','student_name','description','amount','due_date','status','paid_at','paid_amount','payment_method','asaas_id','created_at'],
    expenses:     ['id','school_id','description','tipo','category','amount','due_date','status','paid_at','parcelado','parcelas','parcela_num','created_at','parcela_grupo'],
    transactions: ['id','school_id','type','amount','description','created_at'],
    messages:     ['id','school_id','from_user_id','from_name','to_user_id','student_id','student_name','matricula','class_id','subject','text','read','read_at','sent_at'],
    audit_log:    ['id','school_id','user_id','action','details','created_at'],
    grades:       ['id','school_id','class_id','student_id','subject','grade_type','grade_value','max_value','period','teacher_id','observations','created_at'],
    attendance:   ['id','school_id','class_id','student_id','date','status','teacher_id','observations','created_at'],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONVERSORES camelCase <-> snake_case
  // ═══════════════════════════════════════════════════════════════
  _toSnake(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      r[k.replace(/[A-Z]/g, l => '_' + l.toLowerCase())] = v;
    }
    return r;
  },

  _toCamel(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const r = {};
    for (const [k, v] of Object.entries(obj)) {
      r[k.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = v;
    }
    return r;
  },

  // Filtra apenas colunas validas para a tabela Supabase
  _filterCols(table, snakeData) {
    const cols = this._cols[table];
    if (!cols) return snakeData;
    const f = {};
    for (const [k, v] of Object.entries(snakeData)) {
      if (!cols.includes(k) || v === undefined) continue;
      // String vazia → null para colunas tipadas (UUID, DATE, NUMERIC, TIMESTAMPTZ)
      f[k] = (v === '') ? null : v;
    }
    return f;
  },

  // ═══════════════════════════════════════════════════════════════
  //  OPERACOES SUPABASE (fire-and-forget)
  // ═══════════════════════════════════════════════════════════════
  // _insertRaw retorna { error } para quem precisa do código do erro
  // (ex.: retry em caso de conflito de unicidade). Não exibe toast.
  async _insertRaw(table, data) {
    if (!supabaseClient) return { error: null };
    try {
      const payload = this._filterCols(table, this._toSnake(data));
      const { error } = await supabaseClient.from(table).insert(payload);
      return { error };
    } catch (e) {
      return { error: { message: String(e) } };
    }
  },

  async _insert(table, data) {
    if (!supabaseClient) return true; // modo offline: assume sucesso
    console.log(`[DB] Insert ${table}:`, JSON.stringify(this._filterCols(table, this._toSnake(data))).substring(0, 300));
    const { error } = await this._insertRaw(table, data);
    if (error) {
      console.error(`[DB] Insert ${table} ERRO:`, error.message, '|', error.details, '|', error.hint);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`Erro ao salvar ${table}: ${error.message}`, 'error');
      }
      return false;
    }
    return true;
  },

  async _update(table, id, data) {
    if (!supabaseClient) return;
    try {
      const payload = this._filterCols(table, this._toSnake(data));
      delete payload.id;
      const { error } = await supabaseClient.from(table).update(payload).eq('id', id);
      if (error) {
        console.error(`[DB] Update ${table} ERRO:`, error.message, error.details, error.hint);
      }
    } catch (e) { console.error(`[DB] Update ${table}:`, e); }
  },

  async _remove(table, id) {
    if (!supabaseClient) return;
    try {
      const { error } = await supabaseClient.from(table).delete().eq('id', id);
      if (error) console.error(`[DB] Delete ${table}:`, error.message);
    } catch (e) { console.error(`[DB] Delete ${table}:`, e); }
  },

  // Cria usuario no Supabase Auth e retorna o auth_id (UUID)
  async _createAuthUser(email, password, name, role) {
    if (!supabaseClient) return null;
    // Pular para emails invalidos ou senhas curtas
    const validEmail = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email) && !email.endsWith('.local');
    if (!validEmail || password.length < 6) return null;
    try {
      // Salvar sessao atual para restaurar depois (evitar logout ao criar usuario)
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const currentSession = sessionData?.session;

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { name, role } },
      });

      if (error) {
        // Se usuario ja existe no Auth, tentar fazer login para pegar o ID
        if (error.message.includes('already registered')) {
          const { data: loginData } = await supabaseClient.auth.signInWithPassword({ email, password });
          if (loginData?.user) {
            // Restaurar sessao anterior
            if (currentSession) await supabaseClient.auth.setSession(currentSession);
            return loginData.user.id;
          }
        }
        console.warn(`[DB] Auth signUp falhou para ${email}:`, error.message);
        return null;
      }

      const authId = data?.user?.id || null;
      if (authId) console.log('[DB] Auth user criado no Supabase Auth');

      // Restaurar sessao anterior (signUp pode mudar a sessao)
      if (currentSession) {
        await supabaseClient.auth.setSession(currentSession);
      }

      return authId;
    } catch (e) {
      console.warn(`[DB] Erro ao criar auth user ${email}:`, e);
      return null;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  INIT — Carrega todos os dados do Supabase na cache
  // ═══════════════════════════════════════════════════════════════
  async init() {
    if (!supabaseClient) {
      console.warn('[GestEscolar] Supabase nao disponivel. Usando cache vazia.');
      this._ready = true;
      return;
    }

    console.log('[GestEscolar] Carregando dados do Supabase...');
    // audit_log carregado separadamente (lazy) — não bloqueia login
    const tables = ['schools','users','students','classes','invoices','expenses','transactions','messages','grades','attendance'];

    try {
      // Timeout de 12s: evita spinner infinito se Supabase não responder
      const _timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Supabase não respondeu em 12s')), 12000)
      );
      const results = await Promise.race([
        Promise.all(tables.map(t => {
          // asaas_sub_api_key é incluída pois o proxy SEMPRE valida o usuário antes de usá-la.
          // O cliente nunca chama o Asaas diretamente — tudo passa pelo proxy /api/asaas.
          // Sem ela no cache, o frontend não sabe se a escola está configurada e mostra o
          // formulário de entrada de chave mesmo quando a chave já está salva no Supabase.
          if (t === 'schools') {
            return supabaseClient.from(t).select(
              'id,name,cnpj,email,phone,address,address_number,complement,province,city,state,' +
              'postal_code,plan_id,billing,pix_key,logo_url,upgraded_at,created_at,updated_at,' +
              'status,owner_id,custom_student_limit,commission_rate,asaas_account_id,asaas_wallet_id,' +
              'asaas_sub_api_key,' +
              'plan_expires_at,plan_payment_id,plan_subscription_id,school_status,trial_started_at,' +
              'asaas_person_type,asaas_documents_status,asaas_documents,asaas_verification_message,' +
              'asaas_documents_submitted_at'
            );
          }
          return supabaseClient.from(t).select('*');
        })),
        _timeout,
      ]);

      tables.forEach((t, i) => {
        if (results[i].error) {
          console.error(`[DB] Erro ao carregar ${t}:`, results[i].error.message);
          this._cache[t] = [];
        } else {
          this._cache[t] = (results[i].data || []).map(row => {
            const camel = this._toCamel(row);
            // Aliases de compatibilidade para grades
            if (t === 'grades') {
              camel.unit = camel.period;
              camel.grade = camel.gradeValue;
            }
            return camel;
          });
        }
      });

      this._ready = true;
      console.log('[GestEscolar] Dados carregados com sucesso!');
      console.log(`  → ${this._cache.schools.length} escola(s), ${this._cache.users.length} usuario(s), ${this._cache.students.length} aluno(s)`);
    } catch (e) {
      console.error('[GestEscolar] Erro ao inicializar:', e.message || e);
      this._ready = true; // continua — auth.js mostrará "Conta não encontrada" em vez de spinner infinito
    }
  },

  // ═══════════════════════════════════════════════════════════════
  //  TENANT
  // ═══════════════════════════════════════════════════════════════
  setTenant(schoolId) { this._schoolId = schoolId; },

  // ═══════════════════════════════════════════════════════════════
  //  ESCOLAS (global)
  // ═══════════════════════════════════════════════════════════════
  getSchools()  { return this._cache.schools; },
  getSchool(id) { return this._cache.schools.find(s => s.id === id); },

  addSchool(s) {
    s.id        = crypto.randomUUID();
    s.createdAt = new Date().toISOString();
    s.status    = s.status || 'active';
    s.planId    = s.planId || 'free';
    // Novo plano: começa com 7 dias de teste
    s.school_status = 'trial';
    s.trial_started_at = s.createdAt;
    this._cache.schools.push(s);
    this._insert('schools', s);
    return s;
  },

  updateSchool(id, d) {
    const idx = this._cache.schools.findIndex(s => s.id === id);
    if (idx >= 0) {
      this._cache.schools[idx] = { ...this._cache.schools[idx], ...d };
      this._update('schools', id, d);
    }
  },

  removeSchool(id) {
    // Remover todos os dados vinculados a esta escola da cache
    this._cache.students   = this._cache.students.filter(s => s.schoolId !== id);
    this._cache.users      = this._cache.users.filter(u => u.schoolId !== id);
    this._cache.classes    = this._cache.classes.filter(c => c.schoolId !== id);
    this._cache.grades     = this._cache.grades.filter(g => g.schoolId !== id);
    this._cache.attendance = this._cache.attendance.filter(a => a.schoolId !== id);
    this._cache.invoices   = this._cache.invoices.filter(i => i.schoolId !== id);
    this._cache.expenses   = this._cache.expenses.filter(e => e.schoolId !== id);
    this._cache.messages   = this._cache.messages.filter(m => m.schoolId !== id);
    this._cache.schools    = this._cache.schools.filter(s => s.id !== id);
    // Supabase CASCADE cuida das FKs automaticamente
    this._remove('schools', id);
  },

  // ═══════════════════════════════════════════════════════════════
  //  SUPER ADMINS (usuarios com role=superadmin, sem school_id)
  // ═══════════════════════════════════════════════════════════════
  getSuperUsers() {
    return this._cache.users.filter(u => u.role === 'superadmin');
  },

  async addSuperUser(u) {
    u.id        = crypto.randomUUID();
    u.role      = 'superadmin';
    u.createdAt = new Date().toISOString();
    u.active    = true;
    // Criar auth user no Supabase
    if (supabaseClient && u.password) {
      u.authId = await this._createAuthUser(u.email, u.password, u.name, u.role);
    }
    delete u.password; // nunca armazenar senha em cache ou banco
    this._cache.users.push(u);
    this._insert('users', u);
    return u;
  },

  findSuperUser(email) {
    return this._cache.users.find(u => u.role === 'superadmin' && u.email === email);
  },

  // ═══════════════════════════════════════════════════════════════
  //  PAGAMENTOS SAAS (in-memory por enquanto)
  // ═══════════════════════════════════════════════════════════════
  getSaasPayments() { return this._cache.saas_payments; },
  addSaasPayment(p) {
    p.id   = crypto.randomUUID();
    p.date = new Date().toISOString();
    this._cache.saas_payments.push(p);
    return p;
  },

  // ═══════════════════════════════════════════════════════════════
  //  MATRICULA AUTOMATICA (GLOBAL entre todas as escolas)
  // ═══════════════════════════════════════════════════════════════
  //  Usa a RPC `next_matricula()` do Supabase (SECURITY DEFINER)
  //  que lê o maior número em students + users ignorando RLS —
  //  assim todas as escolas compartilham o mesmo pool sequencial.
  //
  //  Fallback: se o RPC falhar, gera com base no cache local
  //  (inseguro, mas evita bloqueio total em caso de erro de rede).
  //  A constraint UNIQUE do banco protege contra duplicatas mesmo
  //  neste cenário — o _insert vai falhar e o retry pega a próxima.
  // ═══════════════════════════════════════════════════════════════
  async nextMatricula() {
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.rpc('next_matricula');
        if (!error && data) return data;
        console.warn('[DB] next_matricula RPC falhou, usando fallback:', error?.message);
      } catch (e) {
        console.warn('[DB] next_matricula erro:', e);
      }
    }
    // Fallback: cache local
    const year = new Date().getFullYear();
    let maxSeq = 0;
    this._cache.students.forEach(s => {
      if (s.matricula && s.matricula.startsWith(String(year))) {
        const seq = parseInt(s.matricula.substring(4));
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    this._cache.users.forEach(u => {
      if (u.matricula && u.matricula.startsWith(String(year))) {
        const seq = parseInt(u.matricula.substring(4));
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    return `${year}${String(maxSeq + 1).padStart(6, '0')}`;
  },

  // ═══════════════════════════════════════════════════════════════
  //  USUARIOS (por escola)
  // ═══════════════════════════════════════════════════════════════
  getUsers() {
    return this._cache.users.filter(u => u.schoolId === this._schoolId);
  },

  saveUsers(arr) {
    // Substitui usuarios da escola atual na cache (usado internamente)
    this._cache.users = this._cache.users.filter(u => u.schoolId !== this._schoolId).concat(arr);
  },

  async addUser(u) {
    u.id        = crypto.randomUUID();
    u.createdAt = new Date().toISOString();
    u.schoolId  = this._schoolId;
    // Criar auth user no Supabase
    if (supabaseClient && u.password && u.email) {
      u.authId = await this._createAuthUser(u.email, u.password, u.name, u.role);
    }
    delete u.password; // nunca armazenar senha em cache ou banco
    // INSERT primeiro, cache depois (confirm-before-cache)
    const ok = await this._insert('users', u);
    if (!ok) return null;
    this._cache.users.push(u);
    return u;
  },

  findUserByEmail(e) {
    return this.getUsers().find(u => u.email === e);
  },

  updateUser(id, d) {
    const idx = this._cache.users.findIndex(u => u.id === id);
    if (idx >= 0) {
      this._cache.users[idx] = { ...this._cache.users[idx], ...d };
      this._update('users', id, d);
    }
  },

  deleteUser(id) {
    this._cache.users = this._cache.users.filter(u => u.id !== id);
    this._remove('users', id);
  },

  // ═══════════════════════════════════════════════════════════════
  //  ALUNOS
  // ═══════════════════════════════════════════════════════════════
  getStudents() {
    return this._cache.students.filter(s => s.schoolId === this._schoolId);
  },

  async addStudent(s) {
    s.id          = crypto.randomUUID();
    s.createdAt   = new Date().toISOString();
    s.activeSince = s.status === 'ativo' ? new Date().toISOString() : null;
    s.schoolId    = this._schoolId;
    if (!Array.isArray(s.responsaveis)) s.responsaveis = [];

    // Retry até 5x em caso de matrícula duplicada (race condition entre escolas).
    // A constraint UNIQUE do banco é a garantia final — o RPC gera o número, e
    // se por alguma razão duas escolas pegarem o mesmo (timing exato), o segundo
    // INSERT vai falhar com código 23505 e aqui regeramos.
    let lastError = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      s.matricula = await this.nextMatricula();
      const { error } = await this._insertRaw('students', s);
      if (!error) { lastError = null; break; }
      lastError = error;
      const isUnique = error.code === '23505' || (error.message || '').toLowerCase().includes('matricula');
      if (!isUnique) break; // outro erro → aborta
      console.warn(`[DB] Matrícula ${s.matricula} já existe, regenerando (tentativa ${attempt}/5)`);
      await new Promise(r => setTimeout(r, 60 * attempt));
    }
    if (lastError) {
      console.error('[DB] addStudent ERRO:', lastError);
      if (typeof Utils !== 'undefined' && Utils.toast) {
        Utils.toast(`Erro ao salvar aluno: ${lastError.message || 'desconhecido'}`, 'error');
      }
      return null;
    }

    this._cache.students.push(s);

    // Criar conta do responsavel automaticamente e vincular parentId
    if (s.responsaveis.length > 0) {
      const resp = s.responsaveis[0];
      const respEmailRaw = (resp.email || '').trim().toLowerCase();
      // Senha: 6 primeiros digitos do CPF do responsavel, depois aluno,
      // e como ultimo recurso usa a propria matricula (garante login sempre criado)
      const cpfResp  = (resp.cpf || '').replace(/\D/g, '');
      const cpfAluno = (s.cpf || '').replace(/\D/g, '');
      let senha;
      let senhaOrigem;
      if (cpfResp.length >= 6)       { senha = cpfResp.substring(0,6);  senhaOrigem = 'cpf-responsavel'; }
      else if (cpfAluno.length >= 6) { senha = cpfAluno.substring(0,6); senhaOrigem = 'cpf-aluno'; }
      else                           { senha = String(s.matricula).slice(-6); senhaOrigem = 'matricula'; }

      // Sempre usa placeholder baseado na matrícula para garantir login
      // por matrícula + CPF sem conflito com contas Google/OAuth.
      // O email real do responsável é salvo em parentEmail do aluno.
      const emailFinal = `${s.matricula}@gestescolar.app`;
      s.parentLoginPasswordOrigin = senhaOrigem;

      if (!this.getUsers().find(u => u.studentId === s.id && u.role === 'pai')) {
        const parentUser = await this.addUser({
          name:      resp.nome || 'Responsavel',
          email:     emailFinal,
          username:  s.matricula,
          password:  senha,
          role:      'pai',
          studentId: s.id,
          matricula: s.matricula,
          phone:     resp.telefone || '',
          cpf:       resp.cpf || '',
          active:    true,
        });
        if (parentUser && parentUser.id) {
          this.updateStudent(s.id, {
            parentId:    parentUser.id,
            parentName:  parentUser.name,
            parentEmail: parentUser.email
          });
          s.parentId    = parentUser.id;
          s.parentName  = parentUser.name;
          s.parentEmail = parentUser.email;
        }
      }
    }
    return s;
  },

  updateStudent(id, d) {
    const idx = this._cache.students.findIndex(s => s.id === id);
    if (idx >= 0) {
      const s = this._cache.students[idx];
      const updated = { ...s, ...d };
      if (d.status === 'ativo' && s.status !== 'ativo') updated.activeSince = new Date().toISOString();
      if (d.status === 'inativo' && s.status !== 'inativo') updated.inactivatedAt = new Date().toISOString();
      this._cache.students[idx] = updated;
      this._update('students', id, d);
    }
  },

  removeStudent(id) {
    // Remover da cache (cascata manual)
    this._cache.students   = this._cache.students.filter(s => s.id !== id);
    this._cache.grades     = this._cache.grades.filter(g => g.studentId !== id);
    this._cache.attendance = this._cache.attendance.filter(a => a.studentId !== id);
    this._cache.invoices   = this._cache.invoices.filter(i => i.studentId !== id);
    this._cache.users      = this._cache.users.filter(u => u.studentId !== id);
    // Supabase CASCADE cuida das FKs automaticamente
    this._remove('students', id);
  },

  fixMissingParentIds() {
    const schools = this.getSchools();
    schools.forEach(school => {
      this.setTenant(school.id);
      const students = this.getStudents();
      const users    = this.getUsers();
      let fixed = 0;
      students.forEach(s => {
        if (s.parentId) return;
        const parentUser = users.find(u => u.role === 'pai' && u.studentId === s.id);
        if (parentUser) {
          this.updateStudent(s.id, {
            parentId:    parentUser.id,
            parentName:  parentUser.name,
            parentEmail: parentUser.email
          });
          fixed++;
        }
      });
      if (fixed > 0) console.log(`[GestEscolar] Escola ${school.id}: ${fixed} aluno(s) vinculados.`);
    });
    const cur = typeof Auth !== 'undefined' ? Auth.current?.() : null;
    if (cur && cur.schoolId) this.setTenant(cur.schoolId);
    else this.setTenant(null);
  },

  // ═══════════════════════════════════════════════════════════════
  //  TURMAS
  // ═══════════════════════════════════════════════════════════════
  getClasses() {
    return this._cache.classes.filter(c => c.schoolId === this._schoolId);
  },

  addClass(c) {
    c.id        = crypto.randomUUID();
    c.schoolId  = this._schoolId;
    c.createdAt = new Date().toISOString();
    this._cache.classes.push(c);
    this._insert('classes', c);
    return c;
  },

  updateClass(id, d) {
    const idx = this._cache.classes.findIndex(c => c.id === id);
    if (idx >= 0) {
      const c = this._cache.classes[idx];
      const updated = { ...c, ...d };
      this._cache.classes[idx] = updated;
      this._update('classes', id, d);
    }
  },

  removeClass(id) {
    this._cache.classes = this._cache.classes.filter(c => c.id !== id);
    this._remove('classes', id);
  },

  // ═══════════════════════════════════════════════════════════════
  //  PRESENCAS / CHAMADA
  // ═══════════════════════════════════════════════════════════════
  getAttendance() {
    return this._cache.attendance.filter(a => a.schoolId === this._schoolId);
  },

  markAttendance(studentId, date, status, teacherId) {
    const idx = this._cache.attendance.findIndex(a => a.studentId === studentId && a.date === date);
    const student = this._cache.students.find(s => s.id === studentId);
    const rec = {
      studentId, date, status, teacherId,
      schoolId: this._schoolId,
      classId:  student?.classId || null,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      rec.id = this._cache.attendance[idx].id;
      this._cache.attendance[idx] = { ...this._cache.attendance[idx], ...rec };
      this._update('attendance', rec.id, rec);
    } else {
      rec.id        = crypto.randomUUID();
      rec.createdAt = new Date().toISOString();
      this._cache.attendance.push(rec);
      this._insert('attendance', rec);
    }
  },

  saveAttendanceBatch(records) {
    records.forEach(rec => {
      this.markAttendance(rec.studentId, rec.date, rec.status, rec.teacherId);
    });
  },

  getStudentAttendance(sid) {
    return this._cache.attendance.filter(a => a.studentId === sid);
  },

  // ═══════════════════════════════════════════════════════════════
  //  NOTAS / AVALIACOES
  // ═══════════════════════════════════════════════════════════════
  getGrades() {
    return this._cache.grades.filter(g => g.schoolId === this._schoolId);
  },

  setGrade(studentId, subject, unit, grade, teacherId) {
    const idx = this._cache.grades.findIndex(g =>
      g.studentId === studentId && g.subject === subject && (g.unit === unit || g.period === unit)
    );
    const student = this._cache.students.find(s => s.id === studentId);
    const rec = {
      studentId, subject,
      period: unit, unit: unit,           // DB usa period, JS usa unit
      gradeValue: grade, grade: grade,    // DB usa grade_value, JS usa grade
      teacherId,
      schoolId: this._schoolId,
      classId:  student?.classId || null,
    };

    if (idx >= 0) {
      rec.id = this._cache.grades[idx].id;
      this._cache.grades[idx] = { ...this._cache.grades[idx], ...rec };
      this._update('grades', rec.id, { period: unit, gradeValue: grade, teacherId });
    } else {
      rec.id        = crypto.randomUUID();
      rec.createdAt = new Date().toISOString();
      this._cache.grades.push(rec);
      this._insert('grades', rec);
    }
  },

  getStudentGrades(sid) {
    return this._cache.grades.filter(g => g.studentId === sid);
  },

  // ═══════════════════════════════════════════════════════════════
  //  FATURAS / COBRANCAS
  // ═══════════════════════════════════════════════════════════════
  getInvoices() {
    return this._cache.invoices.filter(i => i.schoolId === this._schoolId);
  },

  addInvoice(inv) {
    inv.id        = crypto.randomUUID();
    inv.createdAt = new Date().toISOString();
    inv.status    = inv.status || 'pendente';
    inv.schoolId  = this._schoolId;
    this._cache.invoices.push(inv);
    this._insert('invoices', inv);
    return inv;
  },

  updateInvoice(id, d) {
    const idx = this._cache.invoices.findIndex(i => i.id === id);
    if (idx >= 0) {
      this._cache.invoices[idx] = { ...this._cache.invoices[idx], ...d };
      this._update('invoices', id, d);
    }
  },

  // Recarrega invoices + transactions do Supabase (usado após pagamento PIX para
  // pegar confirmações que vieram pelo webhook do Asaas).
  async refreshInvoices() {
    if (!supabaseClient) return false;
    try {
      const [invRes, txRes] = await Promise.all([
        supabaseClient.from('invoices').select('*'),
        supabaseClient.from('transactions').select('*'),
      ]);
      if (!invRes.error) {
        this._cache.invoices = (invRes.data || []).map(row => this._toCamel(row));
      }
      if (!txRes.error) {
        this._cache.transactions = (txRes.data || []).map(row => this._toCamel(row));
      }
      return true;
    } catch (e) {
      console.error('[DB] refreshInvoices erro:', e);
      return false;
    }
  },

  getStudentInvoices(sid) {
    return this._cache.invoices.filter(i => i.studentId === sid);
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONTAS A PAGAR / DESPESAS
  // ═══════════════════════════════════════════════════════════════
  getExpenses() {
    return this._cache.expenses.filter(e => e.schoolId === this._schoolId);
  },

  addExpense(e) {
    e.id        = crypto.randomUUID();
    e.createdAt = new Date().toISOString();
    e.status    = 'pendente';
    e.schoolId  = this._schoolId;
    this._cache.expenses.push(e);
    this._insert('expenses', e);

    // Criar parcelas adicionais
    if (e.parcelado && e.parcelas > 1) {
      const baseDate = new Date(e.dueDate);
      for (let i = 1; i < e.parcelas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const parcela = {
          ...e,
          id:           crypto.randomUUID(),
          dueDate:      d.toISOString().split('T')[0],
          parcelaNum:   i + 1,
          parcelaGrupo: e.id,
          status:       'pendente',
          createdAt:    new Date().toISOString(),
        };
        this._cache.expenses.push(parcela);
        this._insert('expenses', parcela);
      }
    }
    return e;
  },

  updateExpense(id, d) {
    const idx = this._cache.expenses.findIndex(e => e.id === id);
    if (idx >= 0) {
      this._cache.expenses[idx] = { ...this._cache.expenses[idx], ...d };
      this._update('expenses', id, d);
    }
  },

  deleteExpense(id) {
    this._cache.expenses = this._cache.expenses.filter(e => e.id !== id);
    this._remove('expenses', id);
  },

  // ═══════════════════════════════════════════════════════════════
  //  SALDO / TRANSACOES
  // ═══════════════════════════════════════════════════════════════
  getBalance() {
    const txns = this._cache.transactions
      .filter(t => t.schoolId === this._schoolId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let amount = 0;
    txns.forEach(t => {
      amount += t.type === 'credit' ? t.amount : -t.amount;
    });

    return {
      amount,
      transactions: txns.map(t => ({
        id:          t.id,
        type:        t.type,
        amount:      t.amount,
        netAmount:   t.type === 'credit' ? t.amount : -t.amount,
        description: t.description,
        date:        t.createdAt,
      }))
    };
  },

  addTransaction(type, amount, description) {
    const txn = {
      id:          crypto.randomUUID(),
      type, amount, description,
      schoolId:    this._schoolId,
      createdAt:   new Date().toISOString(),
    };
    this._cache.transactions.push(txn);
    this._insert('transactions', txn);
    return this.getBalance();
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIGURACOES DA ESCOLA
  // ═══════════════════════════════════════════════════════════════
  getSchoolConfig() {
    const school = this.getSchool(this._schoolId);
    if (!school) return { name: '', logo: '', address: '', phone: '', cnpj: '', pixKey: '', finePercent: 2.0, interestDayPercent: 0.033 };
    return {
      name:               school.name || '',
      logo:               school.logoUrl || '',
      address:            school.address || '',
      phone:              school.phone || '',
      cnpj:               school.cnpj || '',
      pixKey:             school.pixKey || '',
      finePercent:        school.finePercent ?? 2.0,
      interestDayPercent: school.interestDayPercent ?? 0.033,
    };
  },

  saveSchoolConfig(cfg) {
    const data = {
      name:    cfg.name,
      logoUrl: cfg.logo,
      address: cfg.address,
      phone:   cfg.phone,
      cnpj:    cfg.cnpj,
    };
    if (cfg.pixKey !== undefined) data.pixKey = cfg.pixKey;
    if (cfg.finePercent !== undefined) data.finePercent = cfg.finePercent;
    if (cfg.interestDayPercent !== undefined) data.interestDayPercent = cfg.interestDayPercent;
    this.updateSchool(this._schoolId, data);
  },

  // ═══════════════════════════════════════════════════════════════
  //  MENSAGENS
  // ═══════════════════════════════════════════════════════════════
  getMessages() {
    return this._cache.messages.filter(m => m.schoolId === this._schoolId);
  },

  addMessage(m) {
    m.id       = crypto.randomUUID();
    m.sentAt   = new Date().toISOString();
    m.read     = false;
    m.schoolId = this._schoolId;
    this._cache.messages.push(m);
    this._insert('messages', m);
    return m;
  },

  markMessageRead(id) {
    const idx = this._cache.messages.findIndex(m => m.id === id);
    if (idx >= 0) {
      this._cache.messages[idx].read   = true;
      this._cache.messages[idx].readAt = new Date().toISOString();
      this._update('messages', id, { read: true, readAt: new Date().toISOString() });
    }
  },

  getMessagesForUser(uid) {
    return this.getMessages().filter(m => m.toUserId === uid);
  },

  // ═══════════════════════════════════════════════════════════════
  //  DOCUMENTOS (cache local, sem Supabase por enquanto)
  // ═══════════════════════════════════════════════════════════════
  getDocuments() { return this._cache.documents; },
  addDocument(doc) {
    doc.id = crypto.randomUUID();
    doc.createdAt = new Date().toISOString();
    this._cache.documents.push(doc);
    return doc;
  },
  deleteDocument(id) {
    this._cache.documents = this._cache.documents.filter(d => d.id !== id);
  },

  // ═══════════════════════════════════════════════════════════════
  //  DECLARACOES (cache local, sem Supabase por enquanto)
  // ═══════════════════════════════════════════════════════════════
  getDeclarations() { return this._cache.declarations; },
  addDeclaration(dec) {
    dec.id = crypto.randomUUID();
    dec.createdAt = new Date().toISOString();
    this._cache.declarations.push(dec);
    return dec;
  },

  // ═══════════════════════════════════════════════════════════════
  //  AUDIT LOG
  // ═══════════════════════════════════════════════════════════════
  addAuditLog(action, detail) {
    const user = (typeof Auth !== 'undefined' && Auth.current) ? Auth.current() : {};
    const rec = {
      id:        crypto.randomUUID(),
      schoolId:  this._schoolId,
      userId:    user?.id || null,
      action,
      details:   detail,
      createdAt: new Date().toISOString(),
    };
    this._cache.audit_log.push(rec);
    // Limitar a 500 registros na cache
    if (this._cache.audit_log.length > 500) {
      this._cache.audit_log.splice(0, this._cache.audit_log.length - 500);
    }
    this._insert('audit_log', rec);
  },

  getAuditLog() {
    return this._cache.audit_log.filter(l => l.schoolId === this._schoolId);
  },

  // ═══════════════════════════════════════════════════════════════
  //  MIGRACAO & SEED
  // ═══════════════════════════════════════════════════════════════
  migrate() {
    // No-op — migracao localStorage nao se aplica mais
    console.log('[GestEscolar] Supabase ativo — migracao localStorage ignorada.');
  },

  async seed() {
    // Super Admin e Escola Demo ja devem existir no banco (criados via SQL ou primeiro deploy).
    // Seed so cria se banco estiver completamente vazio.
    const existingSuperAdmins = this._cache.users.filter(u => u.role === 'superadmin');
    if (existingSuperAdmins.length === 0) {
      console.warn('[GestEscolar] Nenhum Super Admin encontrado. Crie manualmente via Supabase Dashboard.');
    }

    const demoSchool = this._cache.schools.find(s => s.name === 'Escola Demo');
    if (!demoSchool) {
      console.log('[GestEscolar] Escola Demo nao encontrada — ambiente limpo.');
    }
  },

  initSchool(schoolId) {
    // No Supabase, dados sao filtrados por school_id automaticamente
    console.log(`[GestEscolar] Escola ${schoolId} pronta.`);
  },

  // ═══════════════════════════════════════════════════════════════
  //  ESTATISTICAS GLOBAIS (super admin)
  // ═══════════════════════════════════════════════════════════════
  globalStats() {
    return {
      schools:       this._cache.schools.length,
      totalStudents: this._cache.students.length,
      totalTeachers: this._cache.users.filter(u => u.role === 'professor').length,
      totalUsers:    this._cache.users.length,
    };
  }
};
