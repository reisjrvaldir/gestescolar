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

    // 0.5. Limpar QUALQUER sessão anterior antes de tentar nova autenticação.
    //      Se o gestor estiver logado e abrir /login para testar credenciais
    //      do professor, a sessão antiga pode interferir com signInWithPassword.
    //      Forçar signOut garante estado limpo.
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (_) { /* ignorar erros de signOut */ }
      // Limpar também a sessão local do app (ges_session em localStorage)
      this._remove();
    }

    // 1. Autenticar no Supabase Auth PRIMEIRO (funciona sem cache/RLS)
    if (supabaseClient) {
      const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
        email: authEmail, password,
      });
      if (authErr) {
        console.warn('[Auth] Supabase Auth:', authErr.message);
        // E-mail não confirmado: conta criada mas professor ainda não pode logar
        if (authErr.message?.toLowerCase().includes('email not confirmed')) {
          return { ok: false, msg: 'E-mail não confirmado. Contate o administrador para reativar o acesso.' };
        }
        // Distinguir "e-mail não existe" de "senha errada"
        // Usa API com service role (bypassa RLS, não exige RPC no banco)
        try {
          const checkRes = await fetch('/api/asaas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'checkEmailExists', data: { email: authEmail } }),
          });
          const checkData = await checkRes.json();
          if (checkRes.ok && checkData.exists === false) {
            return { ok: false, msg: 'E-mail não cadastrado no sistema.' };
          }
        } catch (_) { /* fallback para mensagem genérica */ }
        return { ok: false, msg: 'Senha incorreta. Tente novamente.' };
      }

      // 2. Recarregar dados com sessao Auth ativa (RLS agora permite)
      // Polling até o JWT propagar (vs sleep fixo de 300ms que falhava em rede lenta).
      // Tenta a cada 100ms, máximo 3s.
      let sessionOk = false;
      for (let i = 0; i < 30; i++) {
        const { data } = await supabaseClient.auth.getSession();
        if (data?.session?.access_token) { sessionOk = true; break; }
        await new Promise(r => setTimeout(r, 100));
      }
      console.log('[Auth] Sessão ativa após login:', sessionOk ? `SIM (após ~${(Date.now() % 100000)/1000}s)` : 'NÃO (timeout 3s)');

      await DB.init();

      // Retry com backoff se DB voltou vazio (até 3 tentativas)
      for (let attempt = 1; DB.getSchools().length === 0 && attempt <= 3; attempt++) {
        const wait = 500 * attempt;
        console.warn(`[Auth] DB vazio após init — retry ${attempt}/3 em ${wait}ms...`);
        await new Promise(r => setTimeout(r, wait));
        await DB.init();
      }
      console.log('[Auth] DB final:', DB.getSchools().length, 'escola(s)');
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

  // Logout com confirmação de duplo clique (evita saída acidental)
  // Primeiro clique: mostra toast de confirmação por 3s
  // Segundo clique dentro de 3s: executa o logout
  logoutConfirm() {
    if (this._logoutPending) {
      clearTimeout(this._logoutPending);
      this._logoutPending = null;
      // Remove toast de confirmação se existir
      document.getElementById('logout-confirm-toast')?.remove();
      this.logout();
      return;
    }
    // Mostrar toast de confirmação
    const toast = document.createElement('div');
    toast.id = 'logout-confirm-toast';
    toast.style.cssText = [
      'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);',
      'background:#323232;color:#fff;border-radius:8px;padding:12px 20px;',
      'font-size:14px;font-weight:500;z-index:99998;',
      'display:flex;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.3);',
      'cursor:pointer;white-space:nowrap;',
    ].join('');
    toast.innerHTML = '<i class="fa-solid fa-right-from-bracket" style="color:#ff9800;"></i> Clique novamente para sair';
    toast.onclick = () => this.logoutConfirm();
    document.body.appendChild(toast);

    this._logoutPending = setTimeout(() => {
      document.getElementById('logout-confirm-toast')?.remove();
      this._logoutPending = null;
    }, 3000);
  },

  async logout() {
    this._stopIdleTimer();
    this._remove();
    DB.setTenant(null);
    // Aguardar logout do Supabase antes de redirecionar
    // (evita race condition onde novo login começa com sessão antiga ainda ativa)
    if (supabaseClient) {
      try { await supabaseClient.auth.signOut(); } catch (e) { /* ignora */ }
    }
    Router.go('login');
  },

  // ── AUTO-LOGOUT POR INATIVIDADE ─────────────────────────────────────────────
  // Desconecta automaticamente após 30 min sem interação.
  // Exibe aviso 2 min antes com opção "Continuar conectado".

  startIdleTimer() {
    this._stopIdleTimer();

    const IDLE_MS  = 30 * 60 * 1000; // 30 minutos
    const WARN_MS  =  2 * 60 * 1000; //  2 minutos de aviso antes

    const reset = () => {
      clearTimeout(this._idleWarnTimeout);
      clearTimeout(this._idleOutTimeout);
      // Remove aviso se o usuário voltou a interagir
      const existing = document.getElementById('idle-warning-modal');
      if (existing) { clearInterval(existing._interval); existing.remove(); }

      this._idleWarnTimeout = setTimeout(() => this._showIdleWarning(WARN_MS), IDLE_MS - WARN_MS);
      this._idleOutTimeout  = setTimeout(() => this.logout(), IDLE_MS);
    };

    const EVENTS = ['mousemove','mousedown','keydown','scroll','touchstart','click','wheel'];
    this._idleReset = reset;
    EVENTS.forEach(ev => window.addEventListener(ev, reset, { passive: true }));
    reset();
  },

  _stopIdleTimer() {
    clearTimeout(this._idleWarnTimeout);
    clearTimeout(this._idleOutTimeout);
    if (this._idleReset) {
      const EVENTS = ['mousemove','mousedown','keydown','scroll','touchstart','click','wheel'];
      EVENTS.forEach(ev => window.removeEventListener(ev, this._idleReset));
      this._idleReset = null;
    }
    const modal = document.getElementById('idle-warning-modal');
    if (modal) { clearInterval(modal._interval); modal.remove(); }
  },

  _showIdleWarning(msLeft) {
    if (document.getElementById('idle-warning-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'idle-warning-modal';
    modal.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;',
      'display:flex;align-items:center;justify-content:center;',
      'font-family:inherit;',
    ].join('');

    const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    let secs = Math.floor(msLeft / 1000);

    modal.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:36px 32px;max-width:380px;
                  width:90%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.25);">
        <i class="fa-solid fa-clock" style="font-size:44px;color:#f59e0b;margin-bottom:14px;display:block;"></i>
        <div style="font-size:17px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">Sessão expirando por inatividade</div>
        <p style="margin:0 0 20px;color:#666;font-size:14px;line-height:1.5;">
          Você será desconectado em<br>
          <span id="idle-countdown" style="font-size:26px;font-weight:800;color:#e53935;">
            ${fmt(secs)}
          </span>
        </p>
        <button onclick="Auth._keepAlive()"
          style="width:100%;padding:13px;background:var(--primary,#1a73e8);color:#fff;
                 border:none;border-radius:9px;font-size:15px;font-weight:700;cursor:pointer;">
          <i class="fa-solid fa-rotate-right"></i> Continuar conectado
        </button>
      </div>`;

    const countEl = () => modal.querySelector('#idle-countdown');
    modal._interval = setInterval(() => {
      secs--;
      if (secs <= 0) { clearInterval(modal._interval); return; }
      const el = countEl();
      if (el) el.textContent = fmt(secs);
    }, 1000);

    document.body.appendChild(modal);
  },

  _keepAlive() {
    const modal = document.getElementById('idle-warning-modal');
    if (modal) { clearInterval(modal._interval); modal.remove(); }
    // Simula atividade para resetar o timer
    if (this._idleReset) this._idleReset();
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
