// =============================================
//  GESTESCOLAR – ROTEADOR SPA
// =============================================

const Router = {
  routes: {},
  _currentRoute: null,
  _history: [],

  register(name, fn) {
    this.routes[name] = fn;
  },

  go(name, params = {}) {
    const fn = this.routes[name];
    if (!fn) { console.error('Rota não encontrada:', name); return; }

    // GUARD: escola bloqueada (plano vencido / trial expirado) só pode
    // acessar school-plans, login e landing. Qualquer outra rota redireciona.
    try {
      const allowed = new Set(['school-plans','login','landing','recover','fin-balance']);
      if (typeof Auth !== 'undefined' && typeof Plans !== 'undefined' && !allowed.has(name)) {
        const sess = Auth.current();
        const school = sess && DB.getSchool(sess.schoolId);
        if (school && Plans.isSchoolBlocked(school)) {
          this._currentRoute = 'school-plans';
          this.routes['school-plans']?.({});
          setTimeout(() => Plans.showBlockedModal(school), 100);
          return;
        }
      }
    } catch (e) { /* fail-open */ }

    // Cancela subscrições Realtime da página anterior
    if (typeof Realtime !== 'undefined') Realtime.unsubscribeAll();
    // Empilhar rota atual no histórico (se não for a mesma)
    if (this._currentRoute && this._currentRoute !== name) {
      this._history.push(this._currentRoute);
      if (this._history.length > 20) this._history.shift();
    }
    this._currentRoute = name;

    // Atualizar URL do navegador (browser history)
    const baseUrl = window.location.pathname.split('/')[1] === 'checkout'
      ? window.location.origin
      : window.location.origin;
    const newUrl = name === 'landing'
      ? `${baseUrl}/`
      : `${baseUrl}/${name}`;
    window.history.pushState({ route: name, params }, '', newUrl);

    fn(params);
  },

  back() {
    const prev = this._history.pop();
    if (!prev) return;
    const fn = this.routes[prev];
    if (!fn) return;
    if (typeof Realtime !== 'undefined') Realtime.unsubscribeAll();
    this._currentRoute = prev;
    fn({});
  },

  // Re-renderiza a rota atual (chamado pelo Realtime para refresh)
  _rerender(name) {
    const fn = this.routes[name];
    if (fn) fn({});
  },

  // Renderizar layout com sidebar
  renderLayout(user, activeNav, contentHTML) {
    const navItems = Router._navForRole(user.role, user.roles);
    const unread   = DB.getMessages().filter(m => m.toUserId === user.id && !m.read).length;
    const MSG_ROUTES = new Set(['teacher-messages', 'parent-messages']);
    const school   = DB.getSchool(user?.schoolId);
    const app = document.getElementById('app');
    const trialNotif   = Plans && school ? Plans.getTrialNotificationHTML(school) : '';
    const renewalNotif = Plans && school ? Plans.getRenewalNotificationHTML(school) : '';
    app.innerHTML = `${trialNotif}${renewalNotif}
      <div class="layout" id="layout" data-route="${activeNav}">
        <div class="sidebar-overlay" id="sidebar-overlay" onclick="Router.closeSidebar()"></div>
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-brand">
            <div class="brand-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <div>
              <div class="brand-name">GestEscolar</div>
              <div class="brand-sub">Gestão Educacional</div>
            </div>
          </div>
          <button onclick="Router.toggleSidebarCollapse()" id="sidebar-collapse-btn"
            style="position:absolute;top:12px;right:-14px;width:28px;height:28px;border-radius:50%;
                   background:var(--primary);color:#fff;border:none;cursor:pointer;display:flex;
                   align-items:center;justify-content:center;font-size:14px;z-index:10;
                   box-shadow:0 2px 6px rgba(0,0,0,.2);">
            <i class="fa-solid fa-chevron-left" id="sidebar-collapse-icon"></i>
          </button>
          <nav class="sidebar-nav">
            ${(() => {
              let sec = null;
              return navItems.map(item => {
                if (item.section) {
                  sec = item.section.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
                  return `<div class="nav-section-title" onclick="Router.toggleSection('${sec}')"
                    style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;user-select:none;">
                    <span>${item.section}</span>
                    <i class="fa-solid fa-chevron-down" id="arrow-${sec}"
                      style="font-size:10px;transition:transform .2s;"></i>
                  </div>`;
                }
                const isMsg  = MSG_ROUTES.has(item.route || item.id);
                const badge  = isMsg && unread > 0 && !MSG_ROUTES.has(activeNav)
                  ? `<span style="min-width:18px;height:18px;border-radius:9px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 4px;margin-left:auto;">${unread > 9 ? '9+' : unread}</span>`
                  : '';
                return `<div class="nav-item ${item.id === activeNav ? 'active' : ''}" data-section="${sec}"
                  onclick="Router.go('${item.route || item.id}'); Router.closeSidebar();">
                  <i class="fa-solid ${item.icon}"></i>
                  <span>${item.label}</span>
                  ${badge}
                </div>`;
              }).join('');
            })()}
          </nav>
          ${user.planId && !['superadmin','pai','professor'].includes(user.role) ? `
          <div style="padding:8px 16px;border-top:1px solid rgba(255,255,255,.1);">
            <div style="font-size:10px;text-transform:uppercase;color:rgba(255,255,255,.5);font-weight:700;margin-bottom:4px;">Plano</div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;color:#fff;font-weight:600;">${Utils.escape(Plans.get(user.planId).name)}</span>
              ${user.planId === 'free' ? '<a href="#" onclick="Router.go(\'school-plans\')" style="font-size:11px;color:#64b5f6;">Upgrade</a>' : ''}
            </div>
          </div>
          ${user.planId === 'free' ? `
          <div onclick="Router.go('school-plans')" style="margin:0 12px 8px;padding:10px 14px;
            background:linear-gradient(135deg,#ff6d00,#ff9100);border-radius:8px;cursor:pointer;text-align:center;">
            <style>@keyframes pulseUpgrade{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.05)}}</style>
            <div style="animation:pulseUpgrade 2s ease-in-out infinite;color:#fff;font-weight:900;font-size:13px;text-transform:uppercase;letter-spacing:1px;">
              <i class="fa-solid fa-rocket"></i> UPGRADE
            </div>
            <div style="color:rgba(255,255,255,.85);font-size:10px;margin-top:2px;">Desbloqueie todos os recursos!</div>
          </div>` : ''}` : ''}
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="avatar">${Utils.initials(user.name)}</div>
              <div class="user-info">
                <div class="user-name">${Utils.escape(user.name)}</div>
                <div class="user-role">${Auth.roleLabel(user.role)}${user.schoolName ? ' · ' + Utils.escape(user.schoolName) : ''}</div>
                ${(() => {
                  if (user.role !== 'professor') return '';
                  const classes = DB.getClasses().filter(c => c.teacherId === user.id);
                  if (!classes.length) return '';
                  return `<div style="font-size:10px;color:rgba(255,255,255,.65);margin-top:3px;line-height:1.4;word-break:break-word;">
                    ${classes.map(c => Utils.escape(c.name)).join(' | ')}
                  </div>`;
                })()}
              </div>
              <button class="btn-logout" onclick="Auth.logout()" title="Sair">
                <i class="fa-solid fa-right-from-bracket"></i>
              </button>
            </div>
          </div>
        </aside>
        <div class="main-content">
          <div class="topbar" id="topbar" style="display:none;">
            <button class="btn-menu" id="btn-menu" onclick="Router.toggleSidebar()" aria-label="Menu">
              <i class="fa-solid fa-bars"></i>
            </button>
          </div>
          <div class="page-content" id="page-content">
            ${contentHTML}
          </div>
        </div>
      </div>
    `;
    // Disparar onboarding para novos usuários (uma única vez)
    if (typeof Onboarding !== 'undefined' && Onboarding.shouldShow(user)) {
      // Aguarda o DOM estar pronto antes de posicionar o card
      setTimeout(() => Onboarding.start(user), 400);
    }
  },

  toggleSidebar() {
    const layout = document.getElementById('layout');
    if (layout) layout.classList.toggle('sidebar-open');
  },

  closeSidebar() {
    const layout = document.getElementById('layout');
    if (layout) layout.classList.remove('sidebar-open');
  },

  toggleSidebarCollapse() {
    const layout = document.getElementById('layout');
    if (!layout) return;
    layout.classList.toggle('sidebar-collapsed');
    const icon = document.getElementById('sidebar-collapse-icon');
    if (icon) {
      const collapsed = layout.classList.contains('sidebar-collapsed');
      icon.className = collapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
    }
  },

  toggleSection(sec) {
    const items  = document.querySelectorAll(`[data-section="${sec}"]`);
    const arrow  = document.getElementById(`arrow-${sec}`);
    const isOpen = [...items].some(el => el.style.display !== 'none');
    items.forEach(el => { el.style.display = isOpen ? 'none' : ''; });
    if (arrow) arrow.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
  },

  // Inicializar popstate listener para browser back button
  initBrowserHistory() {
    window.addEventListener('popstate', (e) => {
      const route = e.state?.route || 'landing';
      const params = e.state?.params || {};
      this._currentRoute = null; // força re-render
      this.go(route, params);
    });
    // Rota inicial baseada na URL
    this._initRouteFromUrl();
  },

  // Parse URL e navega para a rota correspondente
  _initRouteFromUrl() {
    const path = window.location.pathname.replace(/^\//, '').split('/')[0] || 'landing';
    const validRoutes = Object.keys(this.routes);
    if (validRoutes.includes(path)) {
      this._currentRoute = null; // força re-render
      this.go(path, {});
    }
  },

  _navForRole(role, roles) {
    const byRole = {
      superadmin: [
        { section: 'Gestão' },
        { id: 'superadmin-dashboard', route: 'superadmin-dashboard', icon: 'fa-crown',           label: 'Dashboard' },
        { id: 'superadmin-students',  route: 'superadmin-students',  icon: 'fa-user-graduate',   label: 'Alunos (Global)' },
        { id: 'superadmin-users',     route: 'superadmin-users',     icon: 'fa-users',           label: 'Usuarios' },
        { id: 'superadmin-payments',  route: 'superadmin-payments',  icon: 'fa-credit-card',     label: 'Pagamentos SaaS' },
        { section: 'Sistemas' },
        { id: 'superadmin-email-config', route: 'superadmin-email-config', icon: 'fa-envelope-open-text', label: 'Config. E-mail' },
        { id: 'superadmin-coupons',      route: 'superadmin-coupons',      icon: 'fa-tag',                label: 'Cupons' },
        { section: 'Suporte' },
        { id: 'superadmin-tickets',   route: 'superadmin-tickets',   icon: 'fa-headset',         label: 'Chamados' },
        { section: 'Conta' },
        { id: 'superadmin-profile',   route: 'superadmin-profile',   icon: 'fa-user-gear',       label: 'Meu Perfil' },
      ],
      administrativo: [
        { section: 'Gestão' },
        { id: 'admin-dashboard', route: 'admin-dashboard', icon: 'fa-chart-line',       label: 'Dashboard' },
        { id: 'admin-students',  route: 'admin-students',  icon: 'fa-user-graduate',    label: 'Alunos' },
        { id: 'admin-staff',     route: 'admin-staff',     icon: 'fa-users',            label: 'Funcionários' },
        { id: 'admin-classes',   route: 'admin-classes',   icon: 'fa-chalkboard',       label: 'Turmas' },
        { section: 'Sistemas' },
        { id: 'register',        route: 'register',        icon: 'fa-user-plus',        label: 'Novo Cadastro' },
        { id: 'admin-asaas-documents', route: 'admin-asaas-documents', icon: 'fa-id-card', label: 'Documentos Asaas' },
        { id: 'admin-settings',  route: 'admin-settings',  icon: 'fa-gear',             label: 'Configurações' },
        { section: 'Suporte' },
        { id: 'user-tickets',    route: 'user-tickets',    icon: 'fa-headset',          label: 'Meus Chamados' },
      ],
      financeiro: [
        { section: 'Financeiro' },
        { id: 'fin-dashboard',   route: 'fin-dashboard',   icon: 'fa-chart-line',       label: 'Dashboard' },
        { id: 'fin-entradas',    route: 'fin-entradas',    icon: 'fa-arrow-trend-up',   label: 'Entradas' },
        { id: 'fin-expenses',    route: 'fin-expenses',    icon: 'fa-credit-card',      label: 'Contas a Pagar' },
        { id: 'fin-balance',     route: 'fin-balance',     icon: 'fa-piggy-bank',       label: 'Saldo / Resgate' },
        { section: 'Suporte' },
        { id: 'user-tickets',    route: 'user-tickets',    icon: 'fa-headset',          label: 'Meus Chamados' },
      ],
      professor: [
        { section: 'Pedagógico' },
        { id: 'teacher-dashboard',route: 'teacher-dashboard',icon: 'fa-chart-line',    label: 'Dashboard' },
        { id: 'teacher-attendance',route:'teacher-attendance',icon: 'fa-clipboard-check',label: 'Chamada' },
        { id: 'teacher-grades',  route: 'teacher-grades',  icon: 'fa-star',             label: 'Avaliações' },
        { id: 'teacher-messages',route: 'teacher-messages',icon: 'fa-envelope',         label: 'Mensagens' },
        { section: 'Suporte' },
        { id: 'user-tickets',    route: 'user-tickets',    icon: 'fa-headset',          label: 'Chamados' },
      ],
      pai: [
        { section: 'Pedagógico' },
        { id: 'parent-dashboard',route: 'parent-dashboard',icon: 'fa-chart-line',       label: 'Inicio' },
        { id: 'parent-attendance',route:'parent-attendance',icon: 'fa-clipboard-check', label: 'Presenças' },
        { id: 'parent-grades',   route: 'parent-grades',   icon: 'fa-star',             label: 'Boletim' },
        { id: 'parent-messages', route: 'parent-messages', icon: 'fa-envelope',         label: 'Mensagens' },
        { section: 'Financeiro' },
        { id: 'parent-invoices', route: 'parent-invoices', icon: 'fa-file-invoice',     label: 'Pagamentos' },
        { section: 'Suporte' },
        { id: 'user-tickets',    route: 'user-tickets',    icon: 'fa-headset',          label: 'Chamados' },
      ],
      gestor: [
        { section: 'Gestão' },
        { id: 'admin-dashboard',  route: 'admin-dashboard',  icon: 'fa-chart-line',        label: 'Dashboard' },
        { id: 'admin-students',   route: 'admin-students',   icon: 'fa-user-graduate',     label: 'Alunos' },
        { id: 'admin-staff',      route: 'admin-staff',      icon: 'fa-users',             label: 'Funcionários' },
        { id: 'admin-classes',    route: 'admin-classes',    icon: 'fa-chalkboard',        label: 'Turmas' },
        { section: 'Pedagógico' },
        { id: 'teacher-attendance',route:'teacher-attendance',icon:'fa-clipboard-check',  label: 'Chamada' },
        { id: 'gestor-grades',    route: 'gestor-grades',    icon: 'fa-star',             label: 'Avaliações' },
        { section: 'Financeiro' },
        { id: 'fin-dashboard',    route: 'fin-dashboard',    icon: 'fa-chart-bar',         label: 'Financeiro' },
        { id: 'fin-entradas',     route: 'fin-entradas',     icon: 'fa-arrow-trend-up',    label: 'Entradas' },
        { id: 'fin-expenses',     route: 'fin-expenses',     icon: 'fa-credit-card',       label: 'Contas a Pagar' },
        { id: 'fin-balance',      route: 'fin-balance',      icon: 'fa-piggy-bank',        label: 'Saldo / Resgate' },
        { section: 'Sistemas' },
        { id: 'register',         route: 'register',         icon: 'fa-user-plus',        label: 'Novo Cadastro' },
        { id: 'school-plans',     route: 'school-plans',     icon: 'fa-rocket',           label: 'Planos' },
        { id: 'admin-asaas-documents', route: 'admin-asaas-documents', icon: 'fa-id-card', label: 'Documentos Asaas' },
        { id: 'admin-settings',   route: 'admin-settings',   icon: 'fa-gear',             label: 'Configurações' },
        { section: 'Suporte' },
        { id: 'user-tickets',     route: 'user-tickets',     icon: 'fa-headset',          label: 'Meus Chamados' },
      ],
    };
    const activeRoles = (roles && roles.length > 0) ? roles : [role];
    const seen = new Set();
    const items = [];
    activeRoles.forEach(r => {
      (byRole[r] || []).forEach(item => {
        if (item.section) {
          items.push(item);
        } else if (!seen.has(item.id)) {
          seen.add(item.id);
          items.push(item);
        }
      });
    });
    return items;
  }
};
