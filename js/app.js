// =============================================
//  GESTESCOLAR SaaS – INICIALIZACAO (Supabase)
// =============================================

(async function () {
  // 1. Listener para detectar token de recovery (link de e-mail)
  //    e para limpar ges_session se a sessão Supabase for invalidada externamente
  //    (token expirado, signOut em outra aba, refresh falhou).
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (typeof LoginPage !== 'undefined') {
          LoginPage._showResetPasswordForm();
        }
        return;
      }
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Sessão Supabase morta — não deixar ges_session órfão dando "acesso fantasma"
        try { Auth._remove(); } catch (_) {}
        if (location.pathname !== '/login' && location.pathname !== '/') {
          if (typeof Router !== 'undefined') Router.go('login');
        }
      }
    });
  }

  // 2. Verificar se URL contém query params de reset de senha (?reset_token=...&email=...) [LEGADO]
  const params = new URLSearchParams(window.location.search);
  const resetTokenQuery = params.get('reset_token');
  const resetEmailQuery = params.get('email');

  if (resetTokenQuery && resetEmailQuery) {
    console.log('[App] Reset token detectado em query params - redirecionando para login com fragment');
    // Redirecionar para usar fragment em vez de query params (mais seguro)
    window.location.hash = `reset_token=${resetTokenQuery}&reset_email=${encodeURIComponent(resetEmailQuery)}`;
    return;
  }

  // 2.5. Verificar se URL contém hash de reset de senha (nosso padrão: #reset_token=...&reset_email=...)
  const hash = window.location.hash;
  if (hash && hash.includes('reset_token=')) {
    console.log('[App] Reset token detectado no fragment - processando reset de senha');
    // Extrair parâmetros do fragment
    const hashParams = new URLSearchParams(hash.substring(1)); // Remove o # inicial
    const resetToken = hashParams.get('reset_token');
    const resetEmail = hashParams.get('reset_email');

    if (resetToken && resetEmail) {
      console.log('[App] Parâmetros de reset validados - indo para login');
      // Armazenar em sessionStorage para que LoginPage recupere depois
      sessionStorage.setItem('resetToken', resetToken);
      sessionStorage.setItem('resetEmail', resetEmail);
      // Limpar URL mas manter o hash para o LoginPage detectar
      window.history.replaceState({}, '', '/login#reset_token=' + encodeURIComponent(resetToken) + '&reset_email=' + encodeURIComponent(resetEmail));
      // Ir para login - LoginPage vai detectar e mostrar formulário
      Router.go('login');
      return;
    }
  }

  // 2.75. Verificar se URL contém hash de reset de senha do Supabase (type=recovery ou access_token)
  if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
    console.log('[App] Detctando Supabase recovery link');
    if (typeof LoginPage !== 'undefined') {
      const handled = await LoginPage.checkPasswordResetToken();
      if (handled) return;
    }
  }

  // 2.75. Inicializar browser history routes (trata /checkout, /login, etc na URL)
  Router.initBrowserHistory();

  // 3. Verificar sess\u00e3o local + validar contra Supabase Auth
  //    ges_session sozinho N\u00c3O \u00e9 prova de autentica\u00e7\u00e3o: o JWT do Supabase pode
  //    ter expirado/sido revogado. Sem essa checagem, o app entra no dashboard
  //    com cache antigo e o usu\u00e1rio v\u00ea "sem permiss\u00e3o" em todas as queries RLS.
  let user = Auth.current();

  if (user && supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (!data?.session) {
        console.warn('[App] ges_session presente mas Supabase sem sess\u00e3o ativa \u2014 limpando cache local');
        Auth._remove();
        user = null;
      }
    } catch (e) {
      console.warn('[App] Falha ao validar sess\u00e3o Supabase:', e);
      Auth._remove();
      user = null;
    }
  }

  // 4. Só carrega DB se já tem sessão ativa (evita timeout com RLS anônimo)
  if (user) {
    await DB.init();
    await DB.seed();
    DB.fixMissingParentIds();
    if (user.schoolId) DB.setTenant(user.schoolId);

    // Validar trial period antes de rotear
    const school = DB.getSchool(user.schoolId);
    if (school && Plans.isSchoolBlocked(school)) {
      console.warn('[App] Escola bloqueada (trial expirado ou plano vencido) → redirecionando para planos');
      Router.go('school-plans');
      Auth.startIdleTimer();
      return;
    }

    const map = {
      superadmin:     'superadmin-dashboard',
      administrativo: 'admin-dashboard',
      financeiro:     'fin-dashboard',
      professor:      'teacher-dashboard',
      pai:            'parent-dashboard',
      gestor:         'admin-dashboard',
    };
    Router.go(map[user.role] || 'login');
    Auth.startIdleTimer(); // Auto-logout após 30 min de inatividade
  } else {
    Router.go('landing');
  }

  // 7. Verificar boletos com vencimento pr\u00f3ximo
  if (user && user.schoolId) _checkDueSoon();
})();

function _checkDueSoon() {
  const invoices = DB.getInvoices();
  const dueSoon  = invoices.filter(i => i.status === 'pendente' && Utils.isDueSoon(i.dueDate));
  if (dueSoon.length > 0) {
    console.log(`[GestEscolar] ${dueSoon.length} boleto(s) com vencimento pr\u00f3ximo.`);
  }
}
