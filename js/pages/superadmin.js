// =============================================
//  GESTESCOLAR SaaS – PAINEL SUPER ADMIN GLOBAL
// =============================================

Router.register('superadmin-dashboard', () => {
  const user = Auth.require(); if (!user || user.role !== 'superadmin') { Router.go('login'); return; }
  const stats    = DB.globalStats();
  const schools  = DB.getSchools();
  const payments = DB.getSaasPayments();
  const revenue  = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  // ── KPIs de negócio ───────────────────────────────────────────────────
  const now       = Date.now();
  const in7days   = now + 7  * 86400000;
  const in30days  = now + 30 * 86400000;

  const activeSchools   = schools.filter(s => (s.schoolStatus || s.status) === 'active');
  const trialSchools    = schools.filter(s => (s.schoolStatus || s.status) === 'trial');
  const blockedSchools  = schools.filter(s => ['blocked','overdue'].includes(s.schoolStatus || s.status));
  const expiringSchools = schools.filter(s => {
    // Se tem trialEndsAt no banco, usa direto
    // Se não tem mas é trial, calcula createdAt + 7 dias (trial dinâmico)
    const status = s.schoolStatus || s.status;
    const trialEnd = s.trialEndsAt
      ? new Date(s.trialEndsAt).getTime()
      : (status === 'trial' && s.createdAt)
        ? new Date(s.createdAt).getTime() + 7 * 86400000
        : null;
    const planExp = s.planExpiresAt ? new Date(s.planExpiresAt).getTime() : null;

    const expireDate = trialEnd || planExp;
    if (!expireDate) return false;

    return expireDate > now && expireDate <= in7days;
  });

  // MRR estimado: soma dos preços dos planos ativos pagantes (exclui trial/free)
  const mrr = activeSchools.reduce((acc, s) => {
    const plan = Plans.get(s.planId || 'free');
    const price = plan?.price || 0;
    if (!price) return acc;
    // Plano anual divide por 12 para MRR
    return acc + (s.billingCycle === 'annual' ? price / 12 : price);
  }, 0);

  // Conversão trial → pago (últimos 30 dias)
  const recentConverted = schools.filter(s => {
    if ((s.schoolStatus || s.status) !== 'active') return false;
    if (!s.planExpiresAt) return false;
    const created = s.createdAt ? new Date(s.createdAt).getTime() : 0;
    return (now - created) <= in30days;
  }).length;

  Router.renderLayout(user, 'superadmin-dashboard', `
    <!-- ── Cabeçalho ─────────────────────────────────────────── -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="margin:0;"><i class="fa-solid fa-crown" style="color:#f9a825;margin-right:8px;"></i>Painel Administrativo Global</h2>
        <p style="color:var(--text-muted);font-size:13px;margin:4px 0 0;">Visão geral de todas as escolas da plataforma</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" onclick="Router.go('superadmin-dashboard')" title="Atualizar dados">
          <i class="fa-solid fa-rotate-right"></i> Atualizar
        </button>
        <button class="btn btn-primary btn-sm" onclick="SuperAdmin.newSchool()">
          <i class="fa-solid fa-plus"></i> Nova Escola
        </button>
      </div>
    </div>

    <!-- ── KPIs Linha 1: Saúde da base ───────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:16px;">
      <!-- Escolas Ativas -->
      <div class="stat-card" style="cursor:pointer;border-left:4px solid #2e7d32;" onclick="SuperAdmin._filterTable('active')">
        <div class="stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
        <div>
          <div class="stat-value" style="color:#2e7d32;">${activeSchools.length}</div>
          <div class="stat-label">Ativas</div>
        </div>
      </div>
      <!-- Em Trial -->
      <div class="stat-card" style="cursor:pointer;border-left:4px solid #1565c0;" onclick="SuperAdmin._filterTable('trial')">
        <div class="stat-icon blue"><i class="fa-solid fa-hourglass-half"></i></div>
        <div>
          <div class="stat-value" style="color:#1565c0;">${trialSchools.length}</div>
          <div class="stat-label">Em Trial</div>
        </div>
      </div>
      <!-- Bloqueadas -->
      <div class="stat-card" style="cursor:pointer;border-left:4px solid #c62828;" onclick="SuperAdmin._filterTable('blocked')">
        <div class="stat-icon" style="background:#ffebee;"><i class="fa-solid fa-ban" style="color:#c62828;"></i></div>
        <div>
          <div class="stat-value" style="color:#c62828;">${blockedSchools.length}</div>
          <div class="stat-label">Bloqueadas</div>
        </div>
      </div>
      <!-- Vencendo em 7 dias -->
      <div class="stat-card" style="cursor:pointer;border-left:4px solid #e65100;${expiringSchools.length > 0 ? 'background:#fff8e1;' : ''}" onclick="SuperAdmin.showExpiringModal()">
        <div class="stat-icon yellow"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div>
          <div class="stat-value" style="color:#e65100;">${expiringSchools.length}</div>
          <div class="stat-label">Vencem em 7 dias</div>
          ${expiringSchools.length > 0 ? `<div style="font-size:10px;color:#e65100;margin-top:2px;font-weight:600;">Clique para ver</div>` : ''}
        </div>
      </div>
      <!-- Total de escolas -->
      <div class="stat-card" style="cursor:pointer;" onclick="SuperAdmin._filterTable('all')">
        <div class="stat-icon purple"><i class="fa-solid fa-school"></i></div>
        <div>
          <div class="stat-value">${schools.length}</div>
          <div class="stat-label">Total de Escolas</div>
        </div>
      </div>
    </div>

    <!-- ── KPIs Linha 2: Financeiro + Operacional ─────────────── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
      <!-- MRR -->
      <div style="background:linear-gradient(135deg,#1a73e8,#0d47a1);border-radius:12px;padding:20px;color:#fff;display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(255,255,255,.2);border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;">
          <i class="fa-solid fa-arrow-trend-up"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:900;">${Utils.currency(mrr)}</div>
          <div style="font-size:12px;opacity:.85;">MRR Estimado</div>
        </div>
      </div>
      <!-- Receita Acumulada -->
      <div style="background:linear-gradient(135deg,#2e7d32,#1b5e20);border-radius:12px;padding:20px;color:#fff;display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(255,255,255,.2);border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;">
          <i class="fa-solid fa-sack-dollar"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:900;">${Utils.currency(revenue)}</div>
          <div style="font-size:12px;opacity:.85;">Receita Acumulada</div>
        </div>
      </div>
      <!-- Alunos -->
      <div style="background:linear-gradient(135deg,#6a1b9a,#4a148c);border-radius:12px;padding:20px;color:#fff;display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(255,255,255,.2);border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;">
          <i class="fa-solid fa-user-graduate"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:900;">${stats.totalStudents}</div>
          <div style="font-size:12px;opacity:.85;">Alunos na Plataforma</div>
        </div>
      </div>
      <!-- Conversões recentes -->
      <div style="background:linear-gradient(135deg,#f57c00,#e65100);border-radius:12px;padding:20px;color:#fff;display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(255,255,255,.2);border-radius:10px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:20px;">
          <i class="fa-solid fa-user-check"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:900;">${recentConverted}</div>
          <div style="font-size:12px;opacity:.85;">Ativações (30 dias)</div>
        </div>
      </div>
    </div>

    <!-- ── Distribuição por Plano ─────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-bottom:24px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-chart-pie"></i> Distribuição por Plano</span>
        </div>
        <div style="padding:16px;">
          ${Plans.getAll().map(p => {
            const total = schools.length;
            const count = schools.filter(s => (s.planId||'free') === p.id).length;
            const pct   = total > 0 ? Math.round(count / total * 100) : 0;
            const planMrr = count * (p.price || 0);
            return `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:600;font-size:13px;">${Utils.escape(p.name)}</span>
                <div style="display:flex;gap:8px;align-items:center;">
                  ${planMrr > 0 ? `<span style="font-size:11px;color:var(--text-muted);">${Utils.currency(planMrr)}/mês</span>` : ''}
                  <span style="font-size:12px;font-weight:700;">${count}</span>
                </div>
              </div>
              <div style="height:6px;border-radius:3px;background:var(--border);overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px;transition:width .4s;"></div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Resumo de usuários -->
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-users"></i> Usuários na Plataforma</span>
        </div>
        <div style="padding:20px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div style="text-align:center;padding:16px;background:var(--bg-secondary,#f8f9fa);border-radius:10px;">
              <div style="font-size:28px;font-weight:900;color:var(--primary);">${stats.totalStudents}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fa-solid fa-user-graduate" style="margin-right:4px;"></i>Alunos</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--bg-secondary,#f8f9fa);border-radius:10px;">
              <div style="font-size:28px;font-weight:900;color:#6a1b9a;">${stats.totalTeachers}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fa-solid fa-chalkboard-teacher" style="margin-right:4px;"></i>Professores</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--bg-secondary,#f8f9fa);border-radius:10px;">
              <div style="font-size:28px;font-weight:900;color:#2e7d32;">${stats.totalUsers - stats.totalStudents - stats.totalTeachers}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fa-solid fa-user-gear" style="margin-right:4px;"></i>Gestores/Staff</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--bg-secondary,#f8f9fa);border-radius:10px;">
              <div style="font-size:28px;font-weight:900;color:#e65100;">${stats.totalUsers}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px;"><i class="fa-solid fa-users" style="margin-right:4px;"></i>Total</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Lista de Escolas com Filtros ───────────────────────── -->
    <div class="card" id="sa-schools-card">
      <div class="card-header" style="flex-wrap:wrap;gap:8px;">
        <span class="card-title"><i class="fa-solid fa-school"></i> Escolas Cadastradas</span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <!-- Filtros rápidos -->
          <div style="display:flex;gap:4px;background:var(--bg-secondary,#f5f5f5);border-radius:8px;padding:3px;">
            <button id="sa-filter-all"      class="sa-filter-btn sa-filter-active" onclick="SuperAdmin._filterTable('all')">Todos <span class="badge badge-blue" style="font-size:10px;">${schools.length}</span></button>
            <button id="sa-filter-active"   class="sa-filter-btn" onclick="SuperAdmin._filterTable('active')">Ativos <span class="badge badge-green" style="font-size:10px;">${activeSchools.length}</span></button>
            <button id="sa-filter-trial"    class="sa-filter-btn" onclick="SuperAdmin._filterTable('trial')">Trial <span class="badge badge-blue" style="font-size:10px;">${trialSchools.length}</span></button>
            <button id="sa-filter-blocked"  class="sa-filter-btn" onclick="SuperAdmin._filterTable('blocked')">Bloqueadas <span class="badge badge-red" style="font-size:10px;">${blockedSchools.length}</span></button>
            <button id="sa-filter-expiring" class="sa-filter-btn" onclick="SuperAdmin._filterTable('expiring')"${expiringSchools.length > 0 ? ' style="color:#e65100;font-weight:700;"' : ''}>⚠ Vencendo <span class="badge" style="background:#fff3e0;color:#e65100;font-size:10px;">${expiringSchools.length}</span></button>
          </div>
          <!-- Busca -->
          <div style="position:relative;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:12px;pointer-events:none;"></i>
            <input id="sa-search" type="text" placeholder="Buscar escola..." oninput="SuperAdmin._searchTable(this.value)"
              style="padding:6px 10px 6px 30px;border:1px solid var(--border);border-radius:6px;font-size:13px;width:200px;background:var(--bg);color:var(--text);">
          </div>
          <button class="btn btn-primary btn-sm" onclick="SuperAdmin.newSchool()">
            <i class="fa-solid fa-plus"></i> Nova Escola
          </button>
        </div>
      </div>

      ${schools.length === 0
        ? `<div class="empty-state"><i class="fa-solid fa-school"></i><p>Nenhuma escola cadastrada.</p></div>`
        : `<div style="overflow-x:auto;">
            <table class="data-table" id="sa-schools-table">
              <thead><tr>
                <th>Escola</th>
                <th>Plano</th>
                <th>Alunos</th>
                <th>Comissão</th>
                <th>Asaas</th>
                <th>Status</th>
                <th>Vencimento</th>
                <th>Ações</th>
              </tr></thead>
              <tbody id="sa-schools-tbody">
                ${schools.map(s => {
                  const prev    = DB._schoolId;
                  DB.setTenant(s.id);
                  const stCount = DB.getStudents().length;
                  const plan    = Plans.get(s.planId || 'free');
                  DB.setTenant(prev);

                  const status      = s.schoolStatus || s.status || 'active';
                  const expiresAt   = s.planExpiresAt ? new Date(s.planExpiresAt) : null;
                  const expTs       = expiresAt ? expiresAt.getTime() : 0;
                  const isExpiring  = expTs > now && expTs <= in7days && status === 'active';
                  const isExpired   = expTs > 0 && expTs < now && status !== 'trial';
                  const daysLeft    = expTs ? Math.ceil((expTs - now) / 86400000) : null;

                  // data-* para filtro JS
                  const dataStatus  = ['blocked','overdue'].includes(status) ? 'blocked'
                                    : status === 'trial' ? 'trial'
                                    : isExpiring ? 'expiring'
                                    : 'active';

                  let expiryHtml = '--';
                  if (expiresAt) {
                    const dateStr = expiresAt.toLocaleDateString('pt-BR');
                    if (isExpired) {
                      expiryHtml = `<span style="color:#c62828;font-weight:700;font-size:12px;"><i class="fa-solid fa-circle-exclamation"></i> ${dateStr}<br><small>Vencido</small></span>`;
                    } else if (isExpiring) {
                      expiryHtml = `<span style="color:#e65100;font-weight:700;font-size:12px;"><i class="fa-solid fa-triangle-exclamation"></i> ${dateStr}<br><small>${daysLeft}d restantes</small></span>`;
                    } else {
                      expiryHtml = `<span style="font-size:12px;">${dateStr}${daysLeft != null && daysLeft <= 30 ? `<br><small style="color:var(--text-muted);">${daysLeft}d</small>` : ''}</span>`;
                    }
                  } else if (status === 'trial') {
                    const trialStart = s.trialStartedAt ? new Date(s.trialStartedAt).getTime() : 0;
                    const trialEnd   = trialStart + 7 * 86400000;
                    const trialDays  = trialStart ? Math.max(0, Math.ceil((trialEnd - now) / 86400000)) : '?';
                    expiryHtml = `<span style="color:#1565c0;font-size:12px;"><i class="fa-solid fa-hourglass-half"></i> Trial<br><small>${trialDays}d restantes</small></span>`;
                  }

                  return `<tr data-status="${dataStatus}" data-name="${Utils.escape((s.name||'').toLowerCase())}">
                    <td>
                      <strong>${Utils.escape(s.name)}</strong>
                      <br><span style="font-size:11px;color:var(--text-muted);">${Utils.escape(s.email||'')}</span>
                      ${isExpiring ? '<br><span class="badge" style="background:#fff3e0;color:#e65100;font-size:10px;margin-top:2px;">⚠ Vence em breve</span>' : ''}
                    </td>
                    <td><span class="badge badge-blue">${Utils.escape(plan.name)}</span></td>
                    <td>${stCount} / ${s.customStudentLimit ? s.customStudentLimit + ' <i class="fa-solid fa-star" style="color:#f39c12;font-size:10px;" title="Limite personalizado"></i>' : (plan.limits?.students===Infinity?'∞':plan.limits?.students??'--')}</td>
                    <td><span class="badge badge-blue">${s.commissionRate != null ? s.commissionRate : 3}%</span></td>
                    <td>${s.asaasWalletId
                      ? `<span class="badge badge-green" title="${Utils.escape(s.asaasWalletId)}"><i class="fa-solid fa-check"></i> Ativo</span>`
                      : `<button class="btn btn-sm btn-outline" onclick="SuperAdmin.createAsaasAccount('${s.id}')" style="font-size:10px;padding:2px 8px;">Criar</button>`}
                    </td>
                    <td>${Utils.statusBadge(status)}</td>
                    <td>${expiryHtml}</td>
                    <td style="white-space:nowrap;">
                      <button class="btn btn-outline btn-sm" onclick="SuperAdmin.viewSchool('${s.id}')" title="Ver detalhes"><i class="fa-solid fa-eye"></i></button>
                      <button class="btn btn-outline btn-sm" onclick="SuperAdmin.editSchool('${s.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                      <button class="btn btn-sm" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d;" onclick="SuperAdmin.resetSchoolPassword('${s.id}')" title="Resetar senha do gestor"><i class="fa-solid fa-key"></i></button>
                      <button class="btn btn-sm" style="background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8;" onclick="SuperAdmin.simulateExpiration('${s.id}')" title="Simular vencimento (teste)"><i class="fa-solid fa-flask"></i></button>
                      <button class="btn btn-sm" style="background:#e1f5fe;color:#01579b;border:1px solid #81d4fa;" onclick="SuperAdmin.simulatePayment('${s.id}')" title="Simular pagamento confirmado"><i class="fa-solid fa-envelope-circle-check"></i></button>
                      ${s.trialEndsAt || s.planExpiresAt ? `<button class="btn btn-sm" style="background:#fff9c4;color:#f57f17;border:1px solid #fff176;" onclick="SuperAdmin.sendExpiryWarning('${s.id}')" title="Enviar aviso de vencimento"><i class="fa-solid fa-bell"></i></button>` : ''}
                      <button class="btn btn-sm" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;" onclick="SuperAdmin.deleteSchool('${s.id}')" title="Excluir escola"><i class="fa-solid fa-trash"></i></button>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
            <div id="sa-empty-filter" style="display:none;" class="empty-state">
              <i class="fa-solid fa-filter-circle-xmark"></i>
              <p>Nenhuma escola encontrada para este filtro.</p>
            </div>
          </div>`}
    </div>

    <style>
      .sa-filter-btn {
        background: none; border: none; padding: 5px 10px; border-radius: 6px;
        font-size: 12px; cursor: pointer; color: var(--text-muted); transition: all .15s;
      }
      .sa-filter-btn:hover { background: var(--bg); color: var(--text); }
      .sa-filter-active { background: #fff !important; color: var(--primary) !important; font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
      .badge-red { background: #ffebee; color: #c62828; }
    </style>
  `);

  // Inicializar filtro com 'all' e destacar escolas a vencer
  setTimeout(() => SuperAdmin._filterTable('all'), 0);
});

// ── Lista Global de Alunos ─────────────────────────────────────────────
Router.register('superadmin-students', () => {
  const user = Auth.require(); if (!user || user.role !== 'superadmin') { Router.go('login'); return; }
  const schools = DB.getSchools();
  const schoolMap = {};
  schools.forEach(s => { schoolMap[s.id] = s; });

  // Indexar turmas globalmente (class_id -> { name, level })
  const classMap = {};
  DB._cache.classes.forEach(c => { classMap[c.id] = c; });

  // Agrupar todos os usuarios 'pai' por studentId para descobrir o login do responsavel
  const parentByStudent = {};
  DB._cache.users.forEach(u => {
    if (u.role === 'pai' && u.studentId) {
      parentByStudent[u.studentId] = u;
    }
  });

  // Todos os alunos de todas as escolas, ordenados por matricula ASC
  const allStudents = [...DB._cache.students]
    .sort((a, b) => {
      const ma = String(a.matricula || '');
      const mb = String(b.matricula || '');
      return ma.localeCompare(mb, undefined, { numeric: true });
    });

  // Filtro de busca (client-side)
  const rows = allStudents.map(s => {
    const sc = schoolMap[s.schoolId];
    const cl = s.classId ? classMap[s.classId] : null;
    const parent = parentByStudent[s.id];
    const login = s.matricula || s.loginMatricula || '--';
    const senha = parent ? '••••••' : '--';
    return {
      id:        s.id,
      name:      s.name || '--',
      school:    sc?.name || '(escola removida)',
      serie:     cl?.level || '--',
      turma:     cl?.name  || '--',
      matricula: s.matricula || '--',
      login,
      senha,
      status:    s.status || 'ativo',
    };
  });

  Router.renderLayout(user, 'superadmin-students', `
    <div style="margin-bottom:20px;">
      <h2 style="margin:0;"><i class="fa-solid fa-user-graduate" style="color:var(--primary);margin-right:8px;"></i>Alunos (Global)</h2>
      <p style="color:var(--text-muted);font-size:13px;">Lista consolidada de todos os alunos cadastrados em todas as escolas, ordenada por matrícula.</p>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-list"></i> Alunos Cadastrados</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="saStudentsSearch" class="form-control" placeholder="Buscar por nome, matrícula, escola..." style="width:280px;font-size:13px;" oninput="SuperAdmin.filterStudents(this.value)" />
          <span class="badge badge-blue" id="saStudentsCount">${rows.length} aluno(s)</span>
        </div>
      </div>
      ${rows.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-user-graduate"></i><p>Nenhum aluno cadastrado em nenhuma escola.</p></div>'
        : `<div style="overflow-x:auto;">
            <table class="data-table" id="saStudentsTable">
              <thead><tr>
                <th>Matrícula</th>
                <th>Nome</th>
                <th>Escola</th>
                <th>Série</th>
                <th>Turma</th>
                <th>Login</th>
                <th>Acesso</th>
                <th>Status</th>
              </tr></thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td><strong style="font-family:monospace;color:var(--primary);">${Utils.escape(r.matricula)}</strong></td>
                  <td><strong>${Utils.escape(r.name)}</strong></td>
                  <td>${Utils.escape(r.school)}</td>
                  <td>${Utils.escape(r.serie)}</td>
                  <td>${Utils.escape(r.turma)}</td>
                  <td style="font-family:monospace;font-size:12px;">${Utils.escape(r.login)}</td>
                  <td style="font-family:monospace;font-size:12px;color:var(--text-muted);">${Utils.escape(r.senha)}</td>
                  <td>${Utils.statusBadge(r.status)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
    </div>
  `);
});

// ── Gest\u00e3o de Usu\u00e1rios Global ────────────────────────────────────────────
Router.register('superadmin-users', () => {
  const user = Auth.require(); if (!user || user.role !== 'superadmin') { Router.go('login'); return; }
  const schools = DB.getSchools();

  let allUsers = [];
  schools.forEach(s => {
    DB.setTenant(s.id);
    DB.getUsers().forEach(u => allUsers.push({...u, schoolName: s.name, schoolId: s.id}));
  });
  DB.setTenant(null);

  Router.renderLayout(user, 'superadmin-users', `
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-users"></i> Todos os Usu\u00e1rios</span>
        <span class="badge badge-blue">${allUsers.length} usu\u00e1rio(s)</span>
      </div>
      ${allUsers.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-users"></i><p>Nenhum usu\u00e1rio.</p></div>'
        : `<div style="overflow-x:auto;"><table class="data-table"><thead><tr>
            <th>Nome</th><th>E-mail</th><th>Perfil</th><th>Escola</th><th>Status</th>
          </tr></thead><tbody>
            ${allUsers.map(u => `<tr>
              <td><strong>${Utils.escape(u.name)}</strong></td>
              <td>${Utils.escape(u.email)}</td>
              <td><span class="badge badge-${Auth.roleBadgeColor(u.role)}">${Auth.roleLabel(u.role)}</span></td>
              <td>${Utils.escape(u.schoolName)}</td>
              <td>${u.active !== false ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-gray">Inativo</span>'}</td>
            </tr>`).join('')}
          </tbody></table></div>`}
    </div>
  `);
});

// ── Pagamentos SaaS — Dashboard Financeiro ──────────────────────────────
Router.register('superadmin-payments', () => {
  const user = Auth.require(); if (!user || user.role !== 'superadmin') { Router.go('login'); return; }

  const schools  = DB.getSchools();
  const allInv   = DB._cache.invoices;
  const pagas    = allInv.filter(i => i.status === 'pago' || i.status === 'paid');

  // ── Movimentacoes: bruto de todas as mensalidades pagas ──
  const bruto = pagas.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

  // ── Mapa de comissao por escola (usa commissionRate individual, padrao 3%) ──
  const schoolMap = {};
  schools.forEach(s => { schoolMap[s.id] = s; });

  // ── % de Servico: taxa individual por escola sobre cada boleto pago ──
  const taxaServico = pagas.reduce((acc, i) => {
    const sc   = schoolMap[i.schoolId];
    const rate = (sc && sc.commissionRate != null ? parseFloat(sc.commissionRate) : 3) / 100;
    return acc + ((parseFloat(i.amount) || 0) * rate);
  }, 0);

  // ── Mensalidades: soma das contratacoes dos planos das escolas ativas ──
  const mensalidadesPlanos = schools
    .filter(s => (s.status || 'active') === 'active')
    .reduce((acc, s) => {
      const plan = Plans.get(s.planId || 'free');
      return acc + (plan.price || 0);
    }, 0);

  // ── Totais por escola (para tabela detalhada) ──
  const porEscola = schools.map(s => {
    const rate  = (s.commissionRate != null ? parseFloat(s.commissionRate) : 3);
    const inv   = allInv.filter(i => i.schoolId === s.id);
    const pg    = inv.filter(i => i.status === 'pago' || i.status === 'paid');
    const pend  = inv.filter(i => i.status === 'pendente');
    const brutoE = pg.reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);
    const plan   = Plans.get(s.planId || 'free');
    return { school: s, plan, rate, totalInv: inv.length, pagas: pg.length, pendentes: pend.length, bruto: brutoE, taxa: brutoE * (rate / 100) };
  }).sort((a, b) => b.bruto - a.bruto);

  // ── Pagamentos SaaS (historico) ──
  const payments = DB.getSaasPayments().sort((a,b) => new Date(b.date)-new Date(a.date));

  Router.renderLayout(user, 'superadmin-payments', `
    <div style="margin-bottom:24px;">
      <h2 style="margin:0;"><i class="fa-solid fa-chart-line" style="color:var(--primary);margin-right:8px;"></i>Dashboard Financeiro</h2>
      <p style="color:var(--text-muted);font-size:13px;">Visao consolidada de receitas da plataforma.</p>
    </div>

    <!-- Cards KPI -->
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-card" style="border-left:4px solid var(--primary);">
        <div class="stat-icon blue"><i class="fa-solid fa-percent"></i></div>
        <div>
          <div class="stat-value" style="color:var(--primary);">${Utils.currency(taxaServico)}</div>
          <div class="stat-label">% de Servico (Comissao)</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Taxa individual sobre ${pagas.length} boleto(s) pago(s)</div>
        </div>
      </div>
      <div class="stat-card" style="border-left:4px solid var(--secondary);">
        <div class="stat-icon green"><i class="fa-solid fa-file-invoice-dollar"></i></div>
        <div>
          <div class="stat-value" style="color:var(--secondary);">${Utils.currency(mensalidadesPlanos)}</div>
          <div class="stat-label">Mensalidades (Planos)</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${schools.filter(s=>(s.status||'active')==='active').length} escola(s) ativa(s)</div>
        </div>
      </div>
      <div class="stat-card" style="border-left:4px solid #ff9800;">
        <div class="stat-icon yellow"><i class="fa-solid fa-money-bill-wave"></i></div>
        <div>
          <div class="stat-value" style="color:#ff9800;">${Utils.currency(bruto)}</div>
          <div class="stat-label">Movimentacoes (Bruto)</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Total faturado em mensalidades pagas</div>
        </div>
      </div>
    </div>

    <!-- Resumo por Escola -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-school"></i> Receita por Escola</span>
      </div>
      ${porEscola.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-school"></i><p>Nenhuma escola cadastrada.</p></div>'
        : `<div style="overflow-x:auto;"><table class="data-table"><thead><tr>
            <th>Escola</th><th>Plano</th><th>Boletos</th><th>Pagos</th><th>Pendentes</th><th>Bruto</th><th>Taxa</th><th>Valor Taxa</th>
          </tr></thead><tbody>
            ${porEscola.map(r => `<tr>
              <td><strong>${Utils.escape(r.school.name)}</strong></td>
              <td><span class="badge badge-blue">${Utils.escape(r.plan.name)}</span></td>
              <td>${r.totalInv}</td>
              <td><span class="badge badge-green">${r.pagas}</span></td>
              <td>${r.pendentes > 0 ? `<span class="badge badge-yellow">${r.pendentes}</span>` : '0'}</td>
              <td style="font-weight:700;color:var(--secondary);">${Utils.currency(r.bruto)}</td>
              <td><span class="badge badge-blue">${r.rate}%</span></td>
              <td style="font-weight:700;color:var(--primary);">${Utils.currency(r.taxa)}</td>
            </tr>`).join('')}
            <tr style="background:#f8f9fa;font-weight:800;">
              <td colspan="6" style="text-align:right;">TOTAL</td>
              <td></td>
              <td style="color:var(--primary);">${Utils.currency(taxaServico)}</td>
            </tr>
          </tbody></table></div>`}
    </div>

    <!-- Historico de Pagamentos SaaS -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-credit-card"></i> Historico de Pagamentos SaaS</span>
        <span style="font-size:14px;font-weight:700;color:var(--secondary);">Total: ${Utils.currency(payments.reduce((a,p)=>a+(p.amount||0),0))}</span>
      </div>
      ${payments.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-credit-card"></i><p>Nenhum pagamento registrado.</p></div>'
        : `<div style="overflow-x:auto;"><table class="data-table"><thead><tr>
            <th>Data</th><th>Escola</th><th>Plano</th><th>Valor</th><th>Status</th>
          </tr></thead><tbody>
            ${payments.map(p => `<tr>
              <td>${Utils.datetime(p.date)}</td>
              <td>${Utils.escape(p.schoolName||'--')}</td>
              <td>${Utils.escape(p.planName||'--')}</td>
              <td style="font-weight:700;color:var(--secondary);">${Utils.currency(p.amount)}</td>
              <td>${Utils.statusBadge(p.status||'pago')}</td>
            </tr>`).join('')}
          </tbody></table></div>`}
    </div>
  `);
});

// ── Perfil Super Admin ───────────────────────────────────────────────────
Router.register('superadmin-profile', () => {
  const user = Auth.require(); if (!user || user.role !== 'superadmin') { Router.go('login'); return; }
  const su = DB.getSuperUsers().find(u => u.id === user.id) || user;

  Router.renderLayout(user, 'superadmin-profile', `
    <div style="display:flex;flex-direction:column;gap:20px;max-width:500px;">
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-user-gear"></i> Meu Perfil</span></div>
        <form onsubmit="SuperAdmin.saveProfile(event)" style="padding:16px;">
          <div class="form-group">
            <label class="form-label">Nome *</label>
            <input class="form-control" id="suName" value="${Utils.escape(su.name)}" required data-mask="name" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail *</label>
            <input type="email" class="form-control" id="suEmail" value="${Utils.escape(su.email)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nova Senha (deixe em branco para manter)</label>
            <input type="password" class="form-control" id="suPass" placeholder="******" />
          </div>
          <button type="submit" class="btn btn-primary w-100"><i class="fa-solid fa-floppy-disk"></i> Salvar</button>
        </form>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-circle-question"></i> Ajuda</span></div>
        <div style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px;">Tutorial do sistema</div>
            <div style="font-size:13px;color:var(--text-muted);">Rever o tour guiado com as principais funcionalidades.</div>
          </div>
          <button class="btn btn-secondary" onclick="Onboarding.restart(Auth.current())" style="white-space:nowrap;">
            <i class="fa-solid fa-circle-play"></i> Ver tutorial
          </button>
        </div>
      </div>
    </div>
  `);
});

const SuperAdmin = {

  // ── Filtro e busca da tabela de escolas ──────────────────────────────
  _currentFilter: 'all',

  _filterTable(filter) {
    SuperAdmin._currentFilter = filter;
    // Atualizar botões ativos
    ['all','active','trial','blocked','expiring'].forEach(f => {
      const btn = document.getElementById('sa-filter-' + f);
      if (btn) btn.classList.toggle('sa-filter-active', f === filter);
    });
    // Aplicar filtro + busca juntos
    const q = (document.getElementById('sa-search')?.value || '').toLowerCase().trim();
    SuperAdmin._applyFilters(filter, q);
  },

  _searchTable(q) {
    SuperAdmin._applyFilters(SuperAdmin._currentFilter, (q||'').toLowerCase().trim());
  },

  _applyFilters(filter, q) {
    const tbody = document.getElementById('sa-schools-tbody');
    const empty = document.getElementById('sa-empty-filter');
    if (!tbody) return;
    let visible = 0;
    tbody.querySelectorAll('tr').forEach(row => {
      const status = row.dataset.status || 'active';
      const name   = row.dataset.name   || '';
      const matchFilter = filter === 'all' || status === filter;
      const matchSearch = !q || name.includes(q);
      const show = matchFilter && matchSearch;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
  },

  filterStudents(q) {
    const term = (q || '').trim().toLowerCase();
    const tbody = document.querySelector('#saStudentsTable tbody');
    if (!tbody) return;
    let visible = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      const txt = tr.textContent.toLowerCase();
      const show = !term || txt.includes(term);
      tr.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    const badge = document.getElementById('saStudentsCount');
    if (badge) badge.textContent = `${visible} aluno(s)`;
  },

  newSchool() {
    Utils.modal('Nova Escola',
      `<form onsubmit="SuperAdmin.createSchool(event)">
        <div class="form-group"><label class="form-label">Nome da Escola *</label><input class="form-control" id="saSchoolName" required maxlength="100" /></div>
        <div class="form-group"><label class="form-label">CNPJ *</label><input class="form-control" id="saSchoolCnpj" required data-mask="cnpj" maxlength="18" placeholder="00.000.000/0000-00" /></div>
        <div class="form-group"><label class="form-label">E-mail *</label><input class="form-control" id="saSchoolEmail" type="email" required /></div>
        <div class="form-group"><label class="form-label">Telefone *</label><input class="form-control" id="saSchoolPhone" data-mask="phone" maxlength="15" inputmode="numeric" placeholder="(00) 00000-0000" required /></div>
        <div class="form-group"><label class="form-label">CEP</label><input class="form-control" id="saSchoolPostalCode" placeholder="00000-000" /></div>
        <div class="form-group"><label class="form-label">Endereço</label><input class="form-control" id="saSchoolAddress" placeholder="Rua, Avenida..." /></div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1;"><label class="form-label">Número</label><input class="form-control" id="saSchoolAddressNumber" placeholder="Nº" /></div>
          <div class="form-group" style="flex:2;"><label class="form-label">Complemento</label><input class="form-control" id="saSchoolComplement" placeholder="Sala, Bloco..." /></div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:2;"><label class="form-label">Bairro</label><input class="form-control" id="saSchoolProvince" /></div>
          <div class="form-group" style="flex:2;"><label class="form-label">Cidade</label><input class="form-control" id="saSchoolCity" /></div>
          <div class="form-group" style="flex:1;"><label class="form-label">UF</label><input class="form-control" id="saSchoolState" maxlength="2" placeholder="SP" /></div>
        </div>
        <div class="form-group"><label class="form-label">Plano</label>
          <select class="form-control" id="saSchoolPlan">
            ${Plans.getAll().map(p => `<option value="${p.id}">${p.name} \u2013 ${p.price===0?'Gr\u00e1tis':Utils.currency(p.price)+'/m\u00eas'}</option>`).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary w-100">Criar Escola</button>
      </form>`, '');
  },

  async createSchool(e) {
    e.preventDefault();
    const name        = document.getElementById('saSchoolName').value.trim();
    const cnpj        = document.getElementById('saSchoolCnpj').value.trim();
    const email       = document.getElementById('saSchoolEmail').value.trim();
    const phone       = document.getElementById('saSchoolPhone').value.trim();
    const postalCode  = document.getElementById('saSchoolPostalCode').value.trim();
    const address     = document.getElementById('saSchoolAddress').value.trim();
    const addressNumber = document.getElementById('saSchoolAddressNumber').value.trim();
    const complement  = document.getElementById('saSchoolComplement').value.trim();
    const province    = document.getElementById('saSchoolProvince').value.trim();
    const city        = document.getElementById('saSchoolCity').value.trim();
    const state       = document.getElementById('saSchoolState').value.trim().toUpperCase();
    const plan        = document.getElementById('saSchoolPlan').value;
    if (!name) { Utils.toast('Informe o nome da escola.', 'error'); return; }

    // Criar escola no banco
    const school = DB.addSchool({ name, cnpj, email, phone, planId: plan, ownerId: null, postalCode, address, addressNumber, complement, province, city, state });
    DB.initSchool(school.id);
    DB.setTenant(school.id);
    DB.saveSchoolConfig({ name, cnpj, phone, logo: '', address });
    DB.setTenant(null);
    document.querySelector('.modal-overlay')?.remove();
    Utils.toast('Escola criada! Criando subconta Asaas...', 'info');

    // Criar subconta Asaas automaticamente se dados suficientes
    if (cnpj && email && postalCode && address && addressNumber && province) {
      const result = await AsaasClient.createSubaccount({
        name, cpfCnpj: cnpj, email, phone,
        postalCode, address, addressNumber, complement, province, city, state,
      });
      if (result && (result.id || result.walletId)) {
        DB.updateSchool(school.id, {
          asaasAccountId: result.id || '',
          asaasWalletId: result.walletId || '',
        });
        Utils.toast(`Escola "${name}" criada com subconta Asaas ativa!`, 'success');
      } else {
        Utils.toast(`Escola criada, mas subconta Asaas falhou. Configure manualmente.`, 'warning');
      }
    } else {
      Utils.toast('Escola criada! Preencha o endereço completo para ativar o Asaas.', 'success');
    }

    Router.go('superadmin-dashboard');
  },

  viewSchool(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;
    DB.setTenant(schoolId);
    const students = DB.getStudents();
    const users    = DB.getUsers();
    const classes  = DB.getClasses();
    const bal      = DB.getBalance();
    DB.setTenant(null);
    const plan = Plans.get(school.planId || 'free');

    Utils.modal(`Detalhes – ${Utils.escape(school.name)}`,
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><strong>CNPJ:</strong> ${Utils.escape(school.cnpj||'--')}</div>
        <div><strong>E-mail:</strong> ${Utils.escape(school.email||'--')}</div>
        <div><strong>Telefone:</strong> ${Utils.escape(school.phone||'--')}</div>
        <div><strong>Plano:</strong> <span class="badge badge-blue">${Utils.escape(plan.name)}</span></div>
        <div><strong>Alunos:</strong> ${students.length} / ${plan.limits.students===Infinity?'ilimitado':plan.limits.students}</div>
        <div><strong>Usuarios:</strong> ${users.length}</div>
        <div><strong>Turmas:</strong> ${classes.length}</div>
        <div><strong>Saldo:</strong> ${Utils.currency(bal.amount)}</div>
        <div><strong>Criada em:</strong> ${Utils.date(school.createdAt)}</div>
        <div><strong>Status:</strong> ${Utils.statusBadge(school.status||'active')}</div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  },

  editSchool(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;
    Utils.modal(`Editar – ${Utils.escape(school.name)}`,
      `<form onsubmit="SuperAdmin.saveSchool(event,'${schoolId}')">
        <div class="form-group"><label class="form-label">Nome *</label><input class="form-control" id="esName" value="${Utils.escape(school.name)}" required maxlength="100" /></div>
        <div class="form-group"><label class="form-label">CNPJ *</label><input class="form-control" id="esCnpj" value="${Utils.escape(school.cnpj||'')}" required data-mask="cnpj" maxlength="18" /></div>
        <div class="form-group"><label class="form-label">E-mail *</label><input class="form-control" id="esEmail" value="${Utils.escape(school.email||'')}" type="email" required /></div>
        <div class="form-group"><label class="form-label">Telefone *</label><input class="form-control" id="esPhone" value="${Utils.escape(school.phone||'')}" data-mask="phone" maxlength="15" inputmode="numeric" required /></div>
        <div class="form-group"><label class="form-label">CEP</label><input class="form-control" id="esPostalCode" value="${Utils.escape(school.postalCode||'')}" placeholder="00000-000" /></div>
        <div class="form-group"><label class="form-label">Endereço</label><input class="form-control" id="esAddress" value="${Utils.escape(school.address||'')}" placeholder="Rua, Avenida..." /></div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1;"><label class="form-label">Número</label><input class="form-control" id="esAddressNumber" value="${Utils.escape(school.addressNumber||'')}" /></div>
          <div class="form-group" style="flex:2;"><label class="form-label">Complemento</label><input class="form-control" id="esComplement" value="${Utils.escape(school.complement||'')}" /></div>
        </div>
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:2;"><label class="form-label">Bairro</label><input class="form-control" id="esProvince" value="${Utils.escape(school.province||'')}" /></div>
          <div class="form-group" style="flex:2;"><label class="form-label">Cidade</label><input class="form-control" id="esCity" value="${Utils.escape(school.city||'')}" /></div>
          <div class="form-group" style="flex:1;"><label class="form-label">UF</label><input class="form-control" id="esState" value="${Utils.escape(school.state||'')}" maxlength="2" placeholder="SP" /></div>
        </div>
        <div class="form-group"><label class="form-label">Plano</label>
          <select class="form-control" id="esPlan">
            ${Plans.getAll().map(p => `<option value="${p.id}" ${(school.planId||'free')===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Limite personalizado de alunos (opcional)</label>
          <input type="number" class="form-control" id="esCustomLimit" min="0"
                 value="${school.customStudentLimit || ''}"
                 placeholder="Vazio = usa limite do plano" />
          <small style="color:var(--text-muted);font-size:11px;">
            Deixe vazio para usar o limite padr\u00e3o do plano. Preencha para definir um limite exclusivo (ex: 400).
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Comissao da plataforma (%)</label>
          <select class="form-control" id="esCommission">
            ${[3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${(school.commissionRate||3)==v?'selected':''}>${v}%</option>`).join('')}
          </select>
          <small style="color:var(--text-muted);font-size:11px;">
            Taxa da plataforma GestEscolar sobre cada pagamento. Escola recebe ${100 - (school.commissionRate||3)}%. Padrão: 3%.
          </small>
        </div>
        <div class="form-group">
          <label class="form-label">Chave PIX da escola</label>
          <input class="form-control" id="esPixKey" value="${Utils.escape(school.pixKey||'')}" placeholder="CPF, CNPJ, email ou chave aleatória" />
        </div>
        <div class="form-group">
          <label class="form-label">Asaas Wallet ID (split)</label>
          <input class="form-control" id="esWalletId" value="${Utils.escape(school.asaasWalletId||'')}" placeholder="Preenchido ao criar subconta Asaas" />
          <small style="color:var(--text-muted);font-size:11px;">ID da carteira Asaas para split automático de pagamentos.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Asaas API Key da Subconta</label>
          <input class="form-control" id="esSubApiKey" value="${Utils.escape(school.asaasSubApiKey||'')}" placeholder="$aact_... (obtida ao criar subconta)" />
          <small style="color:var(--text-muted);font-size:11px;">Chave da subconta usada para consultar saldo e solicitar resgates. Obtida automaticamente ao criar subconta.</small>
        </div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" id="esStatus">
            <option value="active" ${school.status==='active'?'selected':''}>Ativo</option>
            <option value="suspended" ${school.status==='suspended'?'selected':''}>Suspenso</option>
            <option value="canceled" ${school.status==='canceled'?'selected':''}>Cancelado</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary w-100">Salvar</button>
      </form>`, '');
  },

  saveSchool(e, schoolId) {
    e.preventDefault();
    const customLimit = document.getElementById('esCustomLimit').value.trim();
    const commission  = parseInt(document.getElementById('esCommission').value) || 3;
    DB.updateSchool(schoolId, {
      name:   document.getElementById('esName').value.trim(),
      cnpj:   document.getElementById('esCnpj').value.trim(),
      email:  document.getElementById('esEmail').value.trim(),
      phone:  document.getElementById('esPhone').value.trim(),
      postalCode: document.getElementById('esPostalCode').value.trim(),
      address: document.getElementById('esAddress').value.trim(),
      addressNumber: document.getElementById('esAddressNumber').value.trim(),
      complement: document.getElementById('esComplement').value.trim(),
      province: document.getElementById('esProvince').value.trim(),
      city: document.getElementById('esCity').value.trim(),
      state: document.getElementById('esState').value.trim().toUpperCase(),
      planId: document.getElementById('esPlan').value,
      status: document.getElementById('esStatus').value,
      customStudentLimit: customLimit ? parseInt(customLimit) : null,
      commissionRate: commission,
      pixKey: document.getElementById('esPixKey').value.trim(),
      asaasWalletId:  document.getElementById('esWalletId').value.trim()    || null,
      asaasSubApiKey: document.getElementById('esSubApiKey').value.trim()   || null,
    });
    document.querySelector('.modal-overlay')?.remove();
    Utils.toast('Escola atualizada!', 'success');
    Router.go('superadmin-dashboard');
  },

  deleteSchool(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;

    const prev = DB._schoolId;
    DB.setTenant(schoolId);
    const students = DB.getStudents();
    const invoices = DB.getInvoices();
    DB.setTenant(prev);

    const studentCount = students.length;
    const hasPix = invoices.some(i => i.status === 'pago' || i.status === 'paid');

    // Regra: se tem alunos E j\u00e1 houve pagamento, n\u00e3o pode excluir
    if (studentCount > 0 && hasPix) {
      Utils.modal(
        '<i class="fa-solid fa-shield-halved" style="color:#c62828;"></i> Exclus\u00e3o bloqueada',
        `<div style="text-align:center;padding:16px 0;">
          <i class="fa-solid fa-lock" style="font-size:48px;color:#c62828;margin-bottom:12px;display:block;"></i>
          <p style="font-size:15px;font-weight:700;margin-bottom:8px;">N\u00e3o \u00e9 poss\u00edvel excluir esta escola</p>
          <p style="font-size:13px;color:var(--text-muted);">
            A escola <strong>${Utils.escape(school.name)}</strong> possui <strong>${studentCount} aluno(s)</strong>
            e j\u00e1 registrou pagamentos. Por seguran\u00e7a, escolas com hist\u00f3rico financeiro n\u00e3o podem ser exclu\u00eddas.
          </p>
          <div style="background:#fff3cd;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#856404;">
            <i class="fa-solid fa-lightbulb"></i> Voc\u00ea pode <strong>suspender</strong> ou <strong>cancelar</strong> a escola em vez de excluir.
          </div>
        </div>`,
        `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Entendi</button>`
      );
      return;
    }

    // Pode excluir: confirmar com o usu\u00e1rio
    const msg = studentCount > 0
      ? `A escola <strong>${Utils.escape(school.name)}</strong> possui <strong>${studentCount} aluno(s)</strong> cadastrados, mas <strong>nenhum pagamento</strong> foi registrado.`
      : `A escola <strong>${Utils.escape(school.name)}</strong> n\u00e3o possui alunos cadastrados.`;

    Utils.modal(
      '<i class="fa-solid fa-triangle-exclamation" style="color:#c62828;"></i> Excluir Escola',
      `<div style="text-align:center;padding:16px 0;">
        <i class="fa-solid fa-trash" style="font-size:48px;color:#c62828;margin-bottom:12px;display:block;"></i>
        <p style="font-size:15px;font-weight:700;margin-bottom:8px;">Tem certeza que deseja excluir?</p>
        <p style="font-size:13px;color:var(--text-muted);">${msg}</p>
        <div style="background:#ffebee;border-radius:8px;padding:10px;margin-top:12px;font-size:12px;color:#c62828;">
          <i class="fa-solid fa-circle-exclamation"></i> Esta a\u00e7\u00e3o \u00e9 <strong>permanente</strong> e n\u00e3o pode ser desfeita.
          Todos os dados (usu\u00e1rios, turmas, notas, financeiro) ser\u00e3o removidos.
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn" style="background:#c62828;color:#fff;" onclick="SuperAdmin._confirmDelete('${schoolId}')">
         <i class="fa-solid fa-trash"></i> Excluir Definitivamente
       </button>`
    );
  },

  // ===== Simular vencimento do plano (ferramenta de teste) =====
  simulateExpiration(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;

    Utils.modal(
      '<i class="fa-solid fa-flask" style="color:#6a1b9a;"></i> Simular cen\u00e1rio de vencimento',
      `<div style="padding:8px 0;">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">
          Escolha um cen\u00e1rio para testar na escola <strong>${Utils.escape(school.name)}</strong>. A a\u00e7\u00e3o muda <code>plan_expires_at</code>, <code>school_status</code>, <code>billing</code> e <code>plan_id</code>.
        </p>
        <div style="display:grid;gap:8px;">
          <button class="btn" style="background:#fff3e0;color:#e65100;border:1px solid #ffb74d;text-align:left;padding:12px;" onclick="SuperAdmin._applyScenario('${schoolId}','warning7')">
            <strong>\ud83d\udfe0 Banner laranja</strong> \u2014 faltam 7 dias para vencer
          </button>
          <button class="btn" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;text-align:left;padding:12px;" onclick="SuperAdmin._applyScenario('${schoolId}','warning2')">
            <strong>\ud83d\udd34 Banner vermelho</strong> \u2014 faltam 2 dias (urgente)
          </button>
          <button class="btn" style="background:#fce4ec;color:#880e4f;border:1px solid #f48fb1;text-align:left;padding:12px;" onclick="SuperAdmin._applyScenario('${schoolId}','expired')">
            <strong>\ud83d\udeab Plano vencido</strong> \u2014 modal bloqueante no login
          </button>
          <button class="btn" style="background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9;text-align:left;padding:12px;" onclick="SuperAdmin._applyScenario('${schoolId}','trialExpired')">
            <strong>\u23f3 Trial expirado</strong> \u2014 per\u00edodo de teste de 7 dias terminou
          </button>
          <hr style="margin:4px 0;border:none;border-top:1px solid var(--border);">
          <button class="btn" style="background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7;text-align:left;padding:12px;" onclick="SuperAdmin._applyScenario('${schoolId}','normal')">
            <strong>\u2705 Restaurar normal</strong> \u2014 plano ativo por 30 dias
          </button>
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  },

  async _applyScenario(schoolId, scenario) {
    const now = new Date();
    const d = (days) => new Date(now.getTime() + days * 86400000).toISOString();
    const updates = {};

    switch (scenario) {
      case 'warning7':
        Object.assign(updates, {
          schoolStatus: 'active', billing: 'mensal', planId: 'gestao_100',
          planSubscriptionId: null, planExpiresAt: d(7),
        });
        break;
      case 'warning2':
        Object.assign(updates, {
          schoolStatus: 'active', billing: 'mensal', planId: 'gestao_100',
          planSubscriptionId: null, planExpiresAt: d(2),
        });
        break;
      case 'expired':
        Object.assign(updates, {
          schoolStatus: 'active', billing: 'mensal', planId: 'gestao_100',
          planSubscriptionId: null, planExpiresAt: d(-1),
        });
        break;
      case 'trialExpired':
        Object.assign(updates, {
          schoolStatus: 'trial', billing: null, planId: 'free',
          planSubscriptionId: null, planExpiresAt: null,
          trialStartedAt: d(-8),
        });
        break;
      case 'normal':
        Object.assign(updates, {
          schoolStatus: 'active', billing: 'mensal', planId: 'gestao_100',
          planSubscriptionId: null, planExpiresAt: d(30),
        });
        break;
      default: return;
    }

    try {
      // UPDATE direto com .select() pra conseguir a linha atualizada de volta
      const payload = DB._filterCols('schools', DB._toSnake(updates));
      const { data: rows, error: upErr } = await supabaseClient
        .from('schools')
        .update(payload)
        .eq('id', schoolId)
        .select('id,school_status,billing,plan_id,plan_expires_at,plan_subscription_id,trial_started_at,upgraded_at');

      if (upErr) {
        Utils.toast('Erro ao salvar: ' + upErr.message, 'error');
        return;
      }
      if (!rows || rows.length === 0) {
        Utils.modal(
          '<i class="fa-solid fa-ban" style="color:#c62828;"></i> RLS bloqueou o UPDATE',
          `<div style="padding:12px 0;font-size:13px;line-height:1.6;">
            <p>O UPDATE executou sem erro, mas <strong>0 linhas foram afetadas</strong>. Isso significa que a pol\u00edtica RLS da tabela <code>schools</code> n\u00e3o permite super admin modificar outras escolas.</p>
            <p>Rode este SQL no <strong>SQL Editor</strong> do Supabase para permitir:</p>
            <pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">CREATE POLICY "superadmin full access schools"
ON schools FOR ALL
USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'superadmin'))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'superadmin'));</pre>
          </div>`,
          `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">OK</button>`
        );
        return;
      }
      const row = rows[0];

      // Atualiza cache local com o retorno real do banco
      const idx = DB._cache.schools.findIndex(s => s.id === schoolId);
      if (idx >= 0) DB._cache.schools[idx] = { ...DB._cache.schools[idx], ...DB._toCamel(row) };

      document.querySelector('.modal-overlay')?.remove();

      const ok =
        row.school_status === (updates.schoolStatus ?? row.school_status) &&
        (updates.planExpiresAt === undefined || row.plan_expires_at === updates.planExpiresAt) &&
        (updates.billing === undefined || row.billing === updates.billing);

      Utils.modal(
        ok ? '<i class="fa-solid fa-circle-check" style="color:#2e7d32;"></i> Cen\u00e1rio salvo no banco'
           : '<i class="fa-solid fa-triangle-exclamation" style="color:#e65100;"></i> Aten\u00e7\u00e3o: diverg\u00eancia',
        `<div style="padding:8px 0;font-size:13px;">
          <p style="margin:0 0 10px;">Estado atual da escola no banco (Supabase):</p>
          <pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">${Utils.escape(JSON.stringify(row, null, 2))}</pre>
          <p style="margin:10px 0 0;color:#555;">Fa\u00e7a logout e login como gestor dessa escola para ver o banner.</p>
        </div>`,
        `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">OK</button>`
      );
    } catch (e) {
      Utils.toast('Erro ao aplicar cen\u00e1rio: ' + (e.message || e), 'error');
    }
  },

  // ===== Reset de senha do gestor da escola =====
  // ===== Simular pagamento confirmado (teste webhook + email) =====
  async simulatePayment(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;

    // Buscar email do gestor
    const prev = DB._schoolId;
    DB.setTenant(schoolId);
    const users = DB.getUsers();
    const gestor = users.find(u => u.id === school.ownerId)
                || users.find(u => u.role === 'gestor');
    DB.setTenant(prev);

    if (!gestor?.email) {
      Utils.toast('Gestor sem email cadastrado. Não é possível simular.', 'error');
      return;
    }

    Utils.modal(
      '<i class="fa-solid fa-envelope-circle-check" style="color:#01579b;"></i> Simular pagamento confirmado',
      `<div style="padding:8px 0;font-size:13px;">
        <p>Esta ação vai:</p>
        <ol style="margin:10px 0;padding-left:20px;line-height:1.7;">
          <li>Ativar o plano (school_status=<code>active</code>)</li>
          <li>Definir vencimento para <strong>+30 dias</strong></li>
          <li>Enviar email de confirmação via Resend para <code>${Utils.escape(gestor.email)}</code></li>
          <li>Registrar em <code>audit_log</code></li>
        </ol>
        <div style="background:#fff3e0;padding:10px;border-radius:6px;margin-top:10px;">
          <i class="fa-solid fa-info-circle" style="color:#e65100;"></i>
          Sem cobrança Asaas real. Simula apenas o comportamento do webhook.
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="SuperAdmin._runSimulatePayment('${schoolId}','${gestor.email}','${Utils.escape(school.name)}')">
         <i class="fa-solid fa-play"></i> Simular agora
       </button>`
    );
  },

  async _runSimulatePayment(schoolId, email, schoolName) {
    document.querySelector('.modal-overlay')?.remove();
    const school = DB.getSchool(schoolId);
    const plan = Plans.get(school.planId || 'gestao_100');
    const value = plan?.price || 149.90;
    const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();

    try {
      // 1. Atualizar escola (simula o webhook)
      const { error: upErr } = await supabaseClient
        .from('schools')
        .update({
          school_status: 'active',
          plan_expires_at: expiresAt,
          plan_subscription_id: null,
        })
        .eq('id', schoolId);

      if (upErr) { Utils.toast('Erro ao atualizar escola: ' + upErr.message, 'error'); return; }

      // Cache local
      const idx = DB._cache.schools.findIndex(s => s.id === schoolId);
      if (idx >= 0) Object.assign(DB._cache.schools[idx], { schoolStatus: 'active', planExpiresAt: expiresAt, planSubscriptionId: null });

      // 2. Enviar email via /api/send-email (autenticado)
      const res = await SuperAdmin._sendEmail({
        to: email,
        subject: '✅ Pagamento confirmado — GestEscolar',
        template: 'payment_confirmed',
        data: { schoolName, value, daysRemaining: 30, loginUrl: window.location.origin },
      });
      const emailResp = await res.json();

      // 3. Audit log
      await supabaseClient.from('audit_log').insert({
        school_id: schoolId,
        action: 'PLAN_RENEWED_SIMULATED',
        details: JSON.stringify({ value, expiresAt, email, emailId: emailResp.emailId }),
      });

      // Resultado
      Utils.modal(
        res.ok
          ? '<i class="fa-solid fa-circle-check" style="color:#2e7d32;"></i> Simulação bem-sucedida'
          : '<i class="fa-solid fa-triangle-exclamation" style="color:#e65100;"></i> Escola atualizada, email falhou',
        `<div style="padding:10px 0;font-size:13px;">
          <div style="margin:8px 0;"><strong>✅ Plano ativado:</strong> vence em ${new Date(expiresAt).toLocaleDateString('pt-BR')}</div>
          <div style="margin:8px 0;"><strong>${res.ok ? '✅' : '❌'} Email Resend:</strong> ${res.ok ? `enviado (ID: ${emailResp.emailId || 'n/a'})` : 'falhou — ' + (emailResp.error || 'erro desconhecido')}</div>
          <div style="margin:8px 0;"><strong>✅ Audit log:</strong> registrado</div>
          <pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:11px;overflow:auto;margin-top:12px;">${Utils.escape(JSON.stringify(emailResp, null, 2))}</pre>
          ${res.ok ? '<p style="color:#666;font-size:12px;margin-top:8px;">Verifique a caixa de entrada de <code>' + Utils.escape(email) + '</code> ou o dashboard do Resend.</p>' : ''}
        </div>`,
        `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();location.reload()">OK</button>`
      );
    } catch (e) {
      Utils.toast('Erro na simulação: ' + (e.message || e), 'error');
    }
  },

  resetSchoolPassword(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;

    // Localiza o gestor da escola
    const prev = DB._schoolId;
    DB.setTenant(schoolId);
    const users = DB.getUsers();
    const gestor = users.find(u => u.id === school.ownerId)
                || users.find(u => u.role === 'gestor')
                || users.find(u => Array.isArray(u.roles) && u.roles.includes('gestor'));
    DB.setTenant(prev);

    if (!gestor || !gestor.email) {
      Utils.modal(
        '<i class="fa-solid fa-circle-exclamation" style="color:#c62828;"></i> Gestor n\u00e3o encontrado',
        `<div style="text-align:center;padding:16px 0;">
          <i class="fa-solid fa-user-slash" style="font-size:48px;color:#c62828;margin-bottom:12px;display:block;"></i>
          <p style="font-size:14px;color:var(--text-muted);">A escola <strong>${Utils.escape(school.name)}</strong> n\u00e3o tem um gestor com e-mail cadastrado.</p>
        </div>`,
        `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
      );
      return;
    }

    const suggested = SuperAdmin._suggestPassword();
    Utils.modal(
      '<i class="fa-solid fa-key" style="color:#e65100;"></i> Resetar senha do gestor',
      `<div style="padding:8px 0;">
        <div style="display:grid;gap:6px;font-size:13px;margin-bottom:12px;">
          <div><strong>Escola:</strong> ${Utils.escape(school.name)}</div>
          <div><strong>Gestor:</strong> ${Utils.escape(gestor.name || '--')}</div>
          <div><strong>E-mail:</strong> <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">${Utils.escape(gestor.email)}</code></div>
        </div>
        <div class="form-group">
          <label class="form-label">Nova senha *</label>
          <div style="display:flex;gap:6px;">
            <input type="text" class="form-control" id="adminNewPwd" value="${suggested}" oninput="LoginPage.attachPasswordStrength('adminNewPwd','adminPwdMeter')" />
            <button type="button" class="btn btn-outline" title="Gerar nova sugest\u00e3o" onclick="document.getElementById('adminNewPwd').value=SuperAdmin._suggestPassword();LoginPage.attachPasswordStrength('adminNewPwd','adminPwdMeter');"><i class="fa-solid fa-rotate"></i></button>
          </div>
          <div id="adminPwdMeter"></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">M\u00edn. 8 caracteres, 1 mai\u00fascula, 1 min\u00fascula, 1 n\u00famero, 1 s\u00edmbolo.</div>
        </div>
        <div style="background:#fff3e0;border-left:4px solid #e65100;padding:10px;border-radius:6px;font-size:12px;color:#5d4037;">
          <i class="fa-solid fa-shield-halved"></i> A nova senha ser\u00e1 aplicada imediatamente via Supabase Auth. O gestor ser\u00e1 obrigado a troc\u00e1-la no pr\u00f3ximo login.
        </div>
        <div id="resetSchoolPwdAlert" style="margin-top:12px;"></div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn" id="resetSchoolPwdBtn" style="background:#e65100;color:#fff;" onclick="SuperAdmin._applyDirectReset('${gestor.email}')">
         <i class="fa-solid fa-key"></i> Aplicar nova senha
       </button>`
    );
    // Inicializa medidor de forca
    setTimeout(() => LoginPage.attachPasswordStrength('adminNewPwd','adminPwdMeter'), 50);
  },

  _suggestPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const num   = '23456789';
    const sym   = '!@#$%&*';
    const all   = upper + lower + num + sym;
    const pick  = (s) => s[Math.floor(Math.random() * s.length)];
    let pwd = pick(upper) + pick(lower) + pick(num) + pick(sym);
    for (let i = 0; i < 8; i++) pwd += pick(all);
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  },

  async _applyDirectReset(email) {
    const alertEl = document.getElementById('resetSchoolPwdAlert');
    const btn     = document.getElementById('resetSchoolPwdBtn');
    const newPwd  = document.getElementById('adminNewPwd').value;

    const v = LoginPage._validatePassword(newPwd);
    if (!v.ok) {
      alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">${v.msg}</div></div>`;
      return;
    }

    if (!supabaseClient) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Supabase indispon\u00edvel.</div></div>';
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aplicando...'; }
    try {
      // Pega JWT da sess\u00e3o atual (super admin)
      const { data: sess } = await supabaseClient.auth.getSession();
      const jwt = sess?.session?.access_token;
      if (!jwt) {
        alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Sess\u00e3o expirada. Fa\u00e7a login novamente.</div></div>';
        return;
      }

      const fnUrl = `${SUPABASE_URL}/functions/v1/admin-reset-password`;
      const resp = await fetch(fnUrl, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_KEY,
        },
        body: JSON.stringify({ userEmail: email, newPassword: newPwd }),
      });
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        // Fallback: se a Edge Function n\u00e3o foi deployada, oferecer envio de e-mail
        if (resp.status === 404 || (data.error || '').includes('Function not found')) {
          alertEl.innerHTML = `<div class="alert alert-warning" style="font-size:13px;">
            <i class="fa-solid fa-circle-exclamation"></i>
            <div style="flex:1;min-width:0;">Edge Function <code>admin-reset-password</code> n\u00e3o est\u00e1 deployada. Veja <code>supabase/functions/admin-reset-password/index.ts</code>.<br>
            Como alternativa, posso enviar o e-mail de recupera\u00e7\u00e3o oficial:</div>
          </div>
          <button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="SuperAdmin._sendResetEmailFallback('${email}')"><i class="fa-solid fa-paper-plane"></i> Enviar e-mail de recupera\u00e7\u00e3o</button>`;
          if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Aplicar nova senha'; }
          return;
        }
        alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Erro: ${data.error || resp.statusText}</div></div>`;
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Aplicar nova senha'; }
        return;
      }

      // Audit log reset de senha
      const user = Auth.current();
      supabaseClient.from('audit_log').insert({
        school_id: null,
        action: 'ADMIN_PASSWORD_RESET',
        details: JSON.stringify({
          targetEmail: email,
          performedBy: user?.id,
          performedByEmail: user?.email,
          at: new Date().toISOString(),
        }),
      }).catch(e => console.error('[Audit] resetPassword:', e));

      alertEl.innerHTML = `<div class="alert alert-success" style="font-size:13px;">
        <i class="fa-solid fa-check-circle"></i>
        <div style="flex:1;min-width:0;">Senha alterada! Informe ao gestor:<br>
        <strong>E-mail:</strong> ${email}<br>
        <strong>Senha:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;font-size:14px;">${newPwd}</code><br>
        <small>O gestor será obrigado a trocar no próximo login.</small></div>
      </div>`;
      if (btn) { btn.style.display = 'none'; }
      Utils.toast('Senha do gestor redefinida.', 'success');
    } catch (e) {
      console.error('[applyDirectReset]', e);
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Falha de rede. Tente novamente.</div></div>';
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Aplicar nova senha'; }
    }
  },

  async _sendResetEmailFallback(email) {
    const alertEl = document.getElementById('resetSchoolPwdAlert');
    try {
      const siteUrl = window.location.origin + window.location.pathname;
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: siteUrl });
      if (error) {
        alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Erro: ${error.message}</div></div>`;
        return;
      }
      alertEl.innerHTML = `<div class="alert alert-success" style="font-size:13px;"><i class="fa-solid fa-check-circle"></i><div style="flex:1;min-width:0;">E-mail enviado para <strong>${email}</strong>. Pe\u00e7a ao gestor para verificar caixa de entrada e spam.</div></div>`;
    } catch (e) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i><div style="flex:1;min-width:0;">Falha ao enviar e-mail.</div></div>';
    }
  },

  async _confirmDelete(schoolId) {
    const school = DB.getSchool(schoolId);
    const name = school?.name || 'Escola';
    document.querySelector('.modal-overlay')?.remove();

    // Audit log ANTES de excluir (depois os dados somem)
    const user = Auth.current();
    await supabaseClient.from('audit_log').insert({
      school_id: schoolId,
      action: 'SCHOOL_DELETED',
      details: JSON.stringify({
        deletedBy: user?.id,
        deletedByEmail: user?.email,
        schoolName: name,
        deletedAt: new Date().toISOString(),
      }),
    }).catch(e => console.error('[Audit] deleteSchool:', e));

    DB.removeSchool(schoolId);
    Utils.toast(`Escola "${name}" excluída permanentemente.`, 'success');
    Router.go('superadmin-dashboard');
  },

  saveProfile(e) {
    e.preventDefault();
    const suList = DB.getSuperUsers();
    const user   = Auth.current();
    const idx    = suList.findIndex(u => u.id === user.id);
    if (idx < 0) return;
    suList[idx].name  = document.getElementById('suName').value.trim();
    suList[idx].email = document.getElementById('suEmail').value.trim();
    const newPass = document.getElementById('suPass').value;
    if (newPass.length >= 6) suList[idx].password = newPass;
    DB._setGlobal(DB.GLOBAL.SUPER_USERS, suList);
    // Atualizar sessao
    const session = Auth.current();
    session.name  = suList[idx].name;
    session.email = suList[idx].email;
    Auth._save(session);
    Utils.toast('Perfil atualizado!', 'success');
    Router.go('superadmin-dashboard');
  },

  async createAsaasAccount(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) return;
    if (school.asaasWalletId) { Utils.toast('Esta escola já tem subconta Asaas.', 'info'); return; }
    if (!school.cnpj) { Utils.toast('CNPJ da escola é obrigatório para criar subconta Asaas.', 'error'); return; }
    if (!school.email) { Utils.toast('E-mail da escola é obrigatório para criar subconta Asaas.', 'error'); return; }
    if (!school.postalCode) { Utils.toast('CEP da escola é obrigatório. Edite a escola e preencha o endereço completo.', 'error'); return; }
    if (!school.address) { Utils.toast('Endereço da escola é obrigatório. Edite a escola e preencha.', 'error'); return; }
    if (!school.addressNumber) { Utils.toast('Número do endereço é obrigatório. Edite a escola e preencha.', 'error'); return; }
    if (!school.province) { Utils.toast('Bairro da escola é obrigatório. Edite a escola e preencha.', 'error'); return; }

    Utils.toast('Criando subconta Asaas...', 'info');
    const result = await AsaasClient.createSubaccount({
      name: school.name,
      cpfCnpj: school.cnpj,
      email: school.email,
      phone: school.phone || '',
      postalCode: school.postalCode,
      address: school.address,
      addressNumber: school.addressNumber,
      complement: school.complement || '',
      province: school.province,
      city: school.city || '',
      state: school.state || '',
    });

    if (!result) return;

    DB.updateSchool(schoolId, {
      asaasAccountId: result.id       || '',
      asaasWalletId:  result.walletId || '',
      asaasSubApiKey: result.apiKey   || '',
    });

    Utils.toast(`Subconta Asaas criada para ${school.name}!`, 'success');
    Router.go('superadmin-dashboard');
  },

  // ── Helper: chama /api/send-email com token de autenticação ──
  async _sendEmail(payload) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token || '';
    return fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  },

  // ── Modal: lista de contas vencendo em 7 dias ──
  showExpiringModal() {
    const schools = DB.getSchools();
    const now = Date.now();
    const in7days = now + 7 * 86400000;

    const expiring = schools.map(s => {
      const status = s.schoolStatus || s.status;
      const trialEnd = s.trialEndsAt
        ? new Date(s.trialEndsAt).getTime()
        : (status === 'trial' && s.createdAt)
          ? new Date(s.createdAt).getTime() + 7 * 86400000
          : null;
      const planExp = s.planExpiresAt ? new Date(s.planExpiresAt).getTime() : null;
      const expireDate = trialEnd || planExp;
      if (!expireDate || expireDate <= now || expireDate > in7days) return null;
      const daysLeft = Math.ceil((expireDate - now) / 86400000);
      return { ...s, _expireDate: expireDate, _daysLeft: daysLeft, _isTrial: status === 'trial' };
    }).filter(Boolean).sort((a, b) => a._daysLeft - b._daysLeft);

    const rows = expiring.length === 0
      ? `<div style="text-align:center;padding:40px;color:#888;">
           <i class="fa-solid fa-check-circle" style="font-size:40px;color:#4caf50;margin-bottom:12px;display:block;"></i>
           Nenhuma conta vencendo nos próximos 7 dias
         </div>`
      : expiring.map(s => {
          const plan = Plans.get(s.planId || 'free');
          const urgency = s._daysLeft <= 1 ? '#c62828' : s._daysLeft <= 3 ? '#e65100' : '#f57f17';
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #f0f0f0;transition:background .2s;" onmouseover="this.style.background='#fafafa'" onmouseout="this.style.background=''">
            <div style="width:40px;height:40px;border-radius:10px;background:${urgency}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="font-weight:900;font-size:15px;color:${urgency};">${s._daysLeft}d</span>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escape(s.name || s.schoolName || 'Escola')}</div>
              <div style="font-size:11px;color:#888;margin-top:2px;">
                ${Utils.escape(s.email || '—')} &nbsp;·&nbsp;
                <span style="background:${s._isTrial ? '#e3f2fd' : '#e8f5e9'};color:${s._isTrial ? '#1565c0' : '#2e7d32'};padding:1px 6px;border-radius:4px;font-weight:600;">
                  ${s._isTrial ? 'Trial' : plan.name}
                </span>
              </div>
            </div>
            <button class="btn btn-sm" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;white-space:nowrap;flex-shrink:0;"
              onclick="SuperAdmin._sendExpiryFromModal('${s.id}', this)">
              <i class="fa-solid fa-envelope"></i> Enviar aviso
            </button>
          </div>`;
        }).join('');

    const html = `
      <div id="expiring-modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target.id==='expiring-modal-overlay')document.getElementById('expiring-modal-overlay').remove()">
        <div style="background:#fff;border-radius:16px;width:100%;max-width:580px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.2);overflow:hidden;">
          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #eee;">
            <div>
              <h3 style="margin:0;font-size:18px;font-weight:900;color:#e65100;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right:8px;"></i>Contas Vencendo em 7 dias
              </h3>
              <p style="margin:4px 0 0;font-size:12px;color:#888;">${expiring.length} conta${expiring.length !== 1 ? 's' : ''} encontrada${expiring.length !== 1 ? 's' : ''}</p>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${expiring.length > 0 ? `
              <button class="btn btn-sm" style="background:#e65100;color:#fff;border:none;"
                onclick="SuperAdmin._sendAllExpiryWarnings()">
                <i class="fa-solid fa-paper-plane"></i> Avisar todos
              </button>` : ''}
              <button onclick="document.getElementById('expiring-modal-overlay').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1;">✕</button>
            </div>
          </div>
          <!-- Lista -->
          <div style="overflow-y:auto;flex:1;">
            ${rows}
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    SuperAdmin._expiringList = expiring;
  },

  async _sendExpiryFromModal(schoolId, btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
      await this.sendExpiryWarning(schoolId);
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado';
      btn.style.background = '#e8f5e9';
      btn.style.color = '#2e7d32';
      btn.style.borderColor = '#a5d6a7';
    } catch {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-envelope"></i> Tentar novamente';
    }
  },

  async _sendAllExpiryWarnings() {
    const list = this._expiringList || [];
    if (!list.length) return;
    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    let ok = 0;
    for (const s of list) {
      try { await this.sendExpiryWarning(s.id); ok++; } catch {}
    }
    btn.innerHTML = `<i class="fa-solid fa-check"></i> ${ok}/${list.length} enviados`;
    btn.style.background = '#e8f5e9';
    btn.style.color = '#2e7d32';
    Utils.toast(`✅ ${ok} email(s) de aviso enviados!`, 'success');
  },

  // ── Enviar email de aviso para contas vencendo ──
  async sendExpiryWarning(schoolId) {
    const school = DB.getSchool(schoolId);
    if (!school) {
      Utils.toast('Escola não encontrada', 'danger');
      return;
    }

    const isTrial = (school.schoolStatus || school.status) === 'trial';
    const trialEnd = school.trialEndsAt
      ? new Date(school.trialEndsAt)
      : (isTrial && school.createdAt)
        ? new Date(new Date(school.createdAt).getTime() + 7 * 86400000)
        : null;
    const planExp = school.planExpiresAt ? new Date(school.planExpiresAt) : null;
    const expireDate = trialEnd || planExp;
    const daysLeft = expireDate ? Math.ceil((expireDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    const plan = Plans.get(school.planId || 'free');

    try {
      await this._sendEmail({
        to: school.email,
        subject: isTrial
          ? `GestEscolar - Seu período de teste vence em ${daysLeft} dias`
          : `GestEscolar - Seu plano ${plan.name} vence em ${daysLeft} dias`,
        template: 'expiry_warning',
        data: {
          schoolName: school.name,
          planName: plan.name,
          daysLeft,
          expireDate: expireDate?.toLocaleDateString('pt-BR'),
          isTrial,
          actionUrl: `${window.location.origin}/#/school-plans`,
        },
      });

      Utils.toast('✅ Email de aviso enviado com sucesso!', 'success');
      DB.addAuditLog('email_sent', `Email de aviso de vencimento enviado para ${school.name}`);
    } catch (err) {
      console.error('[Email Error]', err);
      Utils.toast('❌ Erro ao enviar email. Tente novamente.', 'danger');
    }
  },
};

// =============================================
//  CONFIGURAÇÃO DE E-MAIL — SUPER ADMIN
// =============================================

Router.register('superadmin-email-config', async () => {
  const user = Auth.require();
  if (!user || user.role !== 'superadmin') { Router.go('login'); return; }

  // Carrega configuração salva
  const { data: rows } = await supabaseClient
    .from('platform_settings')
    .select('key, value')
    .eq('group', 'email');

  const cfg = {};
  (rows || []).forEach(r => { cfg[r.key] = r.value; });

  // Defaults
  const D = {
    senderName:    cfg.senderName    || 'GestEscolar',
    senderEmail:   cfg.senderEmail   || 'noreply@gestescolar.com.br',
    primaryColor:  cfg.primaryColor  || '#1a73e8',
    logoUrl:       cfg.logoUrl       || '',
    supportEmail:  cfg.supportEmail  || 'suporte@gestescolar.com.br',
    supportPhone:  cfg.supportPhone  || '',
    footerAddress: cfg.footerAddress || '',
    footerCnpj:    cfg.footerCnpj    || '',
    instagram:     cfg.instagram     || '',
    whatsapp:      cfg.whatsapp      || '',
  };

  Router.renderLayout(user, 'superadmin-email-config', `
    <div style="max-width:860px;margin:0 auto;">
      <div style="margin-bottom:24px;">
        <h2 style="margin:0;"><i class="fa-solid fa-envelope-open-text" style="color:#1a73e8;margin-right:8px;"></i>Configuração de E-mail</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Personalize os e-mails enviados pela plataforma aos gestores das escolas.</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

        <!-- Coluna esquerda: formulário -->
        <div style="display:flex;flex-direction:column;gap:16px;">

          <div class="card">
            <div class="card-header"><span class="card-title"><i class="fa-solid fa-paper-plane"></i> Remetente</span></div>
            <div style="padding:16px;display:grid;gap:12px;">
              <div class="form-group">
                <label class="form-label">Nome do remetente</label>
                <input class="form-control" id="ec-senderName" value="${Utils.escape(D.senderName)}" placeholder="GestEscolar" />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail do remetente</label>
                <input class="form-control" id="ec-senderEmail" value="${Utils.escape(D.senderEmail)}" placeholder="noreply@gestescolar.com.br" />
                <small style="color:var(--text-muted);font-size:11px;">Deve ser um domínio verificado no Resend.</small>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title"><i class="fa-solid fa-palette"></i> Visual</span></div>
            <div style="padding:16px;display:grid;gap:12px;">
              <div class="form-group">
                <label class="form-label">Cor primária (botões e destaques)</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="color" id="ec-primaryColorPicker" value="${D.primaryColor}"
                    oninput="document.getElementById('ec-primaryColor').value=this.value;EmailConfigPreview.update()"
                    style="width:44px;height:38px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;" />
                  <input class="form-control" id="ec-primaryColor" value="${Utils.escape(D.primaryColor)}"
                    oninput="document.getElementById('ec-primaryColorPicker').value=this.value;EmailConfigPreview.update()"
                    placeholder="#1a73e8" style="flex:1;" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">URL do logo <small style="color:var(--text-muted);">(PNG/SVG, max 300×80px recomendado)</small></label>
                <input class="form-control" id="ec-logoUrl" value="${Utils.escape(D.logoUrl)}" placeholder="https://gestescolar.com.br/logo.png"
                  oninput="EmailConfigPreview.update()" />
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title"><i class="fa-solid fa-headset"></i> Suporte</span></div>
            <div style="padding:16px;display:grid;gap:12px;">
              <div class="form-group">
                <label class="form-label">E-mail de suporte</label>
                <input class="form-control" id="ec-supportEmail" value="${Utils.escape(D.supportEmail)}" placeholder="suporte@gestescolar.com.br" />
              </div>
              <div class="form-group">
                <label class="form-label">WhatsApp de suporte</label>
                <input class="form-control" id="ec-whatsapp" value="${Utils.escape(D.whatsapp)}" placeholder="5511999999999" />
              </div>
              <div class="form-group">
                <label class="form-label">Instagram</label>
                <input class="form-control" id="ec-instagram" value="${Utils.escape(D.instagram)}" placeholder="@gestescolar" />
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title"><i class="fa-solid fa-building"></i> Rodapé Legal</span></div>
            <div style="padding:16px;display:grid;gap:12px;">
              <div class="form-group">
                <label class="form-label">Endereço</label>
                <input class="form-control" id="ec-footerAddress" value="${Utils.escape(D.footerAddress)}" placeholder="Rua Exemplo, 123 — São Paulo, SP" />
              </div>
              <div class="form-group">
                <label class="form-label">CNPJ</label>
                <input class="form-control" id="ec-footerCnpj" value="${Utils.escape(D.footerCnpj)}" placeholder="00.000.000/0001-00" />
              </div>
            </div>
          </div>

          <button class="btn btn-primary" onclick="EmailConfigSave.save()" style="width:100%;padding:12px;">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Configurações
          </button>
          <button class="btn btn-outline" onclick="EmailConfigPreview.sendTest()" style="width:100%;padding:12px;">
            <i class="fa-solid fa-paper-plane"></i> Enviar E-mail de Teste
          </button>

        </div><!-- /col esquerda -->

        <!-- Coluna direita: preview -->
        <div>
          <div class="card" style="position:sticky;top:20px;">
            <div class="card-header">
              <span class="card-title"><i class="fa-solid fa-eye"></i> Preview</span>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-outline" onclick="EmailConfigPreview.setTemplate('payment_confirmed')" id="prev-btn-pay">Pagamento</button>
                <button class="btn btn-sm btn-outline" onclick="EmailConfigPreview.setTemplate('payment_overdue')" id="prev-btn-over">Vencido</button>
                <button class="btn btn-sm btn-outline" onclick="EmailConfigPreview.setTemplate('renewal_warning')" id="prev-btn-warn">Aviso</button>
              </div>
            </div>
            <div id="email-preview-frame" style="padding:0;background:#f5f5f5;border-radius:0 0 8px 8px;min-height:400px;overflow:auto;">
              <iframe id="email-preview-iframe" style="width:100%;height:500px;border:none;" srcdoc=""></iframe>
            </div>
          </div>
        </div><!-- /col direita -->

      </div><!-- /grid -->
    </div>

    <script>
    // Dados iniciais pro preview
    window._emailCfgDefaults = ${JSON.stringify(D)};

    const EmailConfigPreview = {
      _tpl: 'payment_confirmed',
      setTemplate(t) {
        this._tpl = t;
        ['pay','over','warn'].forEach(k => {
          const btn = document.getElementById('prev-btn-' + k);
          if (btn) btn.style.background = '';
        });
        const map = { payment_confirmed:'pay', payment_overdue:'over', renewal_warning:'warn' };
        const b = document.getElementById('prev-btn-' + map[t]);
        if (b) b.style.background = '#e8f0fe';
        this.update();
      },
      _val(id) { const el = document.getElementById(id); return el ? el.value : ''; },
      update() {
        const cfg = {
          senderName:    this._val('ec-senderName'),
          senderEmail:   this._val('ec-senderEmail'),
          primaryColor:  this._val('ec-primaryColor') || '#1a73e8',
          logoUrl:       this._val('ec-logoUrl'),
          supportEmail:  this._val('ec-supportEmail'),
          whatsapp:      this._val('ec-whatsapp'),
          instagram:     this._val('ec-instagram'),
          footerAddress: this._val('ec-footerAddress'),
          footerCnpj:    this._val('ec-footerCnpj'),
        };
        const html = EmailConfigPreview._buildHtml(this._tpl, cfg);
        const iframe = document.getElementById('email-preview-iframe');
        if (iframe) iframe.srcdoc = html;
      },
      _buildHtml(template, cfg) {
        const color = cfg.primaryColor || '#1a73e8';
        const logo  = cfg.logoUrl
          ? \`<img src="\${cfg.logoUrl}" alt="\${cfg.senderName}" style="max-height:56px;max-width:200px;">\`
          : \`<div style="font-size:22px;font-weight:900;color:\${color};">\${cfg.senderName || 'GestEscolar'}</div>\`;

        const footer = \`
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <div style="text-align:center;font-size:11px;color:#999;line-height:1.7;">
            \${cfg.footerAddress ? cfg.footerAddress + '<br>' : ''}
            \${cfg.footerCnpj ? 'CNPJ: ' + cfg.footerCnpj + '<br>' : ''}
            \${cfg.supportEmail ? '📧 ' + cfg.supportEmail + '&nbsp;&nbsp;' : ''}
            \${cfg.whatsapp ? '📱 ' + cfg.whatsapp + '&nbsp;&nbsp;' : ''}
            \${cfg.instagram ? '📷 ' + cfg.instagram : ''}
            <br><br>\${cfg.senderName || 'GestEscolar'} © \${new Date().getFullYear()} — Plataforma SaaS de Gestão Escolar
          </div>\`;

        const wrap = (body) => \`<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f5f5f5;font-family:Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;padding:28px 24px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid \${color}20;">\${logo}</div>
            \${body}\${footer}
          </div></body></html>\`;

        if (template === 'payment_confirmed') return wrap(\`
          <div style="text-align:center;margin-bottom:20px;"><div style="font-size:44px;">✅</div>
            <h1 style="color:#2e7d32;font-size:22px;margin:8px 0;">Pagamento Confirmado!</h1></div>
          <p style="color:#333;font-size:14px;line-height:1.6;">Seu pagamento de <strong>R$ 149,90</strong> foi confirmado com sucesso.</p>
          <div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#1b5e20;font-size:13px;"><strong>Escola Exemplo</strong> está ativa e pronta para usar!</p>
          </div>
          <p style="color:#666;font-size:12px;">Seu plano vence em <strong>30 dias</strong>.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="#" style="display:inline-block;background:\${color};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Acessar GestEscolar</a>
          </div>\`);

        if (template === 'payment_overdue') return wrap(\`
          <div style="text-align:center;margin-bottom:20px;"><div style="font-size:44px;">⚠️</div>
            <h1 style="color:#c62828;font-size:22px;margin:8px 0;">Assinatura Vencida</h1></div>
          <p style="color:#333;font-size:14px;line-height:1.6;">Sua assinatura venceu em <strong>01/04/2026</strong>.</p>
          <div style="background:#ffebee;border-left:4px solid #c62828;padding:12px;border-radius:4px;margin:16px 0;">
            <p style="margin:0;color:#b71c1c;font-size:13px;"><strong>Ação necessária:</strong> Renove agora para continuar usando o sistema.</p>
          </div>
          <div style="text-align:center;margin-top:20px;">
            <a href="#" style="display:inline-block;background:#c62828;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Renovar Agora</a>
          </div>\`);

        return wrap(\`
          <div style="text-align:center;margin-bottom:20px;"><div style="font-size:44px;">🔔</div>
            <h1 style="color:#f57c00;font-size:22px;margin:8px 0;">Sua Assinatura Vence em 7 Dias</h1></div>
          <p style="color:#333;font-size:14px;line-height:1.6;">Sua assinatura vence em <strong>24/04/2026</strong>. Renove agora para evitar interrupção.</p>
          <div style="text-align:center;margin-top:20px;">
            <a href="#" style="display:inline-block;background:\${color};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Renovar Assinatura</a>
          </div>\`);
      },
      sendTest() {
        const email = prompt('E-mail para o teste:');
        if (!email) return;
        const cfg = {
          senderName:   document.getElementById('ec-senderName')?.value  || 'GestEscolar',
          senderEmail:  document.getElementById('ec-senderEmail')?.value || 'noreply@gestescolar.com.br',
          primaryColor: document.getElementById('ec-primaryColor')?.value || '#1a73e8',
          logoUrl:      document.getElementById('ec-logoUrl')?.value      || '',
          supportEmail: document.getElementById('ec-supportEmail')?.value || '',
          whatsapp:     document.getElementById('ec-whatsapp')?.value     || '',
          instagram:    document.getElementById('ec-instagram')?.value    || '',
          footerAddress:document.getElementById('ec-footerAddress')?.value || '',
          footerCnpj:   document.getElementById('ec-footerCnpj')?.value  || '',
        };
        SuperAdmin._sendEmail({
          to: email,
          subject: '🧪 Teste de e-mail — GestEscolar',
          template: this._tpl,
          emailConfig: cfg,
          data: { schoolName: 'Escola Exemplo', value: 149.90, daysRemaining: 30, loginUrl: window.location.origin, dueDate: '24/04/2026', expiredDate: '01/04/2026', renewUrl: window.location.origin },
        })
          .then(r => r.json())
          .then(d => Utils.toast(d.ok ? '✅ E-mail de teste enviado! Verifique sua caixa de entrada.' : '❌ Falhou: ' + (d.error || ''), d.ok ? 'success' : 'error'))
          .catch(() => Utils.toast('Erro de conexão ao enviar e-mail.', 'error'));
      },
    };

    const EmailConfigSave = {
      async save() {
        const fields = [
          'senderName','senderEmail','primaryColor','logoUrl',
          'supportEmail','whatsapp','instagram','footerAddress','footerCnpj'
        ];
        const upserts = fields.map(key => ({
          group: 'email',
          key,
          value: document.getElementById('ec-' + key)?.value || '',
        }));

        const { error } = await supabaseClient.from('platform_settings').upsert(upserts, { onConflict: 'group,key' });
        if (error) {
          Utils.toast('Erro ao salvar: ' + error.message, 'error');
        } else {
          Utils.toast('Configurações salvas com sucesso!', 'success');
        }
      },
    };

    // Inicializar preview com template padrão
    setTimeout(() => EmailConfigPreview.setTemplate('payment_confirmed'), 100);
    </script>
  `);
});

// =============================================
//  CUPONS DE DESCONTO — SUPER ADMIN
// =============================================

Router.register('superadmin-coupons', async () => {
  const user = Auth.require();
  if (!user || user.role !== 'superadmin') { Router.go('login'); return; }

  const { data: rows } = await supabaseClient
    .from('platform_settings')
    .select('key, value')
    .eq('group', 'coupons')
    .order('key');

  const coupons = (rows || []).map(r => ({ code: r.key, ...JSON.parse(r.value) }));

  const tableRows = coupons.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhum cupom cadastrado.</td></tr>`
    : coupons.map(c => `
        <tr>
          <td><code style="background:#f5f5f5;padding:3px 8px;border-radius:4px;font-weight:700;">${Utils.escape(c.code)}</code></td>
          <td style="text-align:center;"><strong style="color:#2e7d32;">${c.discount}%</strong></td>
          <td style="text-align:center;">
            <span class="badge ${c.active ? 'badge-green' : 'badge-red'}">${c.active ? 'Ativo' : 'Inativo'}</span>
          </td>
          <td style="text-align:center;">
            <button class="btn btn-sm btn-outline" onclick="CouponsAdmin.toggle('${c.code}','${c.discount}',${c.active})">
              <i class="fa-solid fa-${c.active ? 'pause' : 'play'}"></i> ${c.active ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn btn-sm" style="background:#ffebee;color:#c62828;border:1px solid #ef9a9a;margin-left:4px;"
              onclick="CouponsAdmin.remove('${c.code}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>`).join('');

  Router.renderLayout(user, 'superadmin-coupons', `
    <div style="max-width:700px;margin:0 auto;">
      <div style="margin-bottom:24px;">
        <h2 style="margin:0;"><i class="fa-solid fa-tag" style="color:#6a1b9a;margin-right:8px;"></i>Cupons de Desconto</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Crie cupons para testes ou promoções. Aplicados no checkout de cartão e PIX.</p>
      </div>

      <!-- Criar novo cupom -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-plus"></i> Novo Cupom</span></div>
        <div style="padding:16px;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Código</label>
            <input class="form-control" id="new-coupon-code" placeholder="EX: DESCONTO99" style="text-transform:uppercase;"
              oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Desconto (%)</label>
            <input class="form-control" id="new-coupon-discount" type="number" min="1" max="99" placeholder="99" />
          </div>
          <button class="btn btn-primary" onclick="CouponsAdmin.create()" style="white-space:nowrap;">
            <i class="fa-solid fa-plus"></i> Criar
          </button>
        </div>
      </div>

      <!-- Lista de cupons -->
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-list"></i> Cupons cadastrados</span></div>
        <div style="padding:0;">
          <table class="table" style="margin:0;">
            <thead>
              <tr>
                <th>Código</th>
                <th style="text-align:center;">Desconto</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `);
});

const CouponsAdmin = {
  async create() {
    const code     = document.getElementById('new-coupon-code')?.value.trim().toUpperCase();
    const discount = parseInt(document.getElementById('new-coupon-discount')?.value);
    if (!code || !discount || discount < 1 || discount > 99) {
      Utils.toast('Código e desconto (1-99%) são obrigatórios.', 'error'); return;
    }
    const { error } = await supabaseClient.from('platform_settings').upsert({
      group: 'coupons', key: code,
      value: JSON.stringify({ discount, active: true }),
    }, { onConflict: 'group,key' });
    if (error) { Utils.toast('Erro: ' + error.message, 'error'); return; }
    Utils.toast(`Cupom ${code} criado!`, 'success');
    Router.go('superadmin-coupons');
  },

  async toggle(code, discount, active) {
    const { error } = await supabaseClient.from('platform_settings').upsert({
      group: 'coupons', key: code,
      value: JSON.stringify({ discount: Number(discount), active: !active }),
    }, { onConflict: 'group,key' });
    if (error) { Utils.toast('Erro: ' + error.message, 'error'); return; }
    Utils.toast(`Cupom ${code} ${!active ? 'ativado' : 'desativado'}.`, 'success');
    Router.go('superadmin-coupons');
  },

  async remove(code) {
    if (!confirm(`Excluir cupom ${code}?`)) return;
    const { error } = await supabaseClient.from('platform_settings')
      .delete().eq('group', 'coupons').eq('key', code);
    if (error) { Utils.toast('Erro: ' + error.message, 'error'); return; }
    Utils.toast(`Cupom ${code} excluído.`, 'success');
    Router.go('superadmin-coupons');
  },
};
