// =============================================
//  GESTESCOLAR – Ponto Docente (Gestor/Admin)
//  Rota: admin-ponto
// =============================================

const AdminPonto = {

  _aba: 'registros', // 'registros' | 'ajustes' | 'relatorio'

  TIPOS: [
    { value: 'ENTRADA',          label: 'Entrada',          icon: 'fa-sign-in-alt',  color: '#4CAF50' },
    { value: 'SAIDA',            label: 'Saída',            icon: 'fa-sign-out-alt', color: '#F44336' },
    { value: 'INTERVALO_INICIO', label: 'Início Intervalo', icon: 'fa-coffee',       color: '#FF9800' },
    { value: 'INTERVALO_FIM',    label: 'Fim Intervalo',    icon: 'fa-play',         color: '#2196F3' },
  ],

  STATUS_META: {
    AUTO_VALIDADO: { color: '#4CAF50', label: 'Validado'  },
    PENDENTE:      { color: '#FF9800', label: 'Pendente'  },
    APROVADO:      { color: '#2196F3', label: 'Aprovado'  },
    REJEITADO:     { color: '#F44336', label: 'Rejeitado' },
  },

  STATUS_AJUSTE: {
    PENDENTE:  { color: '#FF9800', label: 'Pendente'  },
    APROVADO:  { color: '#4CAF50', label: 'Aprovado'  },
    REJEITADO: { color: '#F44336', label: 'Rejeitado' },
  },

  _filtros: {
    status: '',
    data_inicio: '',
    data_fim: '',
    professor_id: '',
    page: 1,
  },

  _filtrosRelatorio: {
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
  },

  // ─── RENDER ────────────────────────────────────────────────────────────────

  async render(aba) {
    const user = Auth.require();
    if (!user) return;
    if (!['gestor','admin','superadmin'].includes(user.role)) {
      Utils.toast('Acesso restrito ao gestor.', 'error');
      Router.go('admin-dashboard');
      return;
    }

    if (aba) this._aba = aba;

    const [resumo, dados] = await Promise.all([
      this._buscarResumo(),
      this._aba === 'registros' ? this._buscarRegistros() : this._aba === 'ajustes' ? this._buscarAjustes() : this._buscarRelatorio(),
    ]);

    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    Router.renderLayout(user, 'admin-ponto', `
      <div style="max-width:1100px;margin:0 auto;">

        <!-- Cabeçalho -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;"><i class="fa-solid fa-fingerprint" style="color:var(--primary);"></i> Controle de Ponto</h2>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${hoje}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="AdminPonto.render()">
            <i class="fa-solid fa-rotate"></i> Atualizar
          </button>
        </div>

        <!-- Cards de resumo -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;">
          ${this._cardResumo('fa-list-check', resumo.total, resumo.labelPeriodo, '#607D8B')}
          ${this._cardResumo('fa-hourglass-half', resumo.pendente, 'Pendentes', '#FF9800')}
          ${this._cardResumo('fa-circle-check', resumo.aprovado + resumo.auto_validado, 'Aprovados', '#4CAF50')}
          ${this._cardResumo('fa-circle-xmark', resumo.rejeitado, 'Rejeitados', '#F44336')}
          ${this._cardResumo('fa-pen-to-square', resumo.ajustesPendentes, 'Ajustes pendentes', '#9C27B0')}
        </div>

        <!-- Abas -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;flex-wrap:wrap;">
          <button onclick="AdminPonto.render('registros')"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;
                   border-bottom:${this._aba === 'registros' ? '2px solid var(--primary);color:var(--primary)' : '2px solid transparent;color:var(--text-muted)'};
                   margin-bottom:-2px;transition:all .2s;">
            <i class="fa-solid fa-clock"></i> Registros
          </button>
          <button onclick="AdminPonto.render('ajustes')"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;
                   border-bottom:${this._aba === 'ajustes' ? '2px solid var(--primary);color:var(--primary)' : '2px solid transparent;color:var(--text-muted)'};
                   margin-bottom:-2px;transition:all .2s;">
            <i class="fa-solid fa-pen-to-square"></i> Solicitações de Ajuste
            ${resumo.ajustesPendentes > 0 ? `<span style="background:#9C27B0;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:6px;">${resumo.ajustesPendentes}</span>` : ''}
          </button>
          <button onclick="AdminPonto.render('relatorio')"
            style="padding:10px 20px;border:none;background:none;cursor:pointer;font-weight:600;font-size:14px;
                   border-bottom:${this._aba === 'relatorio' ? '2px solid var(--primary);color:var(--primary)' : '2px solid transparent;color:var(--text-muted)'};
                   margin-bottom:-2px;transition:all .2s;">
            <i class="fa-solid fa-file-pdf"></i> Relatório
          </button>
        </div>

        ${this._aba === 'registros' ? this._htmlRegistros(dados) : this._aba === 'ajustes' ? this._htmlAjustes(dados) : this._htmlRelatorio(dados)}

      </div>
    `);
  },

  // ─── CARDS ─────────────────────────────────────────────────────────────────

  _cardResumo(icon, valor, label, cor) {
    return `
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;">
        <div style="width:42px;height:42px;border-radius:10px;background:${cor}22;display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid ${icon}" style="color:${cor};font-size:18px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:${cor};">${valor ?? 0}</div>
          <div style="font-size:12px;color:var(--text-muted);">${label}</div>
        </div>
      </div>`;
  },

  // ─── HTML REGISTROS ────────────────────────────────────────────────────────

  _htmlRegistros(dados) {
    const pontos = dados?.pontos || [];
    const total  = dados?.total || 0;
    const temFiltro = !!(this._filtros.data_inicio || this._filtros.data_fim || this._filtros.professor_id);

    // Lista de professores em ordem alfabética
    const professores = (typeof DB !== 'undefined' ? DB.getUsers() : [])
      .filter(u => u.role === 'professor')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return `
      <!-- Filtros -->
      <div class="card" style="margin-bottom:16px;">
        <div style="padding:14px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
          <select id="filtro-professor" class="form-control" style="width:auto;min-width:200px;"
            onchange="AdminPonto._filtros.professor_id=this.value;AdminPonto._filtros.page=1;AdminPonto._recarregar()">
            <option value="">Todos os professores</option>
            ${professores.map(p => `
              <option value="${p.id}" ${this._filtros.professor_id === p.id ? 'selected' : ''}>${Utils.escape(p.name)}</option>
            `).join('')}
          </select>
          <select id="filtro-status" class="form-control" style="width:auto;min-width:150px;"
            onchange="AdminPonto._filtros.status=this.value;AdminPonto._filtros.page=1;AdminPonto._recarregar()">
            <option value="">Todos os status</option>
            <option value="PENDENTE"      ${this._filtros.status === 'PENDENTE'      ? 'selected' : ''}>Pendente</option>
            <option value="AUTO_VALIDADO" ${this._filtros.status === 'AUTO_VALIDADO' ? 'selected' : ''}>Validado</option>
            <option value="APROVADO"      ${this._filtros.status === 'APROVADO'      ? 'selected' : ''}>Aprovado</option>
            <option value="REJEITADO"     ${this._filtros.status === 'REJEITADO'     ? 'selected' : ''}>Rejeitado</option>
          </select>
          <input type="date" id="filtro-inicio" class="form-control" style="width:auto;"
            value="${this._filtros.data_inicio}" title="Data início" />
          <input type="date" id="filtro-fim" class="form-control" style="width:auto;"
            value="${this._filtros.data_fim}" title="Data fim" />
          ${temFiltro ? `
            <button class="btn btn-sm" style="background:var(--danger,#F44336);color:#fff;border:none;"
              onclick="AdminPonto._limparFiltros()">
              <i class="fa-solid fa-xmark"></i> Limpar
            </button>
          ` : `
            <button class="btn btn-sm btn-primary" onclick="AdminPonto._aplicarFiltros()">
              <i class="fa-solid fa-magnifying-glass"></i> Buscar
            </button>
          `}
          <span style="margin-left:auto;font-size:13px;color:var(--text-muted);">${total} registro(s) encontrado(s)</span>
        </div>
      </div>

      <!-- Tabela -->
      <div class="card">
        <div style="padding:8px 0;">
          ${pontos.length === 0 ? `
            <div style="padding:40px;text-align:center;color:var(--text-muted);">
              <i class="fa-solid fa-inbox" style="font-size:36px;opacity:.35;display:block;margin-bottom:10px;"></i>
              Nenhum registro encontrado.
            </div>
          ` : (this._filtros.professor_id ? this._htmlTabelaPorDia(pontos) : `
            <div style="overflow-x:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Professor</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Descrição</th>
                    <th style="text-align:center;">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${pontos.map(p => this._linhaRegistro(p)).join('')}
                </tbody>
              </table>
            </div>

            <!-- Paginação -->
            <div style="padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
              <button class="btn btn-sm btn-outline" onclick="AdminPonto._pagAnterior()"
                ${this._filtros.page <= 1 ? 'disabled' : ''}>
                <i class="fa-solid fa-chevron-left"></i> Anterior
              </button>
              <span style="font-size:13px;color:var(--text-muted);">Página ${this._filtros.page}</span>
              <button class="btn btn-sm btn-outline" onclick="AdminPonto._proxPagina()"
                ${pontos.length < 30 ? 'disabled' : ''}>
                Próxima <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          `)}
        </div>
      </div>
    `;
  },

  // ─── TABELA POR DIA (1 linha = 1 dia, 4 horários lado a lado) ──────────────

  _htmlTabelaPorDia(pontos) {
    const porDia = {};
    pontos.forEach(p => {
      const dia = new Date(p.timestamp).toISOString().slice(0, 10);
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(p);
    });

    const dias = Object.entries(porDia).sort(([a], [b]) => b.localeCompare(a));

    let saldoMes = 0;
    let totalTrab = 0;

    const linhas = dias.map(([dia, pts]) => {
      const get = (tipo) => pts.find(x => x.tipo === tipo);
      const cell = (tipo, cor) => {
        const p = get(tipo);
        if (!p) return `<td style="text-align:center;color:#ccc;font-family:monospace;">—</td>`;
        const hora    = new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        const status  = this.STATUS_META[p.status] || { color:'#666', label:p.status };
        const isPend  = p.status === 'PENDENTE';
        const desc    = p.descricao ? Utils.escape(p.descricao).slice(0,60) : '';
        return `<td style="font-family:monospace;font-size:12px;text-align:center;" title="${status.label}${desc ? ' - ' + desc : ''}">
          <div style="color:${cor};font-weight:700;font-size:13px;">${hora}</div>
          <div style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${status.color};margin-top:3px;" title="${status.label}"></div>
          ${isPend ? `
            <div style="margin-top:4px;display:flex;justify-content:center;gap:3px;">
              <button class="btn btn-sm" style="background:#4CAF50;color:#fff;padding:2px 6px;font-size:10px;border:none;"
                onclick="AdminPonto.acaoRegistro('${p.id}', 'APROVAR')" title="Aprovar">
                <i class="fa-solid fa-check"></i>
              </button>
              <button class="btn btn-sm" style="background:#F44336;color:#fff;padding:2px 6px;font-size:10px;border:none;"
                onclick="AdminPonto.acaoRegistro('${p.id}', 'REJEITAR')" title="Rejeitar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          ` : ''}
        </td>`;
      };

      const min   = this._minutosTrabalhados(pts);
      const saldo = (min !== null) ? min - this.CARGA_HORARIA_DIARIA : null;
      if (min !== null)   totalTrab += min;
      if (saldo !== null) saldoMes  += saldo;

      const dataObj   = new Date(dia + 'T12:00:00');
      const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];

      return `<tr>
        <td style="font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;">
          ${dataObj.toLocaleDateString('pt-BR')}
          <div style="font-size:10px;color:var(--text-muted);font-weight:400;">${diaSemana}</div>
        </td>
        ${cell('ENTRADA',          '#4CAF50')}
        ${cell('INTERVALO_INICIO', '#FF9800')}
        ${cell('INTERVALO_FIM',    '#2196F3')}
        ${cell('SAIDA',            '#F44336')}
        <td style="font-family:monospace;font-size:12px;text-align:center;font-weight:700;">${this._formatHoras(min)}</td>
        <td style="font-family:monospace;font-size:12px;text-align:center;font-weight:700;color:${this._saldoCor(saldo)};">
          ${saldo !== null ? (saldo > 0 ? '+' : '') + this._formatHoras(saldo) : '—'}
        </td>
      </tr>`;
    }).join('');

    const corSaldoMes = this._saldoCor(saldoMes);
    const sinalMes    = saldoMes > 0 ? '+' : '';

    return `
      <div style="overflow-x:auto;">
        <table class="table" style="font-size:12px;">
          <thead>
            <tr>
              <th>Data</th>
              <th style="text-align:center;color:#4CAF50;">Entrada</th>
              <th style="text-align:center;color:#FF9800;">Início Int.</th>
              <th style="text-align:center;color:#2196F3;">Fim Int.</th>
              <th style="text-align:center;color:#F44336;">Saída</th>
              <th style="text-align:center;">Trabalhado</th>
              <th style="text-align:center;">Saldo</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr style="background:#f5f5f5;font-weight:700;">
              <td colspan="5" style="text-align:right;">TOTAL DO PERÍODO:</td>
              <td style="text-align:center;">${this._formatHoras(totalTrab)}</td>
              <td style="text-align:center;color:${corSaldoMes};">${sinalMes}${this._formatHoras(saldoMes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  },

  _linhaRegistro(p) {
    const tipo   = this.TIPOS.find(t => t.value === p.tipo)       || { label: p.tipo,   color: '#666', icon: 'fa-circle' };
    const status = this.STATUS_META[p.status]                     || { label: p.status, color: '#666' };
    const dt     = new Date(p.timestamp);
    const isPendente = p.status === 'PENDENTE';

    return `<tr>
      <td style="font-family:monospace;font-size:13px;white-space:nowrap;">
        ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </td>
      <td style="font-size:13px;font-weight:600;">${Utils.escape(p.user_name || p.userId || '—')}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:5px;color:${tipo.color};font-weight:700;font-size:12px;">
          <i class="fa-solid ${tipo.icon}"></i> ${tipo.label}
        </span>
      </td>
      <td>
        <span style="background:${status.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">
          ${status.label}
        </span>
      </td>
      <td style="font-size:12px;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${Utils.escape(p.descricao || '—')}
      </td>
      <td style="text-align:center;white-space:nowrap;">
        ${isPendente ? `
          <button class="btn btn-sm" style="background:#4CAF50;color:#fff;margin-right:4px;"
            onclick="AdminPonto.acaoRegistro('${p.id}', 'APROVAR')">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="btn btn-sm" style="background:#F44336;color:#fff;"
            onclick="AdminPonto.acaoRegistro('${p.id}', 'REJEITAR')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        ` : `
          <span style="background:${status.color};color:#fff;padding:4px 10px;border-radius:10px;font-size:12px;font-weight:700;display:inline-block;">
            ${status.label}
          </span>
        `}
      </td>
    </tr>`;
  },

  // ─── HTML AJUSTES ──────────────────────────────────────────────────────────

  _htmlAjustes(ajustes) {
    if (!Array.isArray(ajustes)) ajustes = [];

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-pen-to-square"></i> Solicitações de Ajuste Manual</span>
        </div>
        <div style="padding:8px 0;">
          ${ajustes.length === 0 ? `
            <div style="padding:40px;text-align:center;color:var(--text-muted);">
              <i class="fa-solid fa-circle-check" style="font-size:36px;opacity:.35;display:block;margin-bottom:10px;"></i>
              Nenhuma solicitação pendente.
            </div>
          ` : `
            <div style="overflow-x:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Solicitado em</th>
                    <th>Professor</th>
                    <th>Horário solicitado</th>
                    <th>Justificativa</th>
                    <th>Status</th>
                    <th style="text-align:center;">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${ajustes.map(a => this._linhaAjuste(a)).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  _linhaAjuste(a) {
    const status = this.STATUS_AJUSTE[a.status] || { label: a.status, color: '#666' };
    const dtCriado   = new Date(a.criado_em);
    const dtAjustado = new Date(a.timestamp_ajustado);
    const isPendente = a.status === 'PENDENTE';

    return `<tr>
      <td style="font-family:monospace;font-size:13px;white-space:nowrap;">
        ${dtCriado.toLocaleDateString('pt-BR')} ${dtCriado.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </td>
      <td style="font-size:13px;font-weight:600;">${Utils.escape(a.user_name || a.ponto?.user_name || '—')}</td>
      <td style="font-family:monospace;font-size:13px;white-space:nowrap;">
        ${dtAjustado.toLocaleDateString('pt-BR')} ${dtAjustado.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
      </td>
      <td style="font-size:12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
          title="${Utils.escape(a.justificativa)}">
        ${Utils.escape(a.justificativa)}
      </td>
      <td>
        <span style="background:${status.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">
          ${status.label}
        </span>
      </td>
      <td style="text-align:center;white-space:nowrap;">
        ${isPendente ? `
          <button class="btn btn-sm" style="background:#4CAF50;color:#fff;margin-right:4px;"
            onclick="AdminPonto.acaoAjuste('${a.id}', 'APROVAR')">
            <i class="fa-solid fa-check"></i> Aprovar
          </button>
          <button class="btn btn-sm" style="background:#F44336;color:#fff;"
            onclick="AdminPonto.acaoAjuste('${a.id}', 'REJEITAR')">
            <i class="fa-solid fa-xmark"></i> Rejeitar
          </button>
        ` : '—'}
      </td>
    </tr>`;
  },

  // ─── HTML RELATÓRIO ───────────────────────────────────────────────────────

  CARGA_HORARIA_DIARIA: 8 * 60, // minutos (8h)

  // Agrupa pontos por professor + dia retornando estrutura {[professor]: {[dia]: [pontos]}}
  _agruparPorProfDia(pontos) {
    const map = {};
    pontos.forEach(p => {
      const prof = p.user_name || 'Desconhecido';
      const dia  = new Date(p.timestamp).toISOString().slice(0, 10);
      if (!map[prof])      map[prof] = {};
      if (!map[prof][dia]) map[prof][dia] = [];
      map[prof][dia].push(p);
    });
    return map;
  },

  // Calcula minutos trabalhados num dia: (Saída - Entrada) - (Fim Int - Início Int)
  _minutosTrabalhados(pontosDia) {
    const get = (tipo) => {
      const p = pontosDia.find(x => x.tipo === tipo);
      return p ? new Date(p.timestamp) : null;
    };
    const entrada = get('ENTRADA');
    const saida   = get('SAIDA');
    const intIni  = get('INTERVALO_INICIO');
    const intFim  = get('INTERVALO_FIM');

    if (!entrada || !saida) return null; // dia incompleto
    let total = (saida - entrada) / 60000; // ms → min
    if (intIni && intFim) total -= (intFim - intIni) / 60000;
    return Math.max(0, Math.round(total));
  },

  _formatHoras(min) {
    if (min === null || min === undefined) return '—';
    const sinal = min < 0 ? '-' : '';
    const m = Math.abs(min);
    const h = Math.floor(m / 60);
    const mm = String(m % 60).padStart(2, '0');
    return `${sinal}${h}h${mm}`;
  },

  _saldoCor(min) {
    if (min === null || min === undefined) return '#666';
    if (min > 0)  return '#4CAF50'; // verde - excedente
    if (min < 0)  return '#F44336'; // vermelho - faltante
    return '#666';
  },

  _htmlRelatorio(dados) {
    const pontos = dados?.pontos || [];
    const agrupado = this._agruparPorProfDia(pontos);
    const mesLabel = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][this._filtrosRelatorio.mes - 1];

    return `
      <!-- Filtros -->
      <div class="card" style="margin-bottom:16px;">
        <div style="padding:14px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
          <select id="filtro-mes" class="form-control" style="width:auto;min-width:120px;"
            onchange="AdminPonto._filtrosRelatorio.mes=this.value;AdminPonto.render('relatorio')">
            ${[...Array(12)].map((_, i) => `<option value="${i+1}" ${this._filtrosRelatorio.mes == i+1 ? 'selected' : ''}>${['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i]}</option>`).join('')}
          </select>
          <select id="filtro-ano" class="form-control" style="width:auto;min-width:100px;"
            onchange="AdminPonto._filtrosRelatorio.ano=this.value;AdminPonto.render('relatorio')">
            ${[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return `<option value="${y}" ${this._filtrosRelatorio.ano == y ? 'selected' : ''}>${y}</option>`;
            }).join('')}
          </select>
          <span style="margin-left:auto;font-size:13px;color:var(--text-muted);">${pontos.length} ponto(s) em ${mesLabel}/${this._filtrosRelatorio.ano}</span>
          <button class="btn btn-sm btn-primary" onclick="AdminPonto._imprimirRelatorio()">
            <i class="fa-solid fa-print"></i> Imprimir
          </button>
        </div>
      </div>

      <!-- Conteúdo -->
      ${Object.keys(agrupado).length === 0 ? `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-inbox" style="font-size:36px;opacity:.35;display:block;margin-bottom:10px;"></i>
          Nenhum registro neste período.
        </div>
      ` : Object.entries(agrupado).map(([prof, dias]) => this._htmlBlocoProfessor(prof, dias)).join('')}
    `;
  },

  _htmlBlocoProfessor(prof, dias) {
    let saldoMes = 0;
    let totalTrabalhado = 0;

    const linhas = Object.entries(dias).sort(([a], [b]) => a.localeCompare(b)).map(([dia, pts]) => {
      const get = (tipo) => pts.find(x => x.tipo === tipo);
      const fmt = (p) => p ? new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

      const min = this._minutosTrabalhados(pts);
      const saldo = (min !== null) ? min - this.CARGA_HORARIA_DIARIA : null;
      if (min !== null) totalTrabalhado += min;
      if (saldo !== null) saldoMes += saldo;

      const dataObj = new Date(dia + 'T12:00:00');
      const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];

      return `<tr>
        <td style="font-family:monospace;font-size:12px;white-space:nowrap;">${dataObj.toLocaleDateString('pt-BR')} <span style="color:var(--text-muted);">${diaSemana}</span></td>
        <td style="font-family:monospace;font-size:12px;color:#4CAF50;">${fmt(get('ENTRADA'))}</td>
        <td style="font-family:monospace;font-size:12px;color:#FF9800;">${fmt(get('INTERVALO_INICIO'))}</td>
        <td style="font-family:monospace;font-size:12px;color:#2196F3;">${fmt(get('INTERVALO_FIM'))}</td>
        <td style="font-family:monospace;font-size:12px;color:#F44336;">${fmt(get('SAIDA'))}</td>
        <td style="font-family:monospace;font-size:12px;font-weight:700;">${this._formatHoras(min)}</td>
        <td style="font-family:monospace;font-size:12px;font-weight:700;color:${this._saldoCor(saldo)};">
          ${saldo !== null ? (saldo > 0 ? '+' : '') + this._formatHoras(saldo) : '—'}
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span class="card-title"><i class="fa-solid fa-user-tie"></i> ${Utils.escape(prof)}</span>
          <div style="display:flex;gap:14px;align-items:center;">
            <span style="font-size:12px;color:var(--text-muted);">Trabalhado: <strong style="color:#333;">${this._formatHoras(totalTrabalhado)}</strong></span>
            <span style="font-size:12px;color:var(--text-muted);">Banco de Horas:
              <strong style="color:${this._saldoCor(saldoMes)};font-size:14px;">
                ${saldoMes > 0 ? '+' : ''}${this._formatHoras(saldoMes)}
              </strong>
            </span>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Data</th>
                <th style="color:#4CAF50;">Entrada</th>
                <th style="color:#FF9800;">Início Int.</th>
                <th style="color:#2196F3;">Fim Int.</th>
                <th style="color:#F44336;">Saída</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  // ─── AÇÕES ─────────────────────────────────────────────────────────────────

  async acaoRegistro(pontoId, acao) {
    const label = acao === 'APROVAR' ? 'aprovar' : 'rejeitar';
    let observacao = '';
    if (acao === 'REJEITAR') {
      observacao = prompt('Motivo da rejeição (opcional):') || '';
    } else {
      if (!confirm(`Confirmar ${label} este registro de ponto?`)) return;
    }

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch(`/api/pontos-acao?id=${pontoId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ acao, observacao }),
      });
      const json = await resp.json();

      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao processar ação.', 'error');
        return;
      }

      Utils.toast(`Registro ${acao === 'APROVAR' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
      await this._recarregar();

    } catch (e) {
      console.error('[AdminPonto] acaoRegistro:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  async acaoAjuste(ajusteId, acao) {
    const label = acao === 'APROVAR' ? 'aprovar' : 'rejeitar';
    let observacao = '';
    if (acao === 'REJEITAR') {
      observacao = prompt('Motivo da rejeição (opcional):') || '';
    } else {
      if (!confirm(`Confirmar ${label} este ajuste?`)) return;
    }

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch(`/api/pontos-ajuste?id=${ajusteId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ acao, observacao }),
      });
      const json = await resp.json();

      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao processar ajuste.', 'error');
        return;
      }

      Utils.toast(`Ajuste ${acao === 'APROVAR' ? 'aprovado' : 'rejeitado'} com sucesso!`, 'success');
      await this.render('ajustes');

    } catch (e) {
      console.error('[AdminPonto] acaoAjuste:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  async _recarregar() {
    await this.render(this._aba);
  },

  _aplicarFiltros() {
    const inicio = document.getElementById('filtro-inicio')?.value || '';
    const fim    = document.getElementById('filtro-fim')?.value || '';
    const prof   = document.getElementById('filtro-professor')?.value || '';
    if (!inicio && !fim && !prof) {
      Utils.toast('Selecione data ou professor para buscar.', 'warning');
      return;
    }
    this._filtros.data_inicio  = inicio;
    this._filtros.data_fim     = fim;
    this._filtros.professor_id = prof;
    this._filtros.page         = 1;
    this._recarregar();
  },

  _limparFiltros() {
    this._filtros = { status: '', data_inicio: '', data_fim: '', professor_id: '', page: 1 };
    this._recarregar();
  },

  _pagAnterior() {
    if (this._filtros.page > 1) {
      this._filtros.page--;
      this._recarregar();
    }
  },

  _proxPagina() {
    this._filtros.page++;
    this._recarregar();
  },

  async _buscarResumo() {
    try {
      const token = await this._getToken();
      if (!token) return {};

      // Se há filtro de período aplicado, usa-o; senão usa o dia atual
      let inicioISO, fimISO, labelPeriodo;
      if (this._filtros.data_inicio || this._filtros.data_fim) {
        const di = this._filtros.data_inicio ? new Date(this._filtros.data_inicio) : new Date();
        const df = this._filtros.data_fim    ? new Date(this._filtros.data_fim)    : new Date();
        di.setHours(0, 0, 0, 0);
        df.setHours(23, 59, 59, 999);
        inicioISO    = di.toISOString();
        fimISO       = df.toISOString();
        labelPeriodo = `Total ${di.toLocaleDateString('pt-BR')} a ${df.toLocaleDateString('pt-BR')}`;
      } else {
        const hoje = new Date();
        inicioISO    = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
        fimISO       = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();
        labelPeriodo = 'Total hoje';
      }

      const params = new URLSearchParams({ limit: 500, data_inicio: inicioISO, data_fim: fimISO });
      if (this._filtros.status) params.set('status', this._filtros.status);

      // Busca registros do período + ajustes pendentes em paralelo
      const [respPontos, respAjustes] = await Promise.all([
        fetch(`/api/pontos?${params}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/pontos-ajuste?status=PENDENTE&limit=200`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const pontosJson  = respPontos.ok  ? await respPontos.json()  : {};
      const ajustesJson = respAjustes.ok ? await respAjustes.json() : {};

      const pontos  = pontosJson.data?.pontos  || [];
      const ajustes = ajustesJson.data         || [];

      const contagem = { total: pontos.length, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0 };
      pontos.forEach(p => {
        const k = p.status?.toLowerCase();
        if (contagem[k] !== undefined) contagem[k]++;
      });

      return { ...contagem, ajustesPendentes: Array.isArray(ajustes) ? ajustes.length : 0, labelPeriodo };
    } catch { return { total: 0, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0, ajustesPendentes: 0, labelPeriodo: 'Total hoje' }; }
  },

  async _buscarRegistros() {
    try {
      const token = await this._getToken();
      if (!token) return { pontos: [], total: 0 };

      // Quando há professor selecionado, busca mais registros (mês inteiro)
      const limit = this._filtros.professor_id ? 100 : 30;
      const params = new URLSearchParams({ limit, page: this._filtros.page });
      if (this._filtros.status)       params.set('status',       this._filtros.status);
      if (this._filtros.professor_id) params.set('user_id',      this._filtros.professor_id);
      if (this._filtros.data_inicio)  params.set('data_inicio',  new Date(this._filtros.data_inicio).toISOString());
      if (this._filtros.data_fim) {
        const fim = new Date(this._filtros.data_fim);
        fim.setHours(23, 59, 59, 999);
        params.set('data_fim', fim.toISOString());
      }

      const resp = await fetch(`/api/pontos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return { pontos: [], total: 0 };
      const json = await resp.json();
      return { pontos: json.data?.pontos || [], total: json.data?.total || 0 };
    } catch { return { pontos: [], total: 0 }; }
  },

  async _buscarAjustes() {
    try {
      const token = await this._getToken();
      if (!token) return [];

      const resp = await fetch(`/api/pontos-ajuste?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return json.data || [];
    } catch { return []; }
  },

  async _buscarRelatorio() {
    try {
      const token = await this._getToken();
      if (!token) return { pontos: [], total: 0 };

      const mes = String(this._filtrosRelatorio.mes).padStart(2, '0');
      const ano = this._filtrosRelatorio.ano;
      const dataInicio = new Date(`${ano}-${mes}-01`).toISOString();
      const proximoMes = this._filtrosRelatorio.mes === 12 ? 1 : this._filtrosRelatorio.mes + 1;
      const anoProx = this._filtrosRelatorio.mes === 12 ? ano + 1 : ano;
      const mesProx = String(proximoMes).padStart(2, '0');
      const dataFim = new Date(`${anoProx}-${mesProx}-01`);
      dataFim.setDate(dataFim.getDate() - 1);
      dataFim.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        limit: 500,
        data_inicio: dataInicio,
        data_fim: dataFim.toISOString(),
      });

      const resp = await fetch(`/api/pontos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return { pontos: [], total: 0 };
      const json = await resp.json();
      return { pontos: json.data?.pontos || [], total: json.data?.total || 0 };
    } catch { return { pontos: [], total: 0 }; }
  },

  async _imprimirRelatorio() {
    const ano = this._filtrosRelatorio.ano;
    const mesLabel = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][this._filtrosRelatorio.mes - 1];

    const dados  = await this._buscarRelatorio();
    const pontos = dados?.pontos || [];
    if (pontos.length === 0) {
      Utils.toast('Nenhum dado para imprimir.', 'warning');
      return;
    }

    const agrupado = this._agruparPorProfDia(pontos);

    // Dados da escola
    const user   = Auth.current();
    const school = user?.schoolId ? DB.getSchool(user.schoolId) : null;
    const escolaNome = Utils.escape(school?.name || 'Escola');
    const escolaDoc  = school?.cnpj ? `CNPJ/CPF: ${Utils.escape(school.cnpj)}` : '';
    const logoUrl    = school?.logoUrl || '';

    // Bloco por professor
    const blocosHtml = Object.entries(agrupado).map(([prof, dias]) => {
      let saldoMes = 0;
      let totalTrab = 0;

      const linhas = Object.entries(dias).sort(([a], [b]) => a.localeCompare(b)).map(([dia, pts]) => {
        const get = (tipo) => pts.find(x => x.tipo === tipo);
        const fmt = (p) => p ? new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

        const min = this._minutosTrabalhados(pts);
        const saldo = (min !== null) ? min - this.CARGA_HORARIA_DIARIA : null;
        if (min !== null)   totalTrab += min;
        if (saldo !== null) saldoMes  += saldo;

        const dataObj = new Date(dia + 'T12:00:00');
        const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];
        const corSaldo  = this._saldoCor(saldo);
        const sinal     = saldo !== null && saldo > 0 ? '+' : '';

        return `<tr>
          <td>${dataObj.toLocaleDateString('pt-BR')} <span style="color:#999;font-size:10px;">${diaSemana}</span></td>
          <td style="color:#4CAF50;">${fmt(get('ENTRADA'))}</td>
          <td style="color:#FF9800;">${fmt(get('INTERVALO_INICIO'))}</td>
          <td style="color:#2196F3;">${fmt(get('INTERVALO_FIM'))}</td>
          <td style="color:#F44336;">${fmt(get('SAIDA'))}</td>
          <td style="font-weight:bold;">${this._formatHoras(min)}</td>
          <td style="color:${corSaldo};font-weight:bold;">
            ${saldo !== null ? sinal + this._formatHoras(saldo) : '—'}
          </td>
        </tr>`;
      }).join('');

      const corSaldoMes = this._saldoCor(saldoMes);
      const sinalMes    = saldoMes > 0 ? '+' : '';

      return `
        <div style="page-break-inside:avoid;margin-bottom:24px;">
          <div style="background:#f0f7ff;padding:8px 12px;border-left:4px solid #2196F3;margin-bottom:8px;">
            <strong style="font-size:14px;">Colaborador:</strong> ${Utils.escape(prof)}
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Entrada</th>
                <th>Início Int.</th>
                <th>Fim Int.</th>
                <th>Saída</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
            <tfoot>
              <tr style="background:#fafafa;font-weight:bold;">
                <td colspan="5" style="text-align:right;">TOTAL DO PERÍODO:</td>
                <td>${this._formatHoras(totalTrab)}</td>
                <td style="color:${corSaldoMes};">${sinalMes}${this._formatHoras(saldoMes)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Ponto - ${mesLabel} ${ano}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #222; }
          .header { display:flex; align-items:center; gap:14px; border-bottom:2px solid #2196F3; padding-bottom:10px; margin-bottom:14px; }
          .header img { max-height:60px; max-width:80px; object-fit:contain; }
          .header .info { flex:1; }
          .header h1 { margin:0; font-size:18px; color:#333; }
          .header .doc { font-size:11px; color:#666; margin-top:2px; }
          .header .periodo { font-size:12px; color:#2196F3; font-weight:bold; margin-top:4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
          th { background-color: #2196F3; color: white; font-weight: bold; font-size:11px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          tfoot td { background:#fafafa; }
          .footer { margin-top:18px; text-align:center; font-size:10px; color:#666; border-top:1px solid #ddd; padding-top:6px; }
          .legenda { font-size:10px; color:#666; margin:6px 0 12px; }
          .legenda span { margin-right:14px; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ''}
          <div class="info">
            <h1>${escolaNome}</h1>
            ${escolaDoc ? `<div class="doc">${escolaDoc}</div>` : ''}
            <div class="periodo">Relatório de Ponto Docente — ${mesLabel}/${ano}</div>
          </div>
        </div>

        <div class="legenda">
          <span><strong style="color:#4CAF50;">●</strong> Entrada</span>
          <span><strong style="color:#FF9800;">●</strong> Início Intervalo</span>
          <span><strong style="color:#2196F3;">●</strong> Fim Intervalo</span>
          <span><strong style="color:#F44336;">●</strong> Saída</span>
          <span><strong style="color:#4CAF50;">+saldo</strong> excedente</span>
          <span><strong style="color:#F44336;">-saldo</strong> faltante</span>
          <span>Carga diária: 8h00</span>
        </div>

        ${blocosHtml}

        <div class="footer">
          Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
      </body>
      </html>
    `;

    const win = window.open('', '', 'width=1100,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 350);
  },

  async _getToken() {
    try {
      const { data } = await supabaseClient.auth.getSession();
      return data?.session?.access_token || null;
    } catch { return null; }
  },
};

window.AdminPonto = AdminPonto;

Router.register('admin-ponto', () => {
  AdminPonto.render();

  // Realtime: sincroniza painel quando há novos pontos/ajustes ou alterações
  if (typeof Realtime !== 'undefined') {
    const refresh = () => {
      clearTimeout(AdminPonto._rtTimer);
      AdminPonto._rtTimer = setTimeout(() => AdminPonto.render(AdminPonto._aba), 300);
    };
    Realtime.subscribe('pontos_docente', null, refresh);
    Realtime.subscribe('ajustes_ponto',  null, refresh);
  }
});
