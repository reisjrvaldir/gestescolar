// =============================================
//  GESTESCOLAR – Calendário do Ano Letivo
//  Rota: admin-calendario
//  Gestor cadastra feriados municipais/estaduais/imprensados
// =============================================

const AdminCalendario = {

  _ano: new Date().getFullYear(),
  _mes: new Date().getMonth(), // 0-11
  _feriadosEscola: [],         // cache da API

  TIPO_META: {
    NACIONAL:   { label: 'Nacional',    color: '#1976D2', icon: 'fa-flag' },
    ESTADUAL:   { label: 'Estadual',    color: '#7B1FA2', icon: 'fa-landmark' },
    MUNICIPAL:  { label: 'Municipal',   color: '#388E3C', icon: 'fa-city' },
    IMPRENSADO: { label: 'Imprensado',  color: '#F57C00', icon: 'fa-link' },
    RECESSO:    { label: 'Recesso',     color: '#5E35B1', icon: 'fa-umbrella-beach' },
  },

  MESES: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],

  // ─── RENDER ────────────────────────────────────────────────────────────────

  async render() {
    const user = Auth.require();
    if (!user) return;
    if (!['gestor', 'administrativo', 'superadmin'].includes(user.role)) {
      Utils.toast('Acesso restrito ao gestor.', 'error');
      Router.go('admin-dashboard');
      return;
    }

    this._feriadosEscola = await this._buscarFeriados(this._ano);
    const nacionais = FeriadosNacionais.doAno(this._ano);

    // Mescla nacionais + escola por data
    const todos = [
      ...nacionais.map(f => ({ ...f, _origem: 'nacional' })),
      ...this._feriadosEscola.map(f => ({ ...f, _origem: 'escola' })),
    ];

    Router.renderLayout(user, 'admin-calendario', `
      <div style="max-width:1100px;margin:0 auto;">
        <!-- Cabeçalho -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;"><i class="fa-solid fa-calendar-days" style="color:var(--primary);"></i> Calendário do Ano Letivo</h2>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
              Cadastre feriados municipais/estaduais e dias imprensados que devem ser ignorados no controle de ponto.
            </div>
          </div>
          <button class="btn btn-primary" onclick="AdminCalendario.abrirNovoFeriado()">
            <i class="fa-solid fa-plus"></i> Novo Feriado
          </button>
        </div>

        <!-- Navegação de mês/ano -->
        <div class="card" style="margin-bottom:16px;">
          <div style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <button class="btn btn-sm btn-outline" onclick="AdminCalendario._navegar(-1)">
                <i class="fa-solid fa-chevron-left"></i>
              </button>
              <h3 style="margin:0;font-size:18px;min-width:200px;text-align:center;">
                ${this.MESES[this._mes]} / ${this._ano}
              </h3>
              <button class="btn btn-sm btn-outline" onclick="AdminCalendario._navegar(1)">
                <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
            <select id="ano-select" class="form-control" style="width:auto;"
              onchange="AdminCalendario._ano=parseInt(this.value);AdminCalendario.render()">
              ${[...Array(7)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return `<option value="${y}" ${this._ano === y ? 'selected' : ''}>${y}</option>`;
              }).join('')}
            </select>
          </div>
        </div>

        <!-- Calendário -->
        <div class="card" style="margin-bottom:20px;">
          ${this._htmlCalendario(todos)}
        </div>

        <!-- Lista de feriados do ano -->
        <div class="card">
          <div class="card-header"><span class="card-title"><i class="fa-solid fa-list"></i> Feriados em ${this._ano}</span></div>
          <div style="padding:8px 0;">
            ${this._htmlListaFeriados(todos)}
          </div>
        </div>

        <!-- Legenda -->
        <div class="card" style="margin-top:16px;">
          <div style="padding:14px 20px;display:flex;flex-wrap:wrap;gap:18px;align-items:center;font-size:12px;">
            <strong style="color:var(--text-muted);">Legenda:</strong>
            ${Object.entries(this.TIPO_META).map(([k, v]) => `
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="width:14px;height:14px;border-radius:3px;background:${v.color};"></span>
                ${v.label}
              </span>
            `).join('')}
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span style="width:14px;height:14px;border-radius:3px;background:#FFF;border:2px dashed #999;"></span>
              Fim de semana
            </span>
          </div>
        </div>
      </div>
    `);
  },

  // ─── CALENDÁRIO VISUAL ─────────────────────────────────────────────────────

  _htmlCalendario(feriados) {
    const ano = this._ano, mes = this._mes;
    const primeiroDia    = new Date(ano, mes, 1);
    const ultimoDia      = new Date(ano, mes + 1, 0);
    const totalDias      = ultimoDia.getDate();
    const diaInicialSem  = primeiroDia.getDay(); // 0 = domingo

    // Mapa: data YYYY-MM-DD => feriado
    const mapa = {};
    feriados.forEach(f => { mapa[f.data] = f; });

    const celulas = [];
    // Espaços em branco antes do dia 1
    for (let i = 0; i < diaInicialSem; i++) celulas.push(`<div style="background:#f8f8f8;"></div>`);

    for (let d = 1; d <= totalDias; d++) {
      const data    = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt      = new Date(ano, mes, d);
      const fimDeSem = dt.getDay() === 0 || dt.getDay() === 6;
      const fer     = mapa[data];
      const meta    = fer ? this.TIPO_META[fer.tipo] : null;
      const isHoje  = data === FeriadosNacionais._fmt(new Date());

      let bg     = '#fff';
      let borda  = '1px solid #e0e0e0';
      let cor    = '#333';
      let tooltip = '';
      if (fimDeSem)  { bg = '#fafafa'; cor = '#aaa'; borda = '1px dashed #ccc'; }
      if (fer && meta) {
        bg = meta.color + '22';
        borda = `2px solid ${meta.color}`;
        cor = meta.color;
        tooltip = `${meta.label}: ${fer.descricao}`;
      }
      if (isHoje) borda = `3px solid #2196F3`;

      const podeRemover = fer && fer._origem === 'escola';

      const clicavel = !fimDeSem;
      celulas.push(`
        <div style="background:${bg};border:${borda};padding:6px;min-height:64px;position:relative;border-radius:4px;${clicavel ? 'cursor:pointer;' : ''}"
          title="${Utils.escape(tooltip || (clicavel ? 'Clique para adicionar feriado' : ''))}"
          ${clicavel ? `onclick="AdminCalendario.abrirNovoFeriado('${data}')"` : ''}>
          <div style="font-weight:700;color:${cor};font-size:13px;">${d}</div>
          ${fer ? `
            <div style="font-size:9px;color:${cor};font-weight:600;line-height:1.1;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">
              ${Utils.escape(fer.descricao)}
            </div>
            ${podeRemover ? `
              <button onclick="event.stopPropagation();AdminCalendario.removerFeriado('${fer.id}', '${Utils.escape(fer.descricao)}')"
                style="position:absolute;top:2px;right:2px;background:none;border:none;color:#F44336;cursor:pointer;font-size:11px;padding:2px;"
                title="Remover">
                <i class="fa-solid fa-xmark"></i>
              </button>
            ` : ''}
          ` : (!fimDeSem ? `
            <div style="position:absolute;bottom:4px;right:6px;color:#bbb;font-size:16px;line-height:1;">+</div>
          ` : '')}
        </div>
      `);
    }

    const diasSem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `
      <div style="padding:14px 20px;">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px;">
          ${diasSem.map(d => `
            <div style="text-align:center;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;padding:6px 0;">${d}</div>
          `).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">
          ${celulas.join('')}
        </div>
      </div>
    `;
  },

  // ─── LISTA DE FERIADOS DO ANO ─────────────────────────────────────────────

  _htmlListaFeriados(todos) {
    if (todos.length === 0) {
      return `<div style="padding:32px;text-align:center;color:var(--text-muted);">Nenhum feriado cadastrado.</div>`;
    }

    const ordenado = [...todos].sort((a, b) => a.data.localeCompare(b.data));

    return `
      <div style="overflow-x:auto;">
        <table class="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Dia da semana</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th style="text-align:center;">Ação</th>
            </tr>
          </thead>
          <tbody>
            ${ordenado.map(f => {
              const meta = this.TIPO_META[f.tipo] || { label: f.tipo, color: '#666', icon: 'fa-circle' };
              const dt   = new Date(f.data + 'T12:00:00');
              const dia  = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dt.getDay()];
              return `<tr>
                <td style="font-family:monospace;font-size:13px;">${dt.toLocaleDateString('pt-BR')}</td>
                <td style="font-size:13px;">${dia}</td>
                <td style="font-size:13px;">${Utils.escape(f.descricao)}</td>
                <td>
                  <span style="background:${meta.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">
                    <i class="fa-solid ${meta.icon}"></i> ${meta.label}
                  </span>
                </td>
                <td style="text-align:center;">
                  ${f._origem === 'escola' ? `
                    <button class="btn btn-sm" style="background:#F44336;color:#fff;border:none;"
                      onclick="AdminCalendario.removerFeriado('${f.id}', '${Utils.escape(f.descricao)}')">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : `<span style="color:var(--text-muted);font-size:11px;"><i class="fa-solid fa-lock"></i> Nacional</span>`}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // ─── MODAL: NOVO FERIADO ──────────────────────────────────────────────────

  abrirNovoFeriado(dataPreenchida) {
    const hoje = FeriadosNacionais._fmt(new Date());
    Utils.modal('Novo Feriado / Imprensado', `
      <div class="form-group">
        <label class="form-label">Data *</label>
        <input type="date" id="fer-data" class="form-control" value="${dataPreenchida || hoje}" />
      </div>
      <div class="form-group">
        <label class="form-label">Descrição *</label>
        <input type="text" id="fer-desc" class="form-control" maxlength="200"
          placeholder="Ex: Aniversário da cidade, Imprensado da Páscoa..." />
      </div>
      <div class="form-group">
        <label class="form-label">Tipo *</label>
        <select id="fer-tipo" class="form-control">
          <option value="MUNICIPAL">Feriado Municipal</option>
          <option value="ESTADUAL">Feriado Estadual</option>
          <option value="IMPRENSADO">Imprensado (entre feriado e fim de semana)</option>
          <option value="RECESSO">Recesso escolar</option>
        </select>
      </div>
      <div style="font-size:11px;color:var(--text-muted);background:#FFF3E0;padding:10px;border-radius:6px;border-left:3px solid #FF9800;">
        <i class="fa-solid fa-info-circle"></i> Esta data será considerada não útil no controle de ponto.
        Professores não receberão pendência por ausência neste dia.
      </div>
    `, `
      <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="AdminCalendario._salvarFeriado()">
        <i class="fa-solid fa-check"></i> Salvar
      </button>
    `);
  },

  async _salvarFeriado() {
    const data      = document.getElementById('fer-data')?.value;
    const descricao = document.getElementById('fer-desc')?.value?.trim();
    const tipo      = document.getElementById('fer-tipo')?.value;

    if (!data)      return Utils.toast('Selecione uma data.', 'error');
    if (!descricao) return Utils.toast('Informe a descrição.', 'error');

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch('/api/feriados', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ data, descricao, tipo }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao salvar.', 'error');
        return;
      }
      document.querySelector('.modal-overlay')?.remove();
      Utils.toast('✅ Feriado cadastrado!', 'success');
      await this.render();
    } catch (e) {
      console.error('[AdminCalendario] salvar:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  async removerFeriado(id, descricao) {
    if (!confirm(`Remover o feriado "${descricao}"?`)) return;
    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch(`/api/feriados?id=${id}`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const json = await resp.json();
      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao remover.', 'error');
        return;
      }
      Utils.toast('Feriado removido.', 'success');
      await this.render();
    } catch (e) {
      console.error('[AdminCalendario] remover:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  _navegar(delta) {
    let novoMes = this._mes + delta;
    if (novoMes < 0)        { novoMes = 11; this._ano--; }
    else if (novoMes > 11)  { novoMes = 0;  this._ano++; }
    this._mes = novoMes;
    this.render();
  },

  async _buscarFeriados(ano) {
    try {
      const token = await this._getToken();
      if (!token) return [];
      const resp = await fetch(`/api/feriados?ano=${ano}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return Array.isArray(json.data) ? json.data : [];
    } catch { return []; }
  },

  async _getToken() {
    try {
      const { data } = await supabaseClient.auth.getSession();
      return data?.session?.access_token || null;
    } catch { return null; }
  },
};

window.AdminCalendario = AdminCalendario;

Router.register('admin-calendario', () => {
  AdminCalendario.render();
});
