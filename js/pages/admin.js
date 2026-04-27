// =============================================
//  GESTESCOLAR – PAINEL ADMINISTRATIVO
// =============================================

// ---------- DASHBOARD ----------
Router.register('admin-dashboard', () => {
  const user = Auth.require(); if (!user) return;
  const students = DB.getStudents();
  const users    = DB.getUsers();
  const classes  = DB.getClasses();
  const invoices = DB.getInvoices();
  const pending  = invoices.filter(i => i.status === 'pendente');

  // Resumo financeiro do mês atual
  const _now    = new Date();
  const _mesKey = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}`;
  const _invMes = invoices.filter(i => (i.dueDate || '').startsWith(_mesKey));
  const _invMesPagas = _invMes.filter(i => i.status === 'pago');
  const _invMesPendentes = _invMes.filter(i => i.status === 'pendente' || i.status === 'vencido');
  const _recebidoMes = _invMesPagas.reduce((t, i) => t + (i.amount || 0), 0);
  const _aReceberMes = _invMesPendentes.reduce((t, i) => t + (i.amount || 0), 0);
  const _previsaoMes = _recebidoMes + _aReceberMes;
  const _pctMes = _previsaoMes > 0 ? Math.round((_recebidoMes / _previsaoMes) * 100) : 0;
  const _corPct = _pctMes >= 80 ? 'var(--secondary)' : _pctMes >= 50 ? '#f9ab00' : 'var(--danger)';

  // Alerta de limite de plano
  const limStudents = Auth.checkLimit('students');
  let planAlert = '';
  if (!limStudents.ok) {
    planAlert = `
      <div style="background:linear-gradient(135deg,#fff3cd,#ffeaa7);border:1px solid #f0c040;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:28px;color:#e67e22;"></i>
        <div style="flex:1;">
          <strong style="font-size:14px;color:#856404;">Limite de alunos atingido!</strong>
          <p style="margin:4px 0 0;font-size:13px;color:#856404;">
            Seu plano <strong>${limStudents.plan}</strong> permite até <strong>${limStudents.limit} alunos</strong> ativos.
            Você já tem <strong>${limStudents.current}</strong>. Para cadastrar mais, faça upgrade do plano.
          </p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Router.go('school-plans')" style="white-space:nowrap;">
          <i class="fa-solid fa-rocket"></i> Ver Planos
        </button>
      </div>`;
  } else if (limStudents.ok && limStudents.limit !== undefined) {
    // Mostrar alerta se estiver acima de 80% do limite
    const pct = limStudents.current / limStudents.limit;
    if (pct >= 0.8 && limStudents.limit !== Infinity) {
      const remaining = limStudents.limit - limStudents.current;
      planAlert = `
        <div style="background:linear-gradient(135deg,#e8f4fd,#d1ecf1);border:1px solid #bee5eb;border-radius:10px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:14px;">
          <i class="fa-solid fa-circle-info" style="font-size:28px;color:#0c5460;"></i>
          <div style="flex:1;">
            <strong style="font-size:14px;color:#0c5460;">Seu plano está quase no limite</strong>
            <p style="margin:4px 0 0;font-size:13px;color:#0c5460;">
              Você tem <strong>${limStudents.current}/${limStudents.limit}</strong> alunos ativos.
              Restam apenas <strong>${remaining} vagas</strong>. Considere fazer upgrade para não ser surpreendido.
            </p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="Router.go('school-plans')" style="white-space:nowrap;color:#0c5460;border-color:#0c5460;">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Ver Planos
          </button>
        </div>`;
    }
  }

  // Aviso de documentos Asaas pendentes
  let asaasDocsAlert = '';
  const _schoolForDocs = DB.getSchool(user.schoolId);
  const _docStatus = _schoolForDocs?.asaasDocumentsStatus || 'pending';
  if (_docStatus === 'pending') {
    asaasDocsAlert = `
      <div style="background:#FFF3E0;border-left:4px solid #FF9800;border-radius:8px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
        <i class="fa-solid fa-id-card" style="color:#FF9800;font-size:24px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700;color:#E65100;">Envie seus documentos para receber pagamentos</div>
          <div style="font-size:13px;color:#795548;margin-top:3px;">Sua subconta de pagamentos ainda não foi ativada. Envie os documentos KYC para começar a receber via PIX.</div>
        </div>
        <button class="btn btn-sm" style="background:#FF9800;color:white;" onclick="Router.go('admin-asaas-documents')">
          <i class="fa-solid fa-upload"></i> Enviar Documentos
        </button>
      </div>`;
  } else if (_docStatus === 'pending_verification') {
    asaasDocsAlert = `
      <div style="background:#E3F2FD;border-left:4px solid #2196F3;border-radius:8px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
        <i class="fa-solid fa-rotate fa-spin" style="color:#2196F3;font-size:22px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700;color:#0D47A1;">Documentos em análise pelo Asaas</div>
          <div style="font-size:13px;color:#1565C0;margin-top:3px;">A análise costuma levar até 48h úteis. Você será notificado(a) quando concluir.</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="Router.go('admin-asaas-documents')">Ver detalhes</button>
      </div>`;
  } else if (_docStatus === 'rejected') {
    asaasDocsAlert = `
      <div style="background:#FFEBEE;border-left:4px solid #F44336;border-radius:8px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
        <i class="fa-solid fa-circle-exclamation" style="color:#F44336;font-size:22px;"></i>
        <div style="flex:1;">
          <div style="font-weight:700;color:#B71C1C;">Documentos reprovados — reenvie por favor</div>
          <div style="font-size:13px;color:#C62828;margin-top:3px;">${Utils.escape(_schoolForDocs?.asaasVerificationMessage || 'Reenvie os documentos para nova análise.')}</div>
        </div>
        <button class="btn btn-sm" style="background:#F44336;color:white;" onclick="Router.go('admin-asaas-documents')">Reenviar</button>
      </div>`;
  }

  Router.renderLayout(user, 'admin-dashboard', `
    <h2 style="margin-bottom:20px;">Bem-vindo(a), ${Utils.escape(user.name.split(' ')[0])}! 👋</h2>
    ${asaasDocsAlert}
    ${planAlert}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue"><i class="fa-solid fa-user-graduate"></i></div>
        <div><div class="stat-value">${students.filter(s=>s.status==='ativo').length}</div><div class="stat-label">Alunos ativos</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple"><i class="fa-solid fa-chalkboard-teacher"></i></div>
        <div><div class="stat-value">${users.filter(u=>u.role==='professor').length}</div><div class="stat-label">Professores</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><i class="fa-solid fa-chalkboard"></i></div>
        <div><div class="stat-value">${classes.length}</div><div class="stat-label">Turmas ativas</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow"><i class="fa-solid fa-file-invoice"></i></div>
        <div><div class="stat-value">${pending.length}</div><div class="stat-label">Boletos pendentes</div></div>
      </div>
    </div>
    <!-- RESUMO FINANCEIRO DO MÊS -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-sack-dollar" style="color:var(--secondary);"></i> Resumo Financeiro — ${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][_now.getMonth()]} ${_now.getFullYear()}</span>
        <button class="btn btn-primary btn-sm" onclick="Router.go('fin-dashboard')">
          <i class="fa-solid fa-arrow-right"></i> Ver Painel Financeiro
        </button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:16px;">
        <div style="border-top:4px solid #1a73e8;background:#f8fbff;border-radius:8px;padding:14px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Previsão</div>
          <div style="font-size:22px;font-weight:800;color:#1a73e8;margin-top:4px;">${Utils.currency(_previsaoMes)}</div>
        </div>
        <div style="border-top:4px solid var(--secondary);background:#f4fbf6;border-radius:8px;padding:14px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Recebido</div>
          <div style="font-size:22px;font-weight:800;color:var(--secondary);margin-top:4px;">${Utils.currency(_recebidoMes)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${_invMesPagas.length} pagamento(s)</div>
        </div>
        <div style="border-top:4px solid var(--warning);background:#fffbf2;border-radius:8px;padding:14px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">A Receber</div>
          <div style="font-size:22px;font-weight:800;color:#b06000;margin-top:4px;">${Utils.currency(_aReceberMes)}</div>
          <div style="font-size:11px;color:var(--text-muted);">${_invMes.filter(i=>i.status==='pendente').length} pendente(s)</div>
        </div>
        <div style="border-top:4px solid ${_corPct};background:#fafafa;border-radius:8px;padding:14px;">
          <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;">% Recebido</div>
          <div style="font-size:22px;font-weight:800;color:${_corPct};margin-top:4px;">${_pctMes}%</div>
          <div style="height:6px;background:#eee;border-radius:6px;overflow:hidden;margin-top:6px;">
            <div style="height:100%;width:${Math.min(100,_pctMes)}%;background:${_corPct};"></div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Últimas matrículas</span>
          <button class="btn btn-primary btn-sm" onclick="Router.go('admin-students')">Ver todos</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Aluno</th><th>Matrícula</th><th>Status</th></tr></thead>
          <tbody>
            ${students.slice(0,5).map(s=>`<tr>
              <td><strong>${Utils.escape(s.name)}</strong></td>
              <td style="font-size:12px;color:var(--text-muted);">${s.matricula}</td>
              <td>${Utils.statusBadge(s.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Equipe</span>
          <button class="btn btn-primary btn-sm" onclick="Router.go('admin-staff')">Ver todos</button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>Função</th><th>Status</th></tr></thead>
          <tbody>
            ${users.slice(0,5).map(u=>`<tr>
              <td><strong>${Utils.escape(u.name)}</strong></td>
              <td><span class="badge badge-${Auth.roleBadgeColor(u.role)}">${Auth.roleLabel(u.role)}</span></td>
              <td>${Utils.statusBadge(u.active?'ativo':'inativo')}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>
  `);
});

// ---------- ALUNOS (lista) ----------
Router.register('admin-students', () => {
  const user = Auth.require(); if (!user) return;

  const render = (search = '', tab = 'ativos') => {
    const all = DB.getStudents().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const ativos   = all.filter(s => s.status === 'ativo');
    const inativos = all.filter(s => s.status !== 'ativo');

    let students = tab === 'ativos' ? ativos : tab === 'inativos' ? inativos : all;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      students = students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.matricula || '').includes(q)
      );
    }

    const classes = DB.getClasses();
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-user-graduate"></i> Alunos</span>
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="position:relative;">
              <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;"></i>
              <input type="text" id="studentSearch" value="${Utils.escape(search)}"
                placeholder="Buscar por nome ou matrícula…"
                style="padding:7px 10px 7px 32px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;width:240px;"
                oninput="AdminStudents.search(this.value)" />
            </div>
            <button class="btn btn-primary btn-sm" onclick="Router.go('admin-new-student')">
              <i class="fa-solid fa-user-plus"></i> Novo Aluno
            </button>
          </div>
        </div>

        <!-- ABAS -->
        <div class="tabs" style="padding:0 16px;">
          <button class="tab-btn ${tab==='ativos'?'active':''}" onclick="AdminStudents.setTab('ativos')">
            <i class="fa-solid fa-circle-check" style="color:var(--secondary);"></i> Ativos
            <span style="background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${ativos.length}</span>
          </button>
          <button class="tab-btn ${tab==='inativos'?'active':''}" onclick="AdminStudents.setTab('inativos')">
            <i class="fa-solid fa-ban" style="color:var(--text-muted);"></i> Inativos
            <span style="background:#f1f3f4;color:#5f6368;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${inativos.length}</span>
          </button>
          <button class="tab-btn ${tab==='todos'?'active':''}" onclick="AdminStudents.setTab('todos')">
            Todos
            <span style="background:#e8f0fe;color:#1a73e8;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${all.length}</span>
          </button>
        </div>

        ${tab === 'inativos' ? `
        <div style="margin:0 16px 12px;padding:10px 14px;background:#fff8e1;border-left:4px solid #f9ab00;border-radius:6px;font-size:13px;color:#7a5f00;">
          <i class="fa-solid fa-circle-info"></i>
          <strong>Alunos inativos</strong> são mantidos no sistema para preservar histórico de notas, frequência e financeiro.
          Para reativar, clique em <i class="fa-solid fa-check"></i>.
        </div>` : ''}

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th><th>Matrícula</th><th>Turma</th>
                <th>Responsável</th><th>Mensalidade</th>
                <th>Venc.</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${students.length === 0
                ? `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-user-graduate"></i>
                    <p>${tab==='inativos'?'Nenhum aluno inativo.':tab==='ativos'?'Nenhum aluno ativo.':'Nenhum aluno cadastrado.'}</p>
                  </div></td></tr>`
                : students.map(s => {
                    const cls  = classes.find(c => c.id === s.classId);
                    const resp = (s.responsaveis || [])[0];
                    const inativo = s.status !== 'ativo';
                    return `<tr style="${inativo?'opacity:.7;':''}">
                      <td>
                        <strong>${Utils.escape(s.name)}</strong>
                        ${inativo ? '<br><span style="font-size:10px;color:var(--danger);">inativo</span>' : ''}
                      </td>
                      <td style="font-family:monospace;font-size:12px;">${s.matricula}</td>
                      <td>${cls ? Utils.escape(cls.name) : '–'}</td>
                      <td>${resp ? Utils.escape(resp.nome) : '–'}</td>
                      <td>${Utils.currency(s.monthlyFee)}</td>
                      <td>Dia ${s.dueDay}</td>
                      <td>
                        ${Utils.statusBadge(s.status)}
                        ${s.activeSince ? `<br><span style="font-size:10px;color:var(--text-muted);">desde ${Utils.date(s.activeSince)}</span>` : ''}
                      </td>
                      <td style="white-space:nowrap;">
                        <button class="btn btn-outline btn-sm" onclick="AdminStudents.edit('${s.id}')" title="Editar ficha">
                          <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="AdminStudents.declaration('${s.id}')" title="Declaração escolar">
                          <i class="fa-solid fa-file-lines"></i>
                        </button>
                        <button class="btn btn-sm ${inativo?'btn-secondary':'btn-danger'}"
                          onclick="AdminStudents.toggleStatus('${s.id}','${s.status}')"
                          title="${inativo?'Reativar aluno':'Inativar aluno'}"
                          style="${inativo?'background:#e8f5e9;color:#2e7d32;border:1.5px solid #a5d6a7;':''}">
                          <i class="fa-solid fa-${inativo?'rotate-left':'ban'}"></i>
                          ${inativo?'Reativar':'Inativar'}
                        </button>
                      </td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  Router.renderLayout(user, 'admin-students', render());
  window._studentsSearch = '';
  window._studentsTab    = 'ativos';
  window._reloadStudents = (search, tab) => {
    const s = search ?? window._studentsSearch ?? '';
    const t = tab    ?? window._studentsTab    ?? 'ativos';
    document.getElementById('page-content').innerHTML = render(s, t);
  };
});

const AdminStudents = {
  showAccessModal(name, matricula, senha, url) {
    const texto = `Olá! O acesso ao acompanhamento escolar de ${name} está disponível:\n\nLink: ${url}\nLogin (Matrícula): ${matricula}\nSenha: ${senha}\n\nAcesse e acompanhe notas, frequência, financeiro e mensagens.`;
    Utils.modal(
      'Acesso do Responsável Criado',
      `<div style="text-align:center;margin-bottom:16px;">
        <i class="fa-solid fa-circle-check" style="font-size:40px;color:var(--secondary);"></i>
        <p style="font-weight:700;font-size:16px;margin:10px 0 4px;">Aluno cadastrado com sucesso!</p>
        <p style="font-size:13px;color:var(--text-muted);">Compartilhe o link abaixo com o responsável.</p>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;color:var(--text-muted);">Link de Acesso</span>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
          <input class="form-control" id="accessLinkInput" value="${Utils.escape(url)}" readonly
            style="font-size:12px;font-family:monospace;background:#fff;" />
          <button class="btn btn-outline btn-sm" onclick="AdminStudents.copyText('accessLinkInput')" title="Copiar link">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;">
          <div>
            <div style="color:var(--text-muted);font-size:11px;margin-bottom:3px;">Login (Matrícula)</div>
            <div style="font-weight:700;font-family:monospace;font-size:15px;">${Utils.escape(matricula)}</div>
          </div>
          <div>
            <div style="color:var(--text-muted);font-size:11px;margin-bottom:3px;">Senha (6 primeiros dígitos do CPF)</div>
            <div style="font-weight:700;font-family:monospace;font-size:15px;">${Utils.escape(senha)}</div>
          </div>
        </div>
      </div>
      <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:var(--radius);padding:12px;font-size:12px;color:#2e7d32;margin-bottom:12px;">
        <i class="fa-solid fa-info-circle"></i>
        O responsável acessa com a <strong>matrícula do aluno</strong> como login e os <strong>6 primeiros dígitos do CPF</strong> do aluno como senha.
      </div>
      <textarea id="textoCompartilhamento" class="form-control" rows="5" readonly
        style="font-size:12px;resize:none;">${Utils.escape(texto)}</textarea>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove();Router.go('admin-students');">Fechar</button>
       <button class="btn btn-outline" onclick="AdminStudents.copyText('textoCompartilhamento')">
         <i class="fa-solid fa-copy"></i> Copiar Mensagem
       </button>
       <button class="btn btn-primary" onclick="AdminStudents.shareWhatsApp('${encodeURIComponent(texto)}')">
         <i class="fa-brands fa-whatsapp"></i> Enviar WhatsApp
       </button>`
    );
  },

  copyText(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.select();
    document.execCommand('copy');
    Utils.toast('Copiado para a área de transferência!', 'success');
  },

  shareWhatsApp(encoded) {
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  },

  search(val) {
    window._studentsSearch = val;
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => window._reloadStudents(val, window._studentsTab), 250);
  },
  setTab(tab) {
    window._studentsTab = tab;
    window._reloadStudents(window._studentsSearch, tab);
  },
  edit(id) {
    const s = DB.getStudents().find(s => s.id === id);
    if (!s) return;
    Router.go('admin-edit-student', { studentId: id });
  },
  toggleStatus(id, current) {
    const s    = DB.getStudents().find(s => s.id === id);
    const novo = current === 'ativo' ? 'inativo' : 'ativo';
    if (novo === 'inativo') {
      // Cancelar boletos futuros pendentes ao inativar
      const hoje = new Date().toISOString().split('T')[0];
      DB.getInvoices()
        .filter(i => i.studentId === id && i.status === 'pendente' && i.dueDate > hoje)
        .forEach(i => DB.updateInvoice(i.id, { status: 'cancelado' }));
    }
    DB.updateStudent(id, { status: novo });
    Utils.toast(
      novo === 'ativo'
        ? `✅ ${s?.name || 'Aluno'} reativado! Histórico preservado.`
        : `⛔ ${s?.name || 'Aluno'} inativado. Boletos futuros cancelados. Histórico preservado.`,
      'success'
    );
    window._reloadStudents(window._studentsSearch, window._studentsTab);
  },
  // Método mantido apenas para uso interno (super admin via console se necessário)
  _forceDelete(id, name) {
    Utils.confirm(
      `⚠️ ATENÇÃO! Excluir permanentemente "${name}"?\n\nTodo o histórico (notas, frequência, financeiro) será perdido. Esta ação não pode ser desfeita.`,
      () => {
        DB.removeStudent(id);
        Utils.toast(`Aluno ${name} excluído permanentemente.`, 'success');
        window._reloadStudents(window._studentsSearch, window._studentsTab);
      }
    );
  },
  declaration(id) {
    const s    = DB.getStudents().find(s => s.id === id);
    const cls  = DB.getClasses().find(c => c.id === s.classId);
    const resp = (s.responsaveis || [])[0];
    const hoje = new Date().toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric' });
    const cfg  = DB.getSchoolConfig();
    const nome = cfg.name || 'GestEscolar';

    Utils.modal('Declaração Escolar', `
      <div id="decl-content" style="font-family:Georgia,serif;line-height:1.8;padding:8px 0;">
        ${cfg.logo ? `
        <div style="text-align:center;margin-bottom:10px;">
          <img src="${cfg.logo}" style="max-height:80px;max-width:220px;object-fit:contain;" />
        </div>` : ''}
        <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:12px;">
          <div style="font-size:18px;font-weight:700;">${Utils.escape(nome.toUpperCase())}</div>
          ${cfg.address ? `<div style="font-size:11px;color:#555;margin-top:2px;">${Utils.escape(cfg.address)}</div>` : ''}
          ${cfg.phone   ? `<div style="font-size:11px;color:#555;">${Utils.escape(cfg.phone)}</div>` : ''}
          ${cfg.cnpj    ? `<div style="font-size:11px;color:#555;">CNPJ: ${Utils.escape(cfg.cnpj)}</div>` : ''}
          <div style="font-size:14px;font-weight:700;margin-top:10px;letter-spacing:1px;">DECLARAÇÃO DE MATRÍCULA</div>
        </div>
        <p>Declaramos, para os devidos fins, que o(a) aluno(a) <strong>${Utils.escape(s.name)}</strong>,
        portador(a) do CPF <strong>${Utils.escape(s.cpf||'não informado')}</strong>,
        está regularmente matriculado(a) nesta instituição de ensino${cls?` na turma <strong>${Utils.escape(cls.name)}</strong>`:''},
        sob o número de matrícula <strong>${s.matricula}</strong>,
        com situação <strong>${s.status === 'ativo' ? 'ATIVA' : 'INATIVA'}</strong>${s.activeSince?` desde <strong>${Utils.date(s.activeSince)}</strong>`:''}.
        </p>
        ${resp ? `<p>Responsável legal: <strong>${Utils.escape(resp.nome)}</strong>.</p>` : ''}
        <p style="margin-top:24px;">Por ser verdade, firmamos a presente declaração.</p>
        <p style="text-align:right;margin-top:6px;">${hoje}</p>
        <div style="margin-top:52px;text-align:center;width:260px;margin-left:auto;margin-right:auto;border-top:1px solid #333;padding-top:6px;">
          Direção – ${Utils.escape(nome)}
        </div>
      </div>
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn btn-outline" style="flex:1;" onclick="AdminStudents.printDeclaration()">
          <i class="fa-solid fa-print"></i> Imprimir
        </button>
        <button class="btn btn-primary" style="flex:1;" onclick="AdminStudents.downloadPDF()">
          <i class="fa-solid fa-file-pdf"></i> Baixar PDF
        </button>
      </div>
    `, `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`);
  },

  printDeclaration() {
    const content = document.getElementById('decl-content');
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Declaração de Matrícula</title>
      <style>body{font-family:Georgia,serif;margin:40px;line-height:1.8;color:#000;}
      @media print{body{margin:20mm;}}</style></head>
      <body>${content.innerHTML}
      <script>window.onload=function(){window.print();setTimeout(function(){window.close();},600);}<\/script>
      </body></html>`);
    win.document.close();
  },

  async downloadPDF() {
    if (!window.jspdf) { Utils.toast('Biblioteca PDF não disponível. Verifique sua conexão.', 'danger'); return; }
    const { jsPDF } = window.jspdf;
    const cfg       = DB.getSchoolConfig();
    const nome      = cfg.name || 'GestEscolar';
    const doc       = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW     = doc.internal.pageSize.getWidth();
    const margin    = 25;
    const contentW  = pageW - margin * 2;
    let y = 20;

    // Logo
    if (cfg.logo) {
      try {
        await new Promise((res) => {
          const img = new Image();
          img.onload = () => {
            const aspect = img.width / img.height;
            const imgH   = 25;
            const imgW   = Math.min(imgH * aspect, 60);
            doc.addImage(cfg.logo, undefined, (pageW - imgW) / 2, y, imgW, imgH);
            y += imgH + 6;
            res();
          };
          img.onerror = res;
          img.src = cfg.logo;
        });
      } catch(e) {}
    }

    // Cabeçalho escola
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(nome.toUpperCase(), pageW / 2, y, { align: 'center' }); y += 7;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
    if (cfg.address) { doc.text(cfg.address, pageW / 2, y, { align: 'center' }); y += 5; }
    if (cfg.phone)   { doc.text(cfg.phone,   pageW / 2, y, { align: 'center' }); y += 5; }
    if (cfg.cnpj)    { doc.text('CNPJ: ' + cfg.cnpj, pageW / 2, y, { align: 'center' }); y += 5; }
    doc.setTextColor(0);

    // Linha divisória
    y += 3;
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Título
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('DECLARAÇÃO DE MATRÍCULA', pageW / 2, y, { align: 'center' });
    y += 14;

    // Corpo — extrai parágrafos do modal
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    const paras = document.getElementById('decl-content')?.querySelectorAll('p') || [];
    paras.forEach(p => {
      const txt = p.innerText.trim();
      if (!txt) return;
      const lines = doc.splitTextToSize(txt, contentW);
      if (p.style.textAlign === 'right') {
        lines.forEach(l => { doc.text(l, pageW - margin, y, { align: 'right' }); y += 7; });
      } else {
        doc.text(lines, margin, y);
        y += lines.length * 7 + 4;
      }
    });

    // Assinatura
    y += 18;
    const sigW = 72;
    doc.setLineWidth(0.3);
    doc.line((pageW - sigW) / 2, y, (pageW + sigW) / 2, y);
    y += 5;
    doc.setFontSize(10);
    doc.text('Direção – ' + nome, pageW / 2, y, { align: 'center' });

    doc.save('declaracao-matricula.pdf');
  }
};

// =============================================
//  CONFIGURAÇÕES DA ESCOLA
// =============================================
Router.register('admin-settings', () => {
  const user = Auth.require(); if (!user) return;
  const cfg  = DB.getSchoolConfig();
  const school = DB.getSchool(user.schoolId);
  const temSubconta = !!(school?.asaasWalletId);

  Router.renderLayout(user, 'admin-settings', `
    <h2 style="margin-bottom:20px;"><i class="fa-solid fa-gear"></i> Configurações da Escola</h2>
    <div style="display:flex;flex-direction:column;gap:20px;max-width:640px;">

      <!-- DADOS DA INSTITUIÇÃO -->
      <div class="card">
        <div class="card-header"><span class="card-title">Dados da Instituição</span></div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">

          <div>
            <label class="form-label">Nome da Escola *</label>
            <input id="cfg-name" type="text" class="form-control"
              value="${Utils.escape(cfg.name || '')}" placeholder="Ex: Escola Municipal João da Silva" maxlength="100" required />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="form-label">CNPJ *</label>
              <input id="cfg-cnpj" type="text" class="form-control"
                value="${Utils.escape(school?.cnpj || cfg.cnpj || '')}" placeholder="00.000.000/0000-00" data-mask="cnpj" maxlength="18" required />
            </div>
            <div>
              <label class="form-label">Telefone *</label>
              <input id="cfg-phone" type="text" class="form-control"
                value="${Utils.escape(school?.phone || cfg.phone || '')}" placeholder="(00) 00000-0000" data-mask="phone" maxlength="15" inputmode="numeric" required />
            </div>
          </div>

          <div>
            <label class="form-label">E-mail *</label>
            <input id="cfg-email" type="email" class="form-control"
              value="${Utils.escape(school?.email || cfg.email || '')}" placeholder="contato@escola.com.br" required />
          </div>

          <div style="display:grid;grid-template-columns:140px 1fr;gap:12px;">
            <div>
              <label class="form-label">CEP</label>
              <input id="cfg-postal-code" type="text" class="form-control"
                value="${Utils.escape(school?.postalCode || '')}" placeholder="00000-000"
                oninput="AdminSettings.debouncedBuscarCep(this.value)" />
            </div>
            <div>
              <label class="form-label">Endereço (Rua/Avenida)</label>
              <input id="cfg-address" type="text" class="form-control"
                value="${Utils.escape(school?.address || cfg.address || '')}" placeholder="Rua, Avenida..." />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:80px 1fr 1fr;gap:12px;">
            <div>
              <label class="form-label">Número</label>
              <input id="cfg-address-number" type="text" class="form-control"
                value="${Utils.escape(school?.addressNumber || '')}" placeholder="Nº" />
            </div>
            <div>
              <label class="form-label">Bairro</label>
              <input id="cfg-province" type="text" class="form-control"
                value="${Utils.escape(school?.province || '')}" placeholder="Bairro" />
            </div>
            <div>
              <label class="form-label">Complemento</label>
              <input id="cfg-complement" type="text" class="form-control"
                value="${Utils.escape(school?.complement || '')}" placeholder="Sala, Bloco..." />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 80px;gap:12px;">
            <div>
              <label class="form-label">Cidade</label>
              <input id="cfg-city" type="text" class="form-control"
                value="${Utils.escape(school?.city || '')}" placeholder="Cidade" />
            </div>
            <div>
              <label class="form-label">UF</label>
              <input id="cfg-state" type="text" class="form-control" maxlength="2"
                value="${Utils.escape(school?.state || '')}" placeholder="SP" />
            </div>
          </div>

          <div>
            <label class="form-label">Chave PIX (para resgates)</label>
            <input id="cfg-pix" type="text" class="form-control"
              value="${Utils.escape(school?.pixKey || cfg.pixKey || '')}"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              <i class="fa-solid fa-circle-info"></i> Usada para receber pagamentos PIX e solicitar resgates.
            </div>
          </div>

          <div style="padding:14px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:#f57f17;">
              <i class="fa-solid fa-percent"></i> Regra de Juros para Mensalidades Atrasadas
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label class="form-label">Multa por atraso (%)</label>
                <input id="cfg-fine" type="number" class="form-control" step="0.01" min="0" max="10"
                  value="${school?.finePercent ?? 2.0}"
                  placeholder="2.0" />
                <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
                  Cobrada uma vez ao vencer. Padrão: 2%
                </div>
              </div>
              <div>
                <label class="form-label">Juros diário (%)</label>
                <input id="cfg-interest" type="number" class="form-control" step="0.001" min="0" max="1"
                  value="${school?.interestDayPercent ?? 0.033}"
                  placeholder="0.033" />
                <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
                  Percentual ao dia após vencimento. Padrão: 0,033%/dia
                </div>
              </div>
            </div>
            <div style="font-size:11px;color:#795548;margin-top:8px;">
              <i class="fa-solid fa-circle-info"></i> Esses valores são aplicados automaticamente ao gerar PIX de mensalidades em atraso.
            </div>
          </div>

          <div>
            <label class="form-label">Logo da Escola</label>
            ${cfg.logo ? `<div style="margin-bottom:10px;padding:8px;border:1.5px solid var(--border);border-radius:var(--radius);display:inline-block;">
              <img src="${cfg.logo}" style="max-height:70px;max-width:200px;object-fit:contain;display:block;" />
            </div><br>` : ''}
            <div id="logo-preview"></div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;padding:8px 16px;
              border:1.5px dashed var(--border);border-radius:var(--radius);font-size:13px;color:var(--text-muted);">
              <i class="fa-solid fa-image"></i> Clique para selecionar a logo (PNG, JPG)
              <input type="file" id="cfg-logo" accept="image/*" style="display:none;"
                onchange="AdminSettings.previewLogo(this)" />
            </label>
            ${cfg.logo ? `<button class="btn btn-sm" style="margin-left:8px;color:var(--danger);border:1px solid var(--danger);background:transparent;"
              onclick="AdminSettings.removeLogo()"><i class="fa-solid fa-trash"></i> Remover logo</button>` : ''}
          </div>

          <div style="padding-top:8px;border-top:1px solid var(--border);">
            <button class="btn btn-primary" onclick="AdminSettings.save()">
              <i class="fa-solid fa-floppy-disk"></i> Salvar Configurações
            </button>
          </div>
        </div>
      </div>

      <!-- GATEWAY DE PAGAMENTOS -->
      <div class="card">
        <div class="card-header"><span class="card-title"><i class="fa-solid fa-credit-card"></i> Gateway de Pagamentos (PIX)</span></div>
        <div style="padding:20px;">
          ${temSubconta ? `
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:#e8f5e9;border-radius:8px;margin-bottom:16px;">
              <i class="fa-solid fa-circle-check" style="color:#2e7d32;font-size:24px;"></i>
              <div>
                <div style="font-weight:700;color:#2e7d32;">Gateway de Pagamentos Ativo</div>
                <div style="font-size:12px;color:#388e3c;">Sua escola está integrada ao Asaas. Cobranças PIX estão disponíveis.</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-muted);">
              <i class="fa-solid fa-info-circle"></i>
              Os pagamentos recebidos ficam disponíveis no seu saldo e podem ser resgatados via <strong>Financeiro → Saldo</strong>.
            </div>
          ` : `
            <div style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff8e1;border-radius:8px;margin-bottom:16px;">
              <i class="fa-solid fa-triangle-exclamation" style="color:#f57f17;font-size:24px;"></i>
              <div>
                <div style="font-weight:700;color:#f57f17;">Gateway não ativado</div>
                <div style="font-size:12px;color:#f57f17;">Ative para receber pagamentos via PIX e ter o saldo creditado automaticamente.</div>
              </div>
            </div>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
              Para ativar, é necessário enviar os documentos KYC (RG, CPF/CNPJ e comprovante de endereço) na seção "Documentos Asaas".
            </p>
            <button class="btn btn-primary" onclick="Router.go('admin-asaas-documents')">
              <i class="fa-solid fa-id-card"></i> Enviar Documentos para Ativação
            </button>
          `}
        </div>
      </div>

      <!-- SUPORTE / TUTORIAL -->
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

const AdminSettings = {
  previewLogo(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('logo-preview').innerHTML =
        `<div style="margin-bottom:8px;padding:8px;border:1.5px solid var(--secondary);border-radius:var(--radius);display:inline-block;">
           <img src="${e.target.result}" style="max-height:70px;max-width:200px;object-fit:contain;display:block;" />
         </div><br>`;
    };
    reader.readAsDataURL(input.files[0]);
  },
  save() {
    const user    = Auth.current();
    const name    = (document.getElementById('cfg-name')?.value         || '').trim();
    const address = (document.getElementById('cfg-address')?.value      || '').trim();
    const phone   = (document.getElementById('cfg-phone')?.value        || '').trim();
    const cnpj    = (document.getElementById('cfg-cnpj')?.value         || '').trim();
    const email   = (document.getElementById('cfg-email')?.value        || '').trim();
    const pixKey  = (document.getElementById('cfg-pix')?.value          || '').trim();
    const finePercent      = parseFloat(document.getElementById('cfg-fine')?.value     || '2.0');
    const interestDayPercent = parseFloat(document.getElementById('cfg-interest')?.value || '0.033');
    const postalCode    = (document.getElementById('cfg-postal-code')?.value   || '').trim();
    const addressNumber = (document.getElementById('cfg-address-number')?.value || '').trim();
    const province      = (document.getElementById('cfg-province')?.value       || '').trim();
    const complement    = (document.getElementById('cfg-complement')?.value     || '').trim();
    const city          = (document.getElementById('cfg-city')?.value           || '').trim();
    const state         = (document.getElementById('cfg-state')?.value          || '').trim().toUpperCase();
    const file    = document.getElementById('cfg-logo')?.files[0];
    const current = DB.getSchoolConfig();

    // Salva campos de endereço/contato também na tabela schools
    if (user?.schoolId) {
      DB.updateSchool(user.schoolId, { cnpj, email, phone, address, postalCode, addressNumber, province, complement, city, state, pixKey, finePercent, interestDayPercent });
    }

    const persist = (logo) => {
      DB.saveSchoolConfig({ name, address, phone, cnpj, pixKey, logo: logo ?? current.logo ?? '' });
      Utils.toast('Configurações salvas com sucesso!', 'success');
      Router.go('admin-settings');
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = e => persist(e.target.result);
      reader.readAsDataURL(file);
    } else {
      persist(null);
    }
  },

  _cepTimeout: null,

  debouncedBuscarCep(cep) {
    const input = document.getElementById('cfg-postal-code');
    const digits = cep.replace(/\D/g, '');

    clearTimeout(this._cepTimeout);

    if (digits.length === 8) {
      input.style.borderColor = '#2196F3';
      this._cepTimeout = setTimeout(() => this.buscarCep(cep), 500);
    } else {
      input.style.borderColor = '';
    }
  },

  async buscarCep(cep) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;

    const input = document.getElementById('cfg-postal-code');
    const addressInput = document.getElementById('cfg-address');

    try {
      input.style.opacity = '0.6';
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await res.json();

      if (d.erro) {
        input.style.borderColor = '#f44336';
        Utils.toast('CEP não encontrado', 'error');
        return;
      }

      if (addressInput) addressInput.value = d.logradouro || '';
      const provInput = document.getElementById('cfg-province');
      if (provInput) provInput.value = d.bairro || '';
      const cityInput = document.getElementById('cfg-city');
      if (cityInput) cityInput.value = d.localidade || '';
      const stateInput = document.getElementById('cfg-state');
      if (stateInput) stateInput.value = d.uf || '';

      input.style.borderColor = '#4caf50';
      input.style.opacity = '1';
      Utils.toast('Endereço preenchido com sucesso', 'success');
    } catch (e) {
      input.style.borderColor = '#f44336';
      input.style.opacity = '1';
      Utils.toast('Erro ao buscar CEP. Tente novamente.', 'error');
    }
  },

  async ativarGateway() {
    const user   = Auth.current();
    const school = DB.getSchool(user?.schoolId);
    if (!school) return;

    if (school.asaasWalletId) {
      Utils.toast('Gateway já está ativo para esta escola.', 'info');
      return;
    }

    // Validar campos obrigatórios
    const missing = [];
    if (!school.cnpj)          missing.push('CNPJ');
    if (!school.email)         missing.push('E-mail');
    if (!school.postalCode)    missing.push('CEP');
    if (!school.address)       missing.push('Endereço');
    if (!school.addressNumber) missing.push('Número');
    if (!school.province)      missing.push('Bairro');
    if (missing.length) {
      Utils.toast(`Preencha e salve os campos: ${missing.join(', ')}`, 'error');
      return;
    }

    Utils.toast('Criando subconta Asaas...', 'info');
    const result = await AsaasClient.createSubaccount({
      name:          school.name,
      cpfCnpj:       school.cnpj,
      email:         school.email,
      phone:         school.phone || '',
      postalCode:    school.postalCode,
      address:       school.address,
      addressNumber: school.addressNumber,
      complement:    school.complement || '',
      province:      school.province,
      city:          school.city || '',
      state:         school.state || '',
    });

    if (!result) return;

    DB.updateSchool(user.schoolId, {
      asaasAccountId: result.id      || '',
      asaasWalletId:  result.walletId || '',
      asaasSubApiKey: result.apiKey   || '',
    });

    Utils.toast('Gateway de Pagamentos ativado com sucesso!', 'success');
    Router.go('admin-settings');
  },

  removeLogo() {
    const cfg = DB.getSchoolConfig();
    DB.saveSchoolConfig({ ...cfg, logo: '' });
    Utils.toast('Logo removida!', 'success');
    Router.go('admin-settings');
  }
};

// ---------- NOVO ALUNO (formulário) ----------
Router.register('admin-new-student', (params) => {
  const user = Auth.require(); if (!user) return;
  _renderStudentForm(user, null);
});

Router.register('admin-edit-student', (params) => {
  const user = Auth.require(); if (!user) return;
  const student = DB.getStudents().find(s => s.id === params?.studentId);
  _renderStudentForm(user, student);
});

function _renderStudentForm(user, student) {
  const classes = DB.getClasses();
  const isEdit  = !!student;
  const s       = student || {};
  const resps   = (s.responsaveis && s.responsaveis.length) ? s.responsaveis : [{ nome:'', email:'', telefone:'', whatsapp:'' }];

  Router.renderLayout(user, 'admin-students', `
    <div class="card">
      <div class="card-header">
        <span class="card-title">
          <i class="fa-solid fa-${isEdit?'pen':'user-plus'}"></i>
          ${isEdit ? 'Editar Aluno' : 'Novo Aluno'}
          ${isEdit && s.matricula ? `<span style="font-size:13px;color:var(--text-muted);font-weight:400;margin-left:8px;">Matrícula: ${s.matricula}</span>` : ''}
        </span>
        <button class="btn btn-outline btn-sm" onclick="Router.go('admin-students')">
          Voltar
        </button>
      </div>

      <form id="studentForm" onsubmit="StudentForm.save(event,'${s.id||''}')">

        <!-- DADOS DO ALUNO -->
        <div class="form-section-title">Dados do Aluno</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nome Completo *</label>
            <input class="form-control" id="stName" value="${Utils.escape(s.name||'')}" required placeholder="Nome completo do aluno" data-mask="name" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label">Data de Nascimento *</label>
            <input type="date" class="form-control" id="stDob" value="${s.birthDate||s.dob||''}" required min="1900-01-01" max="${new Date().toISOString().slice(0,10)}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">CPF *</label>
            <input class="form-control" id="stCpf" value="${Utils.escape(s.cpf||'')}" placeholder="000.000.000-00" maxlength="14" required inputmode="numeric" />
          </div>
          <div class="form-group">
            <label class="form-label">Turma</label>
            <select class="form-control" id="stClass">
              <option value="">Selecione a turma</option>
              ${classes.map(c=>`<option value="${c.id}" ${s.classId===c.id?'selected':''}>${Utils.escape(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="stStatus">
              <option value="ativo"   ${(s.status||'ativo')==='ativo'  ?'selected':''}>Ativo</option>
              <option value="inativo" ${s.status==='inativo'?'selected':''}>Inativo</option>
            </select>
          </div>
          ${isEdit ? `
          <div class="form-group">
            <label class="form-label">Ativo desde</label>
            <input class="form-control" value="${s.activeSince?Utils.date(s.activeSince):'–'}" disabled style="background:#f8f9fa;color:var(--text-muted);" />
          </div>` : ''}
        </div>

        <!-- RESPONSÁVEIS -->
        <div class="form-section-title" style="display:flex;align-items:center;justify-content:space-between;">
          <span>Responsáveis</span>
          <button type="button" class="btn btn-outline btn-sm" onclick="StudentForm.addResp()">
            <i class="fa-solid fa-plus"></i> Adicionar responsável
          </button>
        </div>
        <div id="respsContainer">
          ${resps.map((r,i) => _respHTML(r, i)).join('')}
        </div>

        <!-- FINANCEIRO -->
        <div class="form-section-title">Financeiro</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Mensalidade (R$) *</label>
            <input type="number" class="form-control" id="stFee" value="${s.monthlyFee||''}" min="0" step="0.01" required placeholder="0,00" />
          </div>
          <div class="form-group">
            <label class="form-label">Dia de vencimento *</label>
            <input type="number" class="form-control" id="stDueDay" value="${s.dueDay||10}" min="1" max="31" required />
            <span style="font-size:11px;color:var(--text-muted);">Entre 1 e 31</span>
          </div>
        </div>

        ${isEdit && s.accessLink ? `
        <!-- ACESSO DO RESPONSÁVEL -->
        <div class="form-section-title" style="margin-top:24px;">
          <i class="fa-solid fa-link"></i> Acesso do Responsável
        </div>
        <div style="background:#e8f5e9;border:1.5px solid #a5d6a7;border-radius:8px;padding:16px;margin-bottom:8px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
            <div>
              <div style="font-size:11px;font-weight:700;color:#388e3c;text-transform:uppercase;margin-bottom:2px;">Login (Matrícula)</div>
              <div style="font-size:15px;font-weight:700;color:#1b5e20;">${s.loginMatricula || s.matricula || ''}</div>
            </div>
            <div>
              <div style="font-size:11px;font-weight:700;color:#388e3c;text-transform:uppercase;margin-bottom:2px;">Senha</div>
              <div style="font-size:15px;font-weight:700;color:#1b5e20;">${s.loginSenha || '(5 primeiros dígitos do CPF)'}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input id="fichaAccessLink" type="text" value="${s.accessLink}" readonly
              style="flex:1;padding:8px 10px;border:1px solid #a5d6a7;border-radius:6px;font-size:12px;background:#fff;color:#333;" />
            <button type="button" onclick="AdminStudents.copyText('fichaAccessLink')"
              style="padding:8px 14px;border:none;border-radius:6px;background:#388e3c;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
              <i class="fa-solid fa-copy"></i> Copiar
            </button>
            <button type="button" onclick="AdminStudents.shareWhatsApp(encodeURIComponent('Olá! Segue o acesso ao portal do aluno ${Utils.escape(s.name||'')}:\\n\\nLogin: ${s.loginMatricula || s.matricula || ''}\\nSenha: ${s.loginSenha || ''}\\nLink: ${s.accessLink}'))"
              style="padding:8px 14px;border:none;border-radius:6px;background:#25D366;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </button>
          </div>
        </div>
        ` : ''}

        <!-- BOTÕES -->
        <div style="display:flex;gap:12px;margin-top:24px;">
          <button type="button" onclick="Router.go('admin-students')"
            style="padding:10px 28px;border:1.5px solid #dadce0;border-radius:8px;background:#fff;color:#5f6368;font-weight:600;font-size:14px;cursor:pointer;">
            CANCELAR
          </button>
          <button type="submit"
            style="padding:10px 32px;border:none;border-radius:8px;background:#1a73e8;color:#fff;font-weight:700;font-size:14px;cursor:pointer;">
            SALVAR
          </button>
        </div>
      </form>
    </div>
  `);

  // Máscara CPF
  document.getElementById('stCpf')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g,'').substring(0,11);
    v = v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
    e.target.value = v;
  });
}

function _validateCpf(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function _respHTML(r, i) {
  return `
    <div class="resp-block" id="resp-${i}" style="background:#f8f9fa;border:1.5px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:12px;position:relative;">
      ${i > 0 ? `<button type="button" onclick="StudentForm.removeResp(${i})"
        style="position:absolute;top:10px;right:10px;background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;">
        <i class="fa-solid fa-xmark"></i></button>` : ''}
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px;">
        ${i === 0 ? 'Responsável Principal' : `Responsável ${i+1}`}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nome do responsável *</label>
          <input class="form-control resp-nome" data-idx="${i}" value="${Utils.escape(r.nome||'')}" required minlength="6" placeholder="Nome completo (mín. 6 caracteres)" data-mask="name" maxlength="80" />
        </div>
        <div class="form-group">
          <label class="form-label">E-mail *</label>
          <input type="email" class="form-control resp-email" data-idx="${i}" value="${Utils.escape(r.email||'')}" placeholder="email@exemplo.com" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Telefone *</label>
          <input class="form-control resp-tel" data-idx="${i}" value="${Utils.escape(r.telefone||'')}" required placeholder="(00) 00000-0000" maxlength="15" data-mask="phone" inputmode="numeric" />
        </div>
        <div class="form-group">
          <label class="form-label">WhatsApp *</label>
          <input class="form-control resp-wpp" data-idx="${i}" value="${Utils.escape(r.whatsapp||'')}" required placeholder="(00) 00000-0000" maxlength="15" data-mask="phone" inputmode="numeric" />
        </div>
      </div>
    </div>
  `;
}

const StudentForm = {
  _respCount: 1,

  addResp() {
    const container = document.getElementById('respsContainer');
    const idx = container.querySelectorAll('.resp-block').length;
    container.insertAdjacentHTML('beforeend', _respHTML({ nome:'', email:'', telefone:'', whatsapp:'' }, idx));
    this._applyMasks();
  },

  removeResp(i) {
    document.getElementById(`resp-${i}`)?.remove();
  },

  _applyMasks() {
    // Máscara de telefone agora é aplicada globalmente via data-mask="phone" (utils.js)
  },

  _collectResps() {
    const blocks = document.querySelectorAll('.resp-block');
    return Array.from(blocks).map(b => ({
      nome:      b.querySelector('.resp-nome')?.value.trim()  || '',
      email:     b.querySelector('.resp-email')?.value.trim() || '',
      telefone:  b.querySelector('.resp-tel')?.value.trim()   || '',
      whatsapp:  b.querySelector('.resp-wpp')?.value.trim()   || '',
    }));
  },

  async save(e, id) {
    e.preventDefault();
    const demo = Auth.isDemo();
    const responsaveis = this._collectResps();

    // Validações — ignoradas para usuário demo
    if (!demo) {
      if (!responsaveis.length) { Utils.toast('Adicione pelo menos um responsável.', 'error'); return; }
      for (let i = 0; i < responsaveis.length; i++) {
        const r = responsaveis[i];
        const label = i === 0 ? 'Responsável Principal' : `Responsável ${i+1}`;
        if (r.nome.length < 6) { Utils.toast(`${label}: nome deve ter no mínimo 6 caracteres.`, 'error'); return; }
        if (!r.email)           { Utils.toast(`${label}: e-mail é obrigatório.`, 'error'); return; }
        if (!r.telefone)        { Utils.toast(`${label}: telefone é obrigatório.`, 'error'); return; }
        if (!r.whatsapp)        { Utils.toast(`${label}: WhatsApp é obrigatório.`, 'error'); return; }
      }
    }

    const cpfRaw = document.getElementById('stCpf').value;
    if (!demo) {
      if (!cpfRaw) {
        Utils.toast('CPF é obrigatório para cadastrar o aluno.', 'error'); return;
      }
      if (!_validateCpf(cpfRaw)) {
        Utils.toast('CPF inválido. Verifique o número informado.', 'error'); return;
      }
    }

    const data = {
      name:        document.getElementById('stName').value.trim(),
      birthDate:   document.getElementById('stDob').value,
      cpf:         cpfRaw,
      classId:     document.getElementById('stClass').value,
      status:      document.getElementById('stStatus').value,
      responsaveis,
      parentName:  responsaveis[0]?.nome  || '',
      parentEmail: responsaveis[0]?.email || '',
      phone:       responsaveis[0]?.telefone || '',
      monthlyFee:  parseFloat(document.getElementById('stFee').value) || 0,
      dueDay:      parseInt(document.getElementById('stDueDay').value) || 10,
    };
    if (!data.name) { Utils.toast('Nome é obrigatório.', 'error'); return; }

    if (id) {
      DB.updateStudent(id, data);
      Utils.toast('Aluno atualizado com sucesso!', 'success');
      Router.go('admin-students');
    } else {
      // Verificar limite do plano
      const limCheck = Auth.checkLimit('students');
      if (!limCheck.ok) { Plans.showUpgradeModal(limCheck.msg); return; }
      const created = await DB.addStudent(data);
      if (!created) return; // INSERT falhou — erro j\u00e1 exibido via toast

      // ── Gerar mensalidades automáticas: mês atual → dezembro ─────────────
      const hoje     = new Date();
      const ano      = hoje.getFullYear();
      const mesInicio = hoje.getMonth(); // 0-indexed
      const nomeMes  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      for (let m = mesInicio; m < 12; m++) {
        // Garante que o dia de vencimento não ultrapasse o último dia do mês
        const ultimoDia = new Date(ano, m + 1, 0).getDate();
        const dia = Math.min(data.dueDay, ultimoDia);
        const venc = `${ano}-${String(m + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        DB.addInvoice({
          studentId:   created.id,
          studentName: created.name,
          description: `Mensalidade ${nomeMes[m]}/${ano}`,
          amount:      data.monthlyFee,
          dueDate:     venc,
        });
      }

      // ── Salvar link de acesso na ficha do aluno ─────────────────────────
      // A senha sempre existe agora (DB.addStudent gera fallback usando matricula)
      const loginUrl  = window.location.origin + window.location.pathname;
      const parentUsr = DB.getUsers().find(u => u.studentId === created.id && u.role === 'pai');
      const senha     = parentUsr?.password || String(created.matricula).slice(-6);
      const origem    = created.parentLoginPasswordOrigin || 'desconhecida';
      DB.updateStudent(created.id, { accessLink: loginUrl, loginMatricula: created.matricula, loginSenha: senha });
      if (origem !== 'cpf-responsavel') {
        const aviso = origem === 'cpf-aluno'
          ? '⚠️ CPF do responsável ausente — senha gerada a partir do CPF do aluno.'
          : '⚠️ Nenhum CPF informado — senha gerada a partir da matrícula. Recomenda-se atualizar o cadastro.';
        Utils.toast(aviso, 'warning');
      }
      AdminStudents.showAccessModal(created.name, created.matricula, senha, loginUrl);
    }
  }
};

// Aplicar máscaras ao inicializar
setTimeout(() => StudentForm._applyMasks(), 300);

// ---------- FUNCIONÁRIOS ----------
Router.register('admin-staff', () => {
  const user = Auth.require(); if (!user) return;

  const render = (tab = 'ativos') => {
    const all      = DB.getUsers().filter(u => u.role !== 'pai');
    const ativos   = all.filter(u => u.active);
    const inativos = all.filter(u => !u.active);
    const lista    = tab === 'ativos' ? ativos : tab === 'inativos' ? inativos : all;

    const row = u => `
      <tr style="${!u.active ? 'opacity:.65;' : ''}">
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${u.active ? 'var(--primary)' : '#aaa'};
              color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;">
              ${Utils.initials(u.name)}
            </div>
            <div>
              <strong>${Utils.escape(u.name)}</strong>
              ${!u.active ? '<br><span style="font-size:10px;color:var(--danger);">desligado</span>' : ''}
            </div>
          </div>
        </td>
        <td>${Utils.escape(u.email)}</td>
        <td>${Utils.escape(u.cpf || '–')}</td>
        <td>${Utils.escape(u.phone || '–')}</td>
        <td><span class="badge badge-${Auth.roleBadgeColor(u.role)}">${Auth.roleLabel(u.role)}</span></td>
        <td>${u.active ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge badge-red">Desligado</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="AdminStaff.openEdit('${u.id}')" style="white-space:nowrap;">
            <i class="fa-solid fa-pen"></i> Editar
          </button>
          ${u.active
            ? `<button class="btn btn-sm btn-danger" onclick="AdminStaff.confirmDesligar('${u.id}','${Utils.escape(u.name)}')"
                style="white-space:nowrap;">
                Desligar
              </button>`
            : `<button class="btn btn-sm btn-secondary" onclick="AdminStaff.reativar('${u.id}','${Utils.escape(u.name)}')"
                style="background:#e8f5e9;color:#2e7d32;border:1.5px solid #a5d6a7;white-space:nowrap;">
                Reativar
              </button>`}
        </td>
      </tr>`;

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-users"></i> Funcionários</span>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" onclick="Router.go('register', {preRole:'professor'})">
              <i class="fa-solid fa-chalkboard-teacher"></i> Novo Professor
            </button>
            <button class="btn btn-outline btn-sm" onclick="Router.go('register')">
              <i class="fa-solid fa-user-plus"></i> Novo Funcionário
            </button>
          </div>
        </div>

        <!-- Abas -->
        <div class="tabs" style="padding:0 16px;">
          <button class="tab-btn ${tab==='ativos'?'active':''}" onclick="AdminStaff.setTab('ativos')">
            <i class="fa-solid fa-circle-check" style="color:var(--secondary);"></i> Ativos
            <span style="background:#e8f5e9;color:#2e7d32;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${ativos.length}</span>
          </button>
          <button class="tab-btn ${tab==='inativos'?'active':''}" onclick="AdminStaff.setTab('inativos')">
            <i class="fa-solid fa-power-off" style="color:var(--danger);"></i> Desligados
            <span style="background:#ffebee;color:#c62828;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${inativos.length}</span>
          </button>
          <button class="tab-btn ${tab==='todos'?'active':''}" onclick="AdminStaff.setTab('todos')">
            Todos
            <span style="background:#e8f0fe;color:#1a73e8;border-radius:20px;padding:0 8px;font-size:11px;font-weight:700;margin-left:4px;">${all.length}</span>
          </button>
        </div>

        ${tab === 'inativos' ? `
        <div style="margin:0 16px 12px;padding:10px 14px;background:#fff8e1;border-left:4px solid #f9ab00;border-radius:6px;font-size:13px;color:#7a5f00;">
          <i class="fa-solid fa-circle-info"></i>
          Funcionários desligados ficam no histórico do sistema. Clique em <strong>Reativar</strong> para restaurar o acesso.
        </div>` : ''}

        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>CPF</th><th>Telefone</th><th>Função</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${lista.length === 0
              ? `<tr><td colspan="7"><div class="empty-state">
                  <i class="fa-solid fa-users"></i>
                  <p>${tab==='inativos' ? 'Nenhum funcionário desligado.' : 'Nenhum funcionário encontrado.'}</p>
                </div></td></tr>`
              : lista.map(row).join('')}
          </tbody>
        </table></div>
      </div>`;
  };

  Router.renderLayout(user, 'admin-staff', render());
  window._staffTab    = 'ativos';
  window._reloadStaff = (tab) => {
    const t = tab ?? window._staffTab ?? 'ativos';
    document.getElementById('page-content').innerHTML = render(t);
  };
});

const AdminStaff = {
  _togglePass(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
  },

  setTab(tab) {
    window._staffTab = tab;
    window._reloadStaff(tab);
  },

  confirmDesligar(id, nome) {
    // Modal de confirmação
    const overlay = document.createElement('div');
    overlay.id = 'desligar-modal';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:'9999'
    });
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;
                  box-shadow:0 8px 32px rgba(0,0,0,.18);text-align:center;">
        <div style="font-size:44px;margin-bottom:12px;">⚠️</div>
        <h3 style="margin:0 0 10px;font-size:18px;color:#c62828;">Desligar Funcionário</h3>
        <p style="color:var(--text-muted);font-size:14px;margin:0 0 6px;">
          Tem certeza que deseja desligar
        </p>
        <p style="font-weight:700;font-size:16px;margin:0 0 20px;">"${Utils.escape(nome)}"?</p>
        <p style="font-size:12px;color:var(--text-muted);background:#f8f9fa;padding:10px;border-radius:6px;margin-bottom:24px;">
          <i class="fa-solid fa-info-circle"></i>
          O funcionário perderá o acesso ao sistema imediatamente, mas seu histórico será preservado.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button onclick="document.getElementById('desligar-modal').remove()"
            style="padding:10px 24px;border:1.5px solid var(--border);border-radius:8px;
                   background:#fff;color:var(--text-muted);font-size:14px;cursor:pointer;font-weight:600;">
            Cancelar
          </button>
          <button onclick="AdminStaff._executarDesligar('${id}','${Utils.escape(nome)}')"
            style="padding:10px 24px;border:none;border-radius:8px;
                   background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;">
            <i class="fa-solid fa-power-off"></i> Confirmar Desligamento
          </button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _executarDesligar(id, nome) {
    document.getElementById('desligar-modal')?.remove();
    DB.updateUser(id, { active: false });
    Utils.toast(`${nome} foi desligado(a) do sistema.`, 'success');
    window._reloadStaff('ativos');
  },

  reativar(id, nome) {
    DB.updateUser(id, { active: true });
    Utils.toast(`${nome} foi reativado(a) com sucesso!`, 'success');
    window._reloadStaff('inativos');
  },

  openEdit(id) {
    const u = DB.getUsers().find(x => x.id === id);
    if (!u) return;
    const roles = ['administrativo','financeiro','professor','gestor'];
    const roleOpts = roles.map(r => `<option value="${r}" ${u.role===r?'selected':''}>${r.charAt(0).toUpperCase()+r.slice(1)}</option>`).join('');
    Utils.modal('Editar Funcionário', `
      <form id="editStaffForm">
        <div class="form-group">
          <label class="form-label">Nome *</label>
          <input class="form-control" id="editStaffName" value="${Utils.escape(u.name)}" required data-mask="name" maxlength="80">
        </div>
        <div class="form-group">
          <label class="form-label">E-mail *</label>
          <input class="form-control" id="editStaffEmail" type="email" value="${Utils.escape(u.email)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">CPF *</label>
          <input class="form-control" id="editStaffCpf" value="${Utils.escape(u.cpf||'')}" required maxlength="14" inputmode="numeric" placeholder="000.000.000-00">
        </div>
        <div class="form-group">
          <label class="form-label">Telefone *</label>
          <input class="form-control" id="editStaffPhone" value="${Utils.escape(u.phone||'')}" data-mask="phone" maxlength="15" inputmode="numeric" placeholder="(00) 00000-0000" required>
        </div>
        <div class="form-group">
          <label class="form-label">Função</label>
          <select class="form-control" id="editStaffRole">${roleOpts}</select>
        </div>
        <hr style="margin:16px 0;border-color:var(--border);">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">
          <i class="fa-solid fa-lock"></i> Alterar Senha (opcional)
        </div>
        <div class="form-group">
          <label class="form-label">Nova Senha</label>
          <div style="position:relative;">
            <input class="form-control" id="editStaffNewPassword" type="password" placeholder="Deixe em branco para não alterar" autocomplete="new-password" style="padding-right:40px;">
            <button type="button" onclick="AdminStaff._togglePass('editStaffNewPassword',this)" tabindex="-1"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0;">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar Nova Senha</label>
          <div style="position:relative;">
            <input class="form-control" id="editStaffConfirmPassword" type="password" placeholder="Repita a nova senha" autocomplete="new-password" style="padding-right:40px;">
            <button type="button" onclick="AdminStaff._togglePass('editStaffConfirmPassword',this)" tabindex="-1"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0;">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </div>
        <button type="button" class="btn btn-primary" onclick="AdminStaff.saveEdit('${id}')" style="width:100%;margin-top:12px;">
          <i class="fa-solid fa-floppy-disk"></i> Salvar
        </button>
      </form>
    `);
  },

  async saveEdit(id) {
    const name     = document.getElementById('editStaffName').value.trim();
    const email    = document.getElementById('editStaffEmail').value.trim();
    const cpf      = document.getElementById('editStaffCpf').value.trim();
    const phone    = document.getElementById('editStaffPhone').value.trim();
    const role     = document.getElementById('editStaffRole').value;
    const newPass  = document.getElementById('editStaffNewPassword').value;
    const confPass = document.getElementById('editStaffConfirmPassword').value;

    if (!name || !email) { Utils.toast('Nome e E-mail são obrigatórios.', 'error'); return; }

    // Validação de senha se preenchida
    if (newPass || confPass) {
      if (newPass.length < 6) { Utils.toast('A senha deve ter pelo menos 6 caracteres.', 'error'); return; }
      if (newPass !== confPass) { Utils.toast('As senhas não coincidem.', 'error'); return; }
    }

    // Atualiza dados cadastrais
    const updateData = { name, email, cpf, phone, role };
    if (newPass) updateData.password = newPass;
    DB.updateUser(id, updateData);

    // Se há nova senha, atualiza no Supabase Auth via API admin
    if (newPass) {
      try {
        const session = await supabaseClient.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) throw new Error('Sessão expirada. Faça login novamente.');

        const u = DB.getUsers().find(x => x.id === id);
        let authId = u?.authId;

        // Se não tem authId, cria o usuário no Supabase Auth primeiro
        if (!authId) {
          const cr = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'createAuthUser', data: { email: u.email, password: newPass, name: u.name, role: u.role } }),
          });
          const crResult = await cr.json();
          if (!cr.ok) throw new Error(crResult.error || 'Erro ao criar conta Auth.');
          authId = crResult.authId;
          DB.updateUser(id, { authId });
        } else {
          // Usuário já existe — apenas atualiza a senha
          const r = await fetch('/api/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'updateUserPassword', data: { authId, password: newPass } }),
          });
          const result = await r.json();
          if (!r.ok) throw new Error(result.error || 'Erro na API.');
        }

        Utils.toast('Funcionário e senha atualizados com sucesso!', 'success');
      } catch (e) {
        Utils.toast('Erro ao atualizar senha: ' + e.message, 'error');
      }
    } else {
      Utils.toast('Funcionário atualizado!', 'success');
    }

    document.querySelector('.modal-overlay')?.remove();
    window._reloadStaff();
  },
};

// ---------- TURMAS ----------
Router.register('admin-classes', () => {
  const user = Auth.require(); if (!user) return;
  const render = () => {
    const classes  = DB.getClasses();
    const students = DB.getStudents();
    const teachers = DB.getUsers().filter(u => u.role === 'professor');
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-chalkboard"></i> Turmas</span>
          <button class="btn btn-primary btn-sm" onclick="AdminClasses.openNew()">
            <i class="fa-solid fa-plus"></i> Nova Turma
          </button>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Turma</th><th>Ano</th><th>Turno</th><th>Professor(a)</th><th>Alunos</th><th>Ações</th></tr></thead>
          <tbody>
            ${classes.length === 0
              ? `<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-chalkboard"></i><p>Nenhuma turma</p></div></td></tr>`
              : classes.map(c => {
                  const teacher = teachers.find(t => t.id === c.teacherId);
                  const count   = students.filter(s => s.classId === c.id && s.status === 'ativo').length;
                  return `<tr>
                    <td><strong>${Utils.escape(c.name)}</strong></td>
                    <td>${c.year}</td><td>${Utils.escape(c.shift||'–')}</td>
                    <td>${teacher ? Utils.escape(teacher.name) : '<span class="text-muted">Sem professor</span>'}</td>
                    <td><span class="badge badge-blue">${count} alunos</span></td>
                    <td style="display:flex;gap:8px;flex-wrap:wrap;">
                      <button class="btn btn-outline btn-sm" onclick="AdminClasses.viewStudents('${c.id}','${Utils.escape(c.name)}')">
                        <i class="fa-solid fa-eye"></i> Ver Turma
                      </button>
                      ${(user.role === 'gestor' || user.role === 'administrativo' || (user.roles && (user.roles.includes('gestor') || user.roles.includes('administrativo')))) ? `
                      <button class="btn btn-outline btn-sm" onclick="AdminClasses.editTurma('${c.id}')">
                        <i class="fa-solid fa-pencil"></i> Editar
                      </button>
                      <button class="btn btn-outline btn-sm" onclick="AdminClasses.manageStudents('${c.id}','${Utils.escape(c.name)}')">
                        <i class="fa-solid fa-user-plus"></i> Adicionar Alunos
                      </button>` : ''}
                      <button class="btn btn-danger btn-sm" onclick="AdminClasses.confirmDelete('${c.id}','${Utils.escape(c.name)}',${count})">
                        Excluir
                      </button>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table></div>
      </div>`;
  };
  Router.renderLayout(user, 'admin-classes', render());
  window._reloadClasses = () => { document.getElementById('page-content').innerHTML = render(); };
});

const MATERIAS_MEC = {
  'Educação Infantil (Creche e Pré-escola)': [
    'Linguagem Oral e Escrita', 'Matemática (Iniciação)', 'Arte e Música',
    'Educação Física / Psicomotricidade', 'Ciências da Natureza',
    'Ciências Sociais / Sociedade e Cultura', 'Ensino Religioso',
    'Informática (Iniciação)'
  ],
  'Ensino Fundamental – Anos Iniciais (1º ao 5º ano)': [
    'Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia',
    'Arte', 'Educação Física', 'Ensino Religioso'
  ],
  'Ensino Fundamental – Anos Finais (6º ao 9º ano)': [
    'Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia',
    'Arte', 'Educação Física', 'Língua Inglesa', 'Ensino Religioso'
  ],
  'Ensino Médio': [
    'Língua Portuguesa', 'Literatura', 'Redação', 'Matemática',
    'Biologia', 'Física', 'Química', 'História', 'Geografia',
    'Filosofia', 'Sociologia', 'Arte', 'Educação Física',
    'Língua Inglesa', 'Língua Espanhola'
  ],
  'Disciplinas Complementares / Eletivas': [
    'Informática / Tecnologia', 'Educação do Campo', 'Projeto de Vida',
    'Empreendedorismo', 'Língua Brasileira de Sinais (LIBRAS)'
  ]
};

const AdminClasses = {
  openNew() {
    const teachers = DB.getUsers().filter(u => u.role === 'professor');
    const allMaterias = [...new Set(Object.values(MATERIAS_MEC).flat())].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    Utils.modal('Nova Turma', `
      <form id="classForm">
        <div class="form-group">
          <label class="form-label">Nome da turma *</label>
          <input class="form-control" id="clName" placeholder="Ex: 5º Ano A" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ano letivo *</label>
            <input type="number" class="form-control" id="clYear" value="${new Date().getFullYear()}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Turno *</label>
            <select class="form-control" id="clShift" required>
              <option value="">Selecione</option>
              <option>Manhã</option><option>Tarde</option><option>Integral</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Professor responsável *</label>
          <select class="form-control" id="clTeacher" required>
            <option value="">Selecione um professor</option>
            ${teachers.map(t => `<option value="${t.id}">${Utils.escape(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Selecione as Matérias da turma *</label>
          <div id="materias-wrap" style="border:1.5px solid var(--border);border-radius:var(--radius);padding:12px;max-height:260px;overflow-y:auto;background:#fafafa;">
            ${Object.entries(MATERIAS_MEC).map(([nivel, materias]) => `
              <div style="margin-bottom:12px;">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">${nivel}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px;">
                  ${materias.map(m => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:3px 2px;">
                      <input type="checkbox" name="materia" value="${Utils.escape(m)}"
                        style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer;">
                      ${Utils.escape(m)}
                    </label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
            <span id="materias-count">0</span> matéria(s) selecionada(s)
          </div>
        </div>
      </form>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="AdminClasses.save()">Salvar Turma</button>`
    );

    // Contador dinâmico de seleção
    document.getElementById('materias-wrap').addEventListener('change', () => {
      const count = document.querySelectorAll('input[name="materia"]:checked').length;
      document.getElementById('materias-count').textContent = count;
    });
  },

  save() {
    const name    = document.getElementById('clName').value.trim();
    const year    = document.getElementById('clYear').value.trim();
    const shift   = document.getElementById('clShift').value;
    const teacher = document.getElementById('clTeacher').value;

    if (!name)    { Utils.toast('Informe o nome da turma.', 'error'); return; }
    if (!year)    { Utils.toast('Informe o ano letivo.', 'error'); return; }
    if (!shift)   { Utils.toast('Selecione o turno.', 'error'); return; }
    if (!teacher) { Utils.toast('Selecione um professor responsável.', 'error'); return; }

    const subjects = Array.from(document.querySelectorAll('input[name="materia"]:checked'))
      .map(cb => cb.value);

    if (subjects.length === 0) { Utils.toast('Selecione ao menos uma matéria.', 'error'); return; }

    DB.addClass({
      name,
      year:      document.getElementById('clYear').value,
      shift:     document.getElementById('clShift').value,
      teacherId: document.getElementById('clTeacher').value,
      subjects
    });
    Utils.toast('Turma criada!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    window._reloadClasses?.();
  },

  editTurma(classId) {
    const cls = DB.getClasses().find(c => c.id === classId);
    if (!cls) {
      Utils.toast('Turma não encontrada.', 'error');
      return;
    }

    const teachers = DB.getUsers().filter(u => u.role === 'professor');
    const currentSubjects = new Set(cls.subjects || []);

    Utils.modal('Editar Turma', `
      <form id="classForm">
        <div class="form-group">
          <label class="form-label">Nome da turma *</label>
          <input class="form-control" id="clName" placeholder="Ex: 5º Ano A" value="${Utils.escape(cls.name)}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ano letivo *</label>
            <input type="number" class="form-control" id="clYear" value="${cls.year}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Turno *</label>
            <select class="form-control" id="clShift" required>
              <option value="">Selecione</option>
              <option value="Manhã" ${cls.shift === 'Manhã' ? 'selected' : ''}>Manhã</option>
              <option value="Tarde" ${cls.shift === 'Tarde' ? 'selected' : ''}>Tarde</option>
              <option value="Integral" ${cls.shift === 'Integral' ? 'selected' : ''}>Integral</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Professor responsável *</label>
          <select class="form-control" id="clTeacher" required>
            <option value="">Selecione um professor</option>
            ${teachers.map(t => `<option value="${t.id}" ${cls.teacherId === t.id ? 'selected' : ''}>${Utils.escape(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Selecione as Matérias da turma *</label>
          <div id="materias-wrap" style="border:1.5px solid var(--border);border-radius:var(--radius);padding:12px;max-height:260px;overflow-y:auto;background:#fafafa;">
            ${Object.entries(MATERIAS_MEC).map(([nivel, materias]) => `
              <div style="margin-bottom:12px;">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">${nivel}</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px;">
                  ${materias.map(m => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;padding:3px 2px;">
                      <input type="checkbox" name="materia" value="${Utils.escape(m)}" ${currentSubjects.has(m) ? 'checked' : ''}
                        style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer;">
                      ${Utils.escape(m)}
                    </label>`).join('')}
                </div>
              </div>`).join('')}
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
            <span id="materias-count">${currentSubjects.size}</span> matéria(s) selecionada(s)
          </div>
        </div>
      </form>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="AdminClasses.saveEdit('${classId}')">Salvar Turma</button>`
    );

    // Contador dinâmico de seleção
    document.getElementById('materias-wrap').addEventListener('change', () => {
      const count = document.querySelectorAll('input[name="materia"]:checked').length;
      document.getElementById('materias-count').textContent = count;
    });
  },

  saveEdit(classId) {
    const name    = document.getElementById('clName').value.trim();
    const year    = document.getElementById('clYear').value.trim();
    const shift   = document.getElementById('clShift').value;
    const teacher = document.getElementById('clTeacher').value;

    if (!name)    { Utils.toast('Informe o nome da turma.', 'error'); return; }
    if (!year)    { Utils.toast('Informe o ano letivo.', 'error'); return; }
    if (!shift)   { Utils.toast('Selecione o turno.', 'error'); return; }
    if (!teacher) { Utils.toast('Selecione um professor responsável.', 'error'); return; }

    const subjects = Array.from(document.querySelectorAll('input[name="materia"]:checked'))
      .map(cb => cb.value);

    if (subjects.length === 0) { Utils.toast('Selecione ao menos uma matéria.', 'error'); return; }

    DB.updateClass(classId, {
      name,
      year:      Number(year),
      shift,
      teacherId: teacher,
      subjects
    });
    Utils.toast('Turma atualizada com sucesso!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    window._reloadClasses?.();
  },

  viewStudents(classId, className) {
    const students = DB.getStudents()
      .filter(s => s.classId === classId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    const body = students.length === 0
      ? `<div class="empty-state"><i class="fa-solid fa-users"></i><p>Nenhum aluno nesta turma.</p></div>`
      : `<div style="max-height:420px;overflow-y:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="font-size:11px;text-transform:uppercase;color:var(--text-muted);border-bottom:1.5px solid var(--border);">
                <th style="padding:8px 10px;text-align:left;">Aluno</th>
                <th style="padding:8px 10px;text-align:left;">Matrícula</th>
                <th style="padding:8px 10px;text-align:left;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((s, i) => `
                <tr style="border-bottom:1px solid var(--border);background:${i % 2 === 0 ? '#fff' : '#f8f9fa'};">
                  <td style="padding:10px 10px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div style="width:30px;height:30px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0;">${Utils.initials(s.name)}</div>
                      <strong>${Utils.escape(s.name)}</strong>
                    </div>
                  </td>
                  <td style="padding:10px 10px;font-size:13px;">${s.matricula}</td>
                  <td style="padding:10px 10px;">
                    <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${s.status==='ativo'?'#e6f4ea':'#fce8e6'};color:${s.status==='ativo'?'#1e8e3e':'#d93025'};">
                      ${s.status === 'ativo' ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;

    Utils.modal(
      `<i class="fa-solid fa-chalkboard"></i> ${Utils.escape(className)} — ${students.length} aluno(s)`,
      body,
      `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  },

  manageStudents(classId, className) {
    const allStudents = DB.getStudents()
      .filter(s => s.status === 'ativo')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    if (allStudents.length === 0) {
      Utils.toast('Nenhum aluno ativo cadastrado.', 'error'); return;
    }

    const rows = allStudents.map(s => {
      const inClass = s.classId === classId;
      const otherClass = !inClass && s.classId ? DB.getClasses().find(c => c.id === s.classId) : null;
      return `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .15s;border:1.5px solid ${inClass ? 'var(--primary)' : 'var(--border)'};margin-bottom:8px;background:${inClass ? 'rgba(26,115,232,.06)' : '#fff'};"
          onmouseover="this.style.background='${inClass ? 'rgba(26,115,232,.10)' : '#f8f9fa'}'"
          onmouseout="this.style.background='${inClass ? 'rgba(26,115,232,.06)' : '#fff'}'">
          <input type="checkbox" value="${s.id}" ${inClass ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${Utils.escape(s.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);">Matrícula: ${s.matricula}${otherClass ? ` · Turma atual: ${Utils.escape(otherClass.name)}` : ''}</div>
          </div>
          ${inClass ? '<span style="font-size:11px;color:var(--primary);font-weight:700;">Nesta turma</span>' : ''}
        </label>`;
    }).join('');

    Utils.modal(
      `<i class="fa-solid fa-user-plus"></i> Alunos — ${Utils.escape(className)}`,
      `<div style="max-height:420px;overflow-y:auto;padding-right:4px;">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Marque os alunos que pertencem a esta turma. Alunos desmarcados serão desvinculados.
        </div>
        ${rows}
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="AdminClasses.saveStudentsToClass('${classId}')">Salvar</button>`
    );
  },

  saveStudentsToClass(classId) {
    const checked = new Set(
      Array.from(document.querySelectorAll('.modal-overlay input[type=checkbox]:checked')).map(el => el.value)
    );
    const allStudents = DB.getStudents().filter(s => s.status === 'ativo');
    allStudents.forEach(s => {
      if (checked.has(s.id) && s.classId !== classId) {
        DB.updateStudent(s.id, { classId });
      } else if (!checked.has(s.id) && s.classId === classId) {
        DB.updateStudent(s.id, { classId: '' });
      }
    });
    Utils.toast('Alunos atualizados com sucesso!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    window._reloadClasses?.();
  },

  confirmDelete(id, nome, alunosCount) {
    if (alunosCount > 0) {
      Utils.toast(`Não é possível excluir a turma "${nome}" pois possui ${alunosCount} aluno(s) matriculado(s). Remova os alunos primeiro.`, 'error');
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'delete-class-modal';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:'9999'
    });
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;
                  box-shadow:0 8px 32px rgba(0,0,0,.18);text-align:center;">
        <div style="font-size:44px;margin-bottom:12px;">⚠️</div>
        <h3 style="margin:0 0 10px;font-size:18px;color:#c62828;">Excluir Turma</h3>
        <p style="color:var(--text-muted);font-size:14px;margin:0 0 6px;">
          Tem certeza que deseja excluir a turma
        </p>
        <p style="font-weight:700;font-size:16px;margin:0 0 20px;">"${Utils.escape(nome)}"?</p>
        <p style="font-size:12px;color:var(--text-muted);background:#f8f9fa;padding:10px;border-radius:6px;margin-bottom:24px;">
          Esta ação não pode ser desfeita.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button onclick="document.getElementById('delete-class-modal').remove()"
            style="padding:10px 24px;border:1.5px solid var(--border);border-radius:8px;
                   background:#fff;color:var(--text-muted);font-size:14px;cursor:pointer;font-weight:600;">
            Cancelar
          </button>
          <button onclick="AdminClasses._executeDelete('${id}')"
            style="padding:10px 24px;border:none;border-radius:8px;
                   background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;">
            Confirmar Exclusão
          </button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _executeDelete(id) {
    document.getElementById('delete-class-modal')?.remove();
    DB.removeClass(id);
    Utils.toast('Turma excluída com sucesso!', 'success');
    window._reloadClasses();
  },
};
