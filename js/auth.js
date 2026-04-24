// =============================================
//  GESTESCOLAR SaaS – AUTENTICACAO (Supabase Auth)
//  Fase 2.3: Supabase Auth + migracao automatica
// =============================================

const Auth = {
  SESSION_KEY: 'ges_session',

  // Safari iOS private mode bloqueia sessionStorage — usar localStorage com fallback
  _save(data) {
    const v = JSON.stringify(data);
    try { localStorage.setItem(this.SESSION_KEY, v); } catch(e) {
      try { sessionStorage.setItem(this.SESSION_KEY, v); } catch(e2) { /* sem storage */ }
    }
  },
  _load() {
    try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)); } catch(e) {}
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); } catch(e) {}
    return null;
  },
  _remove() {
    try { localStorage.removeItem(this.SESSION_KEY); } catch(e) {}
    try { sessionStorage.removeItem(this.SESSION_KEY); } catch(e) {}
  },

  current() {
    return this._load();
  },

  // Login multi-tenant (async — Supabase Auth primeiro, depois busca user)
  async login(email, password) {
    const val = email.trim().toLowerCase();

    // 0. Se input nao parece email (ex: matricula), buscar o email real via RPC.
    //    Usamos uma RPC SECURITY DEFINER porque o usuario ainda eh anonimo aqui e
    //    o RLS bloqueia leituras diretas em public.users. Sem isso, pais/professores
    //    que logam com matricula nao conseguiriam resolver o email de Auth.
    let authEmail = val;
    if (!val.includes('@')) {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.rpc('find_email_by_matricula', { p_matricula: val });
          if (!error && data) {
            authEmail = data;
          } else if (error) {
            console.warn('[Auth] find_email_by_matricula falhou:', error.message);
          }
        } catch (e) {
          console.warn('[Auth] RPC find_email_by_matricula erro:', e);
        }
      }
      // Fallback: procurar na cache (so funciona se init ja populou algo)
      if (authEmail === val) {
        const schools = DB.getSchools();
        for (const s of schools) {
          DB.setTenant(s.id);
          const found = DB.getUsers().find(u => u.username === val || u.matricula === val);
          if (found && found.email) { authEmail = found.email; break; }
        }
      }
    }

    // 1. Autenticar no Supabase Auth PRIMEIRO (funciona sem cache/RLS)
    if (supabaseClient) {
      const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
        email: authEmail, password,
      });
      if (authErr) {
        console.warn('[Auth] Supabase Auth:', authErr.message);
        return { ok: false, msg: 'Matrícula/e-mail ou senha incorretos.' };
      }

      // 2. Recarregar dados com sessao Auth ativa (RLS agora permite)
      // Pequena pausa para garantir que o token JWT foi propagado internamente
      await new Promise(r => setTimeout(r, 300));
      const { data: sessionCheck } = await supabaseClient.auth.getSession();
      console.log('[Auth] Sessão ativa após login:', sessionCheck?.session?.access_token ? 'SIM' : 'NÃO');

      await DB.init();

      // Retry se DB voltou vazio (timing ou lentidão pontual do Supabase)
      if (DB.getSchools().length === 0) {
        console.warn('[Auth] DB vazio após primeiro init — retry em 2s...');
        await new Promise(r => setTimeout(r, 2000));
        await DB.init();
        console.log('[Auth] DB após retry:', DB.getSchools().length, 'escola(s)');
      }
    }

    // 3. Buscar usuario na cache (agora populada)
    let user = null;
    let school = null;

    const su = DB.getSuperUsers().find(u => u.email === val || u.email === authEmail);
    if (su) {
      user = su;
    } else {
      const schools = DB.getSchools();
      console.log('[Auth] Escolas carregadas:', schools.length);
      for (const s of schools) {
        DB.setTenant(s.id);
        const found = DB.getUsers().find(u =>
          u.email === val || u.email === authEmail ||
          u.username === val || u.matricula === val
        );
        if (found) { user = found; school = s; break; }
      }
    }

    if (!user) {
      // Autenticou no Auth mas não existe na tabela users — pode ser timeout de DB.init()
      if (supabaseClient) await supabaseClient.auth.signOut();
      const dbEmpty = DB.getSchools().length === 0;
      console.error('[Auth] Usuário não encontrado. DB vazio:', dbEmpty, '| email buscado:', authEmail);
      return {
        ok: false,
        msg: dbEmpty
          ? 'Falha ao carregar dados do servidor. Verifique sua conexão e tente novamente.'
          : 'Conta não encontrada no sistema. Contate o administrador.',
      };
    }
    if (!user.active && user.role !== 'superadmin') {
      if (supabaseClient) await supabaseClient.auth.signOut();
      return { ok: false, msg: 'Conta inativa. Contate o administrador.' };
    }

    // 4. Montar sessao
    const { password: _, ...safeUser } = user;
    if (user.role === 'superadmin') {
      safeUser.schoolId = null;
      safeUser.planId = null;
    } else if (school) {
      safeUser.schoolId = school.id;
      safeUser.schoolName = school.name;
      safeUser.planId = school.planId || 'free';
    }
    this._save(safeUser);
    if (school) {
      DB.setTenant(school.id);
      DB.addAuditLog('login', `Login: ${safeUser.email}`);
    }
    return { ok: true, user: safeUser };
  },

  // Verifica se email e valido para Supabase Auth (nao aceita .local, etc)
  _isValidAuthEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email) && !email.endsWith('.local');
  },

  // Migra usuario legado (senha plaintext) para Supabase Auth
  async _migrateUserToAuth(user, password) {
    // Pular migracao para emails invalidos ou senhas curtas
    if (!this._isValidAuthEmail(user.email)) {
      console.log('[Auth] Migracao ignorada: email invalido para Auth');
      return;
    }
    if (password.length < 6) {
      console.log('[Auth] Migracao ignorada: senha muito curta');
      return;
    }
    try {
      await supabaseClient.auth.signOut();
      const { data, error } = await supabaseClient.auth.signUp({
        email: user.email,
        password: password,
        options: {
          data: { name: user.name, role: user.role },
        },
      });
      if (!error && data?.user) {
        const authId = data.user.id;
        DB.updateUser(user.id, { authId });
        user.authId = authId;
        console.log('[Auth] Usuario migrado para Supabase Auth');
        // Tentar login (pode falhar se email nao confirmado — ok)
        await supabaseClient.auth.signInWithPassword({ email: user.email, password }).catch(() => {});
      } else if (error) {
        console.warn('[Auth] Migracao Auth falhou:', error.message);
      }
    } catch (e) {
      console.warn('[Auth] Erro na migracao Auth:', e);
    }
  },

  async logout() {
    this._remove();
    DB.setTenant(null);
    // Aguardar logout do Supabase antes de redirecionar
    // (evita race condition onde novo login começa com sessão antiga ainda ativa)
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (e) { /* ignora */ }
    }
    Router.go('login');
  },

  require() {
    const user = this.current();
    if (!user) { Router.go('login'); return null; }
    if (user.schoolId) DB.setTenant(user.schoolId);
    return user;
  },

  canUse(feature) {
    const user = this.current();
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return Plans.hasFeature(user.planId || 'free', feature);
  },

  checkLimit(type) {
    const user = this.current();
    if (!user) return { ok: false };
    if (user.role === 'superadmin') return { ok: true };
    const school = user.schoolId ? DB.getSchool(user.schoolId) : null;
    const planId = school?.planId || user.planId || 'free';
    let count = 0;
    if (type === 'students') count = DB.getStudents().filter(s => s.status === 'ativo').length;
    else if (type === 'teachers') count = DB.getUsers().filter(u => u.role === 'professor' && u.active !== false).length;
    else if (type === 'gestors') count = DB.getUsers().filter(u => (u.role === 'gestor' || u.role === 'administrativo') && u.active !== false).length;
    // Limite personalizado de alunos (definido pelo superadmin)
    if (type === 'students' && school?.customStudentLimit) {
      const lim = school.customStudentLimit;
      if (count < lim) return { ok: true, limit: lim, current: count, plan: Plans.get(planId).name + ' (personalizado)' };
      return {
        ok: false,
        msg: `Você atingiu o limite personalizado de ${lim} alunos.`,
        limit: lim, current: count, plan: Plans.get(planId).name + ' (personalizado)',
      };
    }
    return Plans.checkLimit(planId, type, count);
  },

  isDemo() {
    const user = this.current();
    return !!(user?.isDemoUser);
  },

  roleLabel(role, roles) {
    const map = {
      administrativo: 'Administrativo',
      financeiro:     'Financeiro',
      professor:      'Professor(a)',
      pai:            'Responsavel',
      gestor:         'Gestor',
      superadmin:     'Super Admin',
    };
    if (roles && roles.length > 1) return roles.map(r => map[r] || r).join(' + ');
    return map[role] || role;
  },

  roleIcon(role) {
    const map = {
      administrativo: 'fa-building',
      financeiro:     'fa-dollar-sign',
      professor:      'fa-chalkboard-teacher',
      pai:            'fa-user-group',
      gestor:         'fa-briefcase',
      superadmin:     'fa-crown',
    };
    return map[role] || 'fa-user';
  },

  roleBadgeColor(role) {
    const map = {
      administrativo: 'blue',
      financeiro:     'green',
      professor:      'purple',
      pai:            'yellow',
      gestor:         'red',
      superadmin:     'red',
    };
    return map[role] || 'gray';
  }
};
