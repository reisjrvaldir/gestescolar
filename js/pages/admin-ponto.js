// =============================================
//  GESTESCOLAR – Ponto Docente (Gestor/Admin)
//  Rota: admin-ponto
// =============================================

const AdminPonto = {

  _aba: 'registros', // 'registros' | 'ajustes'

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
    page: 1,
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
      this._aba === 'registros' ? this._buscarRegistros() : this._buscarAjustes(),
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
          ${this._cardResumo('fa-list-check', resumo.total, 'Total hoje', '#607D8B')}
          ${this._cardResumo('fa-hourglass-half', resumo.pendente, 'Pendentes', '#FF9800')}
          ${this._cardResumo('fa-circle-check', resumo.aprovado + resumo.auto_validado, 'Aprovados', '#4CAF50')}
          ${this._cardResumo('fa-circle-xmark', resumo.rejeitado, 'Rejeitados', '#F44336')}
          ${this._cardResumo('fa-pen-to-square', resumo.ajustesPendentes, 'Ajustes pendentes', '#9C27B0')}
        </div>

        <!-- Abas -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
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
        </div>

        ${this._aba === 'registros' ? this._htmlRegistros(dados) : this._htmlAjustes(dados)}

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

    return `
      <!-- Filtros -->
      <div class="card" style="margin-bottom:16px;">
        <div style="padding:14px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
          <select id="filtro-status" class="form-control" style="width:auto;min-width:150px;"
            onchange="AdminPonto._filtros.status=this.value;AdminPonto._filtros.page=1;AdminPonto._recarregar()">
            <option value="">Todos os status</option>
            <option value="PENDENTE"      ${this._filtros.status === 'PENDENTE'      ? 'selected' : ''}>Pendente</option>
            <option value="AUTO_VALIDADO" ${this._filtros.status === 'AUTO_VALIDADO' ? 'selected' : ''}>Validado</option>
            <option value="APROVADO"      ${this._filtros.status === 'APROVADO'      ? 'selected' : ''}>Aprovado</option>
            <option value="REJEITADO"     ${this._filtros.status === 'REJEITADO'     ? 'selected' : ''}>Rejeitado</option>
          </select>
          <input type="date" id="filtro-inicio" class="form-control" style="width:auto;"
            value="${this._filtros.data_inicio}"
            onchange="AdminPonto._filtros.data_inicio=this.value;AdminPonto._filtros.page=1;AdminPonto._recarregar()"
            title="Data início" />
          <input type="date" id="filtro-fim" class="form-control" style="width:auto;"
            value="${this._filtros.data_fim}"
            onchange="AdminPonto._filtros.data_fim=this.value;AdminPonto._filtros.page=1;AdminPonto._recarregar()"
            title="Data fim" />
          <button class="btn btn-sm btn-outline" onclick="AdminPonto._limparFiltros()">
            <i class="fa-solid fa-xmark"></i> Limpar
          </button>
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
          ` : `
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
          `}
        </div>
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
        ` : '—'}
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

  _limparFiltros() {
    this._filtros = { status: '', data_inicio: '', data_fim: '', page: 1 };
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

      // Resumo do dia atual
      const hoje      = new Date();
      const inicioDia = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
      const fimDia    = new Date(hoje.setHours(23, 59, 59, 999)).toISOString();

      // Busca registros de hoje + ajustes pendentes em paralelo
      const [respPontos, respAjustes] = await Promise.all([
        fetch(`/api/pontos?limit=200&data_inicio=${inicioDia}&data_fim=${fimDia}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`/api/pontos-ajuste?status=PENDENTE&limit=200`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const pontosJson  = respPontos.ok  ? await respPontos.json()  : {};
      const ajustesJson = respAjustes.ok ? await respAjustes.json() : {};

      const pontos  = pontosJson.data?.pontos  || [];
      const ajustes = ajustesJson.data          || [];

      const contagem = { total: pontos.length, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0 };
      pontos.forEach(p => {
        const k = p.status?.toLowerCase();
        if (contagem[k] !== undefined) contagem[k]++;
      });

      return { ...contagem, ajustesPendentes: Array.isArray(ajustes) ? ajustes.length : 0 };
    } catch { return { total: 0, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0, ajustesPendentes: 0 }; }
  },

  async _buscarRegistros() {
    try {
      const token = await this._getToken();
      if (!token) return { pontos: [], total: 0 };

      const params = new URLSearchParams({ limit: 30, page: this._filtros.page });
      if (this._filtros.status)      params.set('status',      this._filtros.status);
      if (this._filtros.data_inicio) params.set('data_inicio', new Date(this._filtros.data_inicio).toISOString());
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
});
