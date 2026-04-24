// =============================================
//  GESTESCOLAR – ONBOARDING TUTORIAL
//  Exibido uma única vez por usuário no 1º login
//  Persiste conclusão em localStorage por user.id
// =============================================

const Onboarding = {

  // ── Passos por role ────────────────────────────────────────────
  _steps: {

    gestor: [
      {
        target: null,
        icon: 'fa-graduation-cap',
        title: 'Bem-vindo ao GestEscolar! 🎉',
        text: 'Este é o painel de gestão da sua escola. Vamos fazer um tour rápido pelas principais funcionalidades.',
        highlight: false,
      },
      {
        target: '[data-route="admin-dashboard"] .nav-item:first-child, .nav-item[onclick*="admin-dashboard"]',
        icon: 'fa-chart-pie',
        title: 'Dashboard',
        text: 'Aqui você tem uma visão geral da escola: total de alunos, inadimplência, frequência e resumo financeiro do mês.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-students"]',
        icon: 'fa-user-graduate',
        title: 'Alunos',
        text: 'Cadastre, edite e gerencie todos os alunos da escola. Controle matrículas, turmas, status e dados dos responsáveis.',
        highlight: true,
        side: 'right',
      },
      {
        target: 'button:contains("Novo Cadastro"), button:contains("Novo Aluno"), [onclick*="new-student"], .btn-new-student',
        icon: 'fa-plus-circle',
        title: 'Novo Cadastro de Aluno',
        text: 'Clique em "Novo Cadastro" para adicionar um novo aluno à escola. Preencha os dados do aluno e do responsável.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-staff"]',
        icon: 'fa-users',
        title: 'Funcionários',
        text: 'Gerencie professores e colaboradores. Cada usuário tem acesso apenas às funcionalidades do seu perfil.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-classes"]',
        icon: 'fa-chalkboard',
        title: 'Turmas',
        text: 'Crie e organize as turmas da escola, defina séries, turnos e vincule professores responsáveis.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-dashboard"]',
        icon: 'fa-dollar-sign',
        title: 'Financeiro',
        text: 'Acompanhe entradas, despesas e o saldo da escola em tempo real. Gere cobranças PIX e controle a inadimplência.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-entradas"]',
        icon: 'fa-file-invoice-dollar',
        title: 'Entradas (Mensalidades)',
        text: 'Gerencie as cobranças dos alunos, gere QR Codes PIX para cobrança de mensalidades e registre pagamentos manualmente.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-expenses"]',
        icon: 'fa-receipt',
        title: 'Contas a Pagar (Despesas)',
        text: 'Registre e categorize todas as despesas da escola. Controle vencimentos e acompanhe fluxo de caixa.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-balance"]',
        icon: 'fa-wallet',
        title: 'Saldo e Resgate',
        text: 'Veja o saldo em tempo real e solicite resgates via PIX para a conta da sua escola. Os fundos são automaticamente depositados.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="gestor-grades"]',
        icon: 'fa-clipboard-user',
        title: 'Chamada (Frequência e Notas)',
        text: 'Visualize e registre a frequência dos alunos. Acompanhe o boletim, notas por disciplina e desempenho por turma e período.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="school-plans"]',
        icon: 'fa-rocket',
        title: 'Planos e Assinatura',
        text: 'Gerencie seu plano atual, faça upgrade para liberar mais alunos e funcionalidades avançadas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-settings"]',
        icon: 'fa-gear',
        title: 'Configurações da Escola 📋',
        text: 'Aqui você configura todos os dados da sua escola. ⚠️ IMPORTANTE: Para gerar pagamentos e cobranças, TODOS os campos da aba "Configurações da Escola" devem ser preenchidos obrigatoriamente.',
        highlight: true,
        side: 'right',
      },
      {
        target: null,
        icon: 'fa-bank',
        title: 'Conta Exclusiva para Pagamentos 🏦',
        text: 'Quando sua escola foi cadastrada, uma conta exclusiva no Asaas foi criada automaticamente para receber os pagamentos dos pais. Todos os valores pagos pelos responsáveis vão direto para essa conta separada.',
        highlight: false,
      },
      {
        target: null,
        icon: 'fa-arrow-right-arrow-left',
        title: 'Resgate Automático de Fundos 💰',
        text: 'Os fundos acumulados são resgatados automaticamente para a conta bancária ou chave PIX que você configurar nas Configurações da Escola. Você não precisa fazer nada - é totalmente automático!',
        highlight: false,
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Você está pronto para usar o GestEscolar. Configure todos os campos da escola, e comece a cobrar mensalidades via PIX!',
        highlight: true,
        side: 'right',
      },
    ],

    administrativo: [
      {
        target: null,
        icon: 'fa-graduation-cap',
        title: 'Bem-vindo ao GestEscolar! 🎉',
        text: 'Você tem acesso ao painel administrativo. Vamos conhecer as principais seções.',
        highlight: false,
      },
      {
        target: '.nav-item[onclick*="admin-dashboard"]',
        icon: 'fa-chart-pie',
        title: 'Dashboard',
        text: 'Resumo geral da escola: alunos ativos, turmas, frequência e pendências do dia.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-students"]',
        icon: 'fa-user-graduate',
        title: 'Alunos',
        text: 'Cadastre novos alunos, edite informações e controle matrículas e turmas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-staff"]',
        icon: 'fa-users',
        title: 'Funcionários',
        text: 'Visualize e gerencie os colaboradores da escola.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="admin-classes"]',
        icon: 'fa-chalkboard',
        title: 'Turmas',
        text: 'Organize as turmas e vincule alunos e professores.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Explore o sistema à vontade. Qualquer dúvida, fale com o gestor da escola.',
        highlight: true,
        side: 'right',
      },
    ],

    financeiro: [
      {
        target: null,
        icon: 'fa-graduation-cap',
        title: 'Bem-vindo ao GestEscolar! 🎉',
        text: 'Você tem acesso ao módulo financeiro. Vamos ver o que está disponível.',
        highlight: false,
      },
      {
        target: '.nav-item[onclick*="fin-dashboard"]',
        icon: 'fa-chart-line',
        title: 'Dashboard Financeiro',
        text: 'Visão completa das finanças: saldo atual, entradas do mês, despesas e inadimplência.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-entradas"]',
        icon: 'fa-file-invoice-dollar',
        title: 'Mensalidades',
        text: 'Gerencie as cobranças dos alunos, gere boletos PIX e registre pagamentos manualmente.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-expenses"]',
        icon: 'fa-receipt',
        title: 'Despesas',
        text: 'Registre e categorize todas as despesas da escola. Controle pagamentos e vencimentos.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="fin-balance"]',
        icon: 'fa-wallet',
        title: 'Caixa / Saldo',
        text: 'Acompanhe o saldo em tempo real e solicite resgates via PIX para a conta da escola.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Módulo financeiro configurado. Use o dashboard para acompanhar as finanças diariamente.',
        highlight: true,
        side: 'right',
      },
    ],

    professor: [
      {
        target: null,
        icon: 'fa-graduation-cap',
        title: 'Bem-vindo ao GestEscolar! 🎉',
        text: 'Olá, professor(a)! Este é o seu painel. Veja as ferramentas disponíveis para você.',
        highlight: false,
      },
      {
        target: '.nav-item[onclick*="teacher-dashboard"]',
        icon: 'fa-house',
        title: 'Início',
        text: 'Sua visão geral: turmas do dia, próximas aulas e resumo de notas e frequência.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="teacher-attendance"]',
        icon: 'fa-clipboard-user',
        title: 'Frequência',
        text: 'Lance a chamada diária da sua turma. Registre presença, falta ou atraso de cada aluno.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="teacher-grades"]',
        icon: 'fa-star',
        title: 'Notas',
        text: 'Lance e edite as notas dos alunos por disciplina e período. O sistema calcula a média automaticamente.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="teacher-messages"]',
        icon: 'fa-message',
        title: 'Mensagens',
        text: 'Envie comunicados diretamente para os responsáveis dos alunos. As mensagens aparecem no app deles.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Bom trabalho, professor(a)! Use o sistema para registrar frequência e notas diariamente.',
        highlight: true,
        side: 'right',
      },
    ],

    pai: [
      {
        target: null,
        icon: 'fa-graduation-cap',
        title: 'Bem-vindo ao Portal do Responsável! 🎉',
        text: 'Acompanhe tudo sobre a vida escolar do seu filho(a) em um só lugar.',
        highlight: false,
      },
      {
        target: '.nav-item[onclick*="parent-dashboard"]',
        icon: 'fa-house',
        title: 'Início',
        text: 'Resumo rápido: frequência atual, últimas notas e mensagens não lidas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="parent-attendance"]',
        icon: 'fa-clipboard-user',
        title: 'Frequência',
        text: 'Veja o histórico de presenças e faltas do seu filho(a) por mês.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="parent-grades"]',
        icon: 'fa-star',
        title: 'Boletim',
        text: 'Acompanhe as notas por disciplina e período. Veja a média e a situação em cada matéria.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="parent-invoices"]',
        icon: 'fa-file-invoice-dollar',
        title: 'Financeiro',
        text: 'Veja as mensalidades, situação dos pagamentos e gere o QR Code PIX para pagar em segundos.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="parent-messages"]',
        icon: 'fa-message',
        title: 'Mensagens',
        text: 'Receba comunicados dos professores e da escola diretamente aqui.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Agora você está conectado à escola do seu filho(a). Acompanhe tudo por aqui!',
        highlight: true,
        side: 'right',
      },
    ],

    superadmin: [
      {
        target: null,
        icon: 'fa-crown',
        title: 'Painel Super Admin 👑',
        text: 'Você tem acesso total ao GestEscolar. Aqui você gerencia todas as escolas da plataforma.',
        highlight: false,
      },
      {
        target: '.nav-item[onclick*="superadmin-dashboard"]',
        icon: 'fa-chart-pie',
        title: 'Dashboard Global',
        text: 'Visão consolidada de todas as escolas: total de alunos, receita da plataforma e escolas ativas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="superadmin-students"]',
        icon: 'fa-user-graduate',
        title: 'Alunos (Global)',
        text: 'Lista consolidada de todos os alunos de todas as escolas, com dados de login e matrícula.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="superadmin-users"]',
        icon: 'fa-users',
        title: 'Usuários (Global)',
        text: 'Gerencie gestores, professores e usuários de todas as escolas cadastradas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.nav-item[onclick*="superadmin-payments"]',
        icon: 'fa-dollar-sign',
        title: 'Pagamentos SaaS',
        text: 'Acompanhe as assinaturas ativas, receita da plataforma e histórico de pagamentos das escolas.',
        highlight: true,
        side: 'right',
      },
      {
        target: '.sidebar-user',
        icon: 'fa-circle-check',
        title: 'Tudo pronto! ✅',
        text: 'Painel superadmin configurado. Você tem controle total da plataforma.',
        highlight: true,
        side: 'right',
      },
    ],
  },

  // ── Estado interno ─────────────────────────────────────────────
  _current: 0,
  _steps_list: [],
  _userId: null,

  // ── Verificar se deve mostrar ──────────────────────────────────
  shouldShow(user) {
    if (!user || !user.id) return false;
    return !localStorage.getItem('ges_onboarding_done_' + user.id);
  },

  // ── Iniciar tutorial ──────────────────────────────────────────
  start(user) {
    if (!this.shouldShow(user)) return;
    const role = user.role || 'gestor';
    this._steps_list = this._steps[role] || this._steps.gestor;
    this._current = 0;
    this._userId = user.id;
    this._render();
  },

  // ── Renderizar overlay ─────────────────────────────────────────
  _render() {
    this._removeOverlay();
    const step = this._steps_list[this._current];
    const total = this._steps_list.length;
    const isFirst = this._current === 0;
    const isLast  = this._current === total - 1;

    // Overlay escuro
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9998;
      background:rgba(0,0,0,0);
      transition:background .3s;
      pointer-events:${step.highlight ? 'auto' : 'none'};
    `;

    // Card do tutorial
    const card = document.createElement('div');
    card.id = 'onboarding-card';
    card.style.cssText = `
      position:fixed;z-index:9999;
      background:#fff;border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,.22);
      padding:28px 28px 22px;
      width:min(340px, calc(100vw - 32px));
      font-family:var(--font,'Segoe UI',system-ui,sans-serif);
      animation:ob-fadein .3s ease;
      pointer-events:auto;
    `;

    // Barra de progresso
    const progressPct = ((this._current) / (total - 1)) * 100;
    card.innerHTML = `
      <style>
        @keyframes ob-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ob-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(26,115,232,.4)} 50%{box-shadow:0 0 0 8px rgba(26,115,232,0)} }
        #onboarding-card .ob-progress-bar {
          height:4px;border-radius:4px;background:#e8eaed;margin-bottom:20px;overflow:hidden;
        }
        #onboarding-card .ob-progress-fill {
          height:100%;border-radius:4px;background:var(--primary,#1a73e8);
          width:${progressPct}%;transition:width .4s ease;
        }
        #onboarding-card .ob-icon-wrap {
          width:48px;height:48px;border-radius:12px;
          background:linear-gradient(135deg,#1a73e8,#0d47a1);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-size:22px;margin-bottom:14px;flex-shrink:0;
        }
        #onboarding-card .ob-title {
          font-size:16px;font-weight:700;color:#202124;margin-bottom:8px;line-height:1.3;
        }
        #onboarding-card .ob-text {
          font-size:13.5px;color:#5f6368;line-height:1.6;margin-bottom:20px;
        }
        #onboarding-card .ob-footer {
          display:flex;align-items:center;justify-content:space-between;gap:10px;
        }
        #onboarding-card .ob-step-count {
          font-size:12px;color:#9aa0a6;white-space:nowrap;
        }
        #onboarding-card .ob-actions { display:flex;gap:8px; }
        #onboarding-card .ob-btn {
          padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;
          border:none;cursor:pointer;transition:opacity .15s,transform .1s;
        }
        #onboarding-card .ob-btn:hover { opacity:.85; }
        #onboarding-card .ob-btn:active { transform:scale(.97); }
        #onboarding-card .ob-btn-primary {
          background:var(--primary,#1a73e8);color:#fff;
        }
        #onboarding-card .ob-btn-ghost {
          background:transparent;color:#5f6368;border:1px solid #dadce0;
        }
        #onboarding-highlight {
          position:fixed;z-index:9997;border-radius:10px;
          box-shadow:0 0 0 9999px rgba(0,0,0,.55), 0 0 0 3px #1a73e8;
          animation:ob-pulse 2s infinite;
          pointer-events:none;transition:all .35s ease;
        }
      </style>

      <div class="ob-progress-bar"><div class="ob-progress-fill"></div></div>

      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div class="ob-icon-wrap">
          <i class="fa-solid ${step.icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="ob-title">${step.title}</div>
          <div class="ob-text">${step.text}</div>
        </div>
      </div>

      <div class="ob-footer">
        <span class="ob-step-count">${this._current + 1} de ${total}</span>
        <div class="ob-actions">
          <button class="ob-btn ob-btn-ghost" onclick="Onboarding.skip()">Pular</button>
          ${!isFirst ? `<button class="ob-btn ob-btn-ghost" onclick="Onboarding.prev()">← Voltar</button>` : ''}
          <button class="ob-btn ob-btn-primary" onclick="Onboarding.next()">
            ${isLast ? '<i class="fa-solid fa-check"></i> Concluir' : 'Próximo →'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(card);

    // Posicionar card e highlight
    setTimeout(() => {
      overlay.style.background = step.highlight ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.45)';
      this._positionCard(card, step);
      if (step.highlight) this._positionHighlight(step);
    }, 30);
  },

  // ── Posicionar card em relação ao elemento alvo ──────────────
  _positionCard(card, step) {
    const margin = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = card.offsetWidth  || 340;
    const ch = card.offsetHeight || 220;

    if (!step.highlight || !step.target) {
      // Centrado na tela
      card.style.top  = Math.max(margin, (vh - ch) / 2) + 'px';
      card.style.left = Math.max(margin, (vw - cw) / 2) + 'px';
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      card.style.top  = (vh / 2 - ch / 2) + 'px';
      card.style.left = (vw / 2 - cw / 2) + 'px';
      return;
    }

    const r = el.getBoundingClientRect();
    const sidebarW = 240; // sidebar width

    // Por padrão coloca à direita da sidebar
    let left = sidebarW + 16;
    let top  = r.top + r.height / 2 - ch / 2;

    // Garantir dentro da tela
    if (left + cw > vw - margin) left = vw - cw - margin;
    if (left < margin) left = margin;
    if (top + ch > vh - margin) top = vh - ch - margin;
    if (top < margin) top = margin;

    card.style.top  = top  + 'px';
    card.style.left = left + 'px';
  },

  // ── Spotlight no elemento alvo ────────────────────────────────
  _positionHighlight(step) {
    if (!step.target) return;
    const el = document.querySelector(step.target);
    if (!el) return;

    const r = el.getBoundingClientRect();
    const pad = 6;

    let hl = document.getElementById('onboarding-highlight');
    if (!hl) {
      hl = document.createElement('div');
      hl.id = 'onboarding-highlight';
      document.body.appendChild(hl);
    }
    hl.style.cssText = `
      position:fixed;z-index:9997;border-radius:10px;
      box-shadow:0 0 0 9999px rgba(0,0,0,.55), 0 0 0 3px #1a73e8;
      animation:ob-pulse 2s infinite;
      pointer-events:none;transition:all .35s ease;
      top:${r.top - pad}px;
      left:${r.left - pad}px;
      width:${r.width + pad * 2}px;
      height:${r.height + pad * 2}px;
    `;
  },

  // ── Remover overlay ───────────────────────────────────────────
  _removeOverlay() {
    const el = document.getElementById('onboarding-overlay');
    const card = document.getElementById('onboarding-card');
    const hl = document.getElementById('onboarding-highlight');
    if (el)   el.remove();
    if (card) card.remove();
    if (hl)   hl.remove();
  },

  // ── Próximo passo ─────────────────────────────────────────────
  next() {
    if (this._current < this._steps_list.length - 1) {
      this._current++;
      this._render();
    } else {
      this.finish();
    }
  },

  // ── Passo anterior ────────────────────────────────────────────
  prev() {
    if (this._current > 0) {
      this._current--;
      this._render();
    }
  },

  // ── Pular tutorial ────────────────────────────────────────────
  skip() {
    this.finish();
  },

  // ── Concluir tutorial ─────────────────────────────────────────
  finish() {
    this._removeOverlay();
    if (this._userId) {
      localStorage.setItem('ges_onboarding_done_' + this._userId, '1');
    }
  },

  // ── Ver tutorial novamente (acessível via configurações) ──────
  restart(user) {
    if (!user || !user.id) return;
    localStorage.removeItem('ges_onboarding_done_' + user.id);
    this.start(user);
  },
};
