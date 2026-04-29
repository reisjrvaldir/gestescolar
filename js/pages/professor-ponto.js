// =============================================
//  GESTESCOLAR – Ponto Docente (Professor)
//  Rota: professor-ponto
// =============================================

const ProfessorPonto = {

  _ajusteModal: null,

  TIPOS: [
    { value: 'ENTRADA',          label: 'Entrada',          icon: 'fa-sign-in-alt',  color: '#4CAF50' },
    { value: 'INTERVALO_INICIO', label: 'Início Intervalo', icon: 'fa-coffee',       color: '#FF9800' },
    { value: 'INTERVALO_FIM',    label: 'Fim Intervalo',    icon: 'fa-play',         color: '#2196F3' },
    { value: 'SAIDA',            label: 'Saída',            icon: 'fa-sign-out-alt', color: '#F44336' },
  ],

  STATUS_META: {
    AUTO_VALIDADO: { color: '#4CAF50', label: 'Validado'  },
    PENDENTE:      { color: '#FF9800', label: 'Pendente'  },
    APROVADO:      { color: '#2196F3', label: 'Aprovado'  },
    REJEITADO:     { color: '#F44336', label: 'Rejeitado' },
  },

  // ─── RENDER ────────────────────────────────────────────────────────────────

  async render() {
    const user = Auth.require();
    if (!user) return;

    const pontos = await this._buscarPontos(user);
    const hoje   = new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    Router.renderLayout(user, 'professor-ponto', `
      <div style="max-width:900px;margin:0 auto;">

        <!-- Cabeçalho -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
          <div>
            <h2 style="margin:0;"><i class="fa-solid fa-fingerprint" style="color:var(--primary);"></i> Meu Ponto</h2>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${hoje}</div>
          </div>
          <div id="relogio" style="font-size:28px;font-weight:800;font-family:monospace;color:var(--primary);"></div>
        </div>

        <!-- Botões de registro -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><span class="card-title"><i class="fa-solid fa-hand-pointer"></i> Registrar Ponto</span></div>
          <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
            ${this.TIPOS.map(t => `
              <button onclick="ProfessorPonto.registrar('${t.value}')"
                style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 12px;
                       border:2px solid ${t.color};border-radius:12px;background:#fff;cursor:pointer;
                       transition:all .2s;font-size:13px;font-weight:600;color:${t.color};"
                onmouseover="this.style.background='${t.color}';this.style.color='#fff';"
                onmouseout="this.style.background='#fff';this.style.color='${t.color}';">
                <i class="fa-solid ${t.icon}" style="font-size:24px;"></i>
                ${t.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Histórico -->
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <span class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</span>
            <button class="btn btn-sm btn-outline" onclick="ProfessorPonto.render()">
              <i class="fa-solid fa-rotate"></i> Atualizar
            </button>
          </div>
          <div style="padding:8px 0;">
            ${pontos.length === 0 ? `
              <div style="padding:32px;text-align:center;color:var(--text-muted);">
                <i class="fa-solid fa-inbox" style="font-size:32px;opacity:.4;display:block;margin-bottom:8px;"></i>
                Nenhum registro encontrado.
              </div>
            ` : `
              <table class="table">
                <thead>
                  <tr>
                    <th>Data / Hora</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Descrição</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  ${pontos.map(p => {
                    const tipo   = this.TIPOS.find(t => t.value === p.tipo) || { label: p.tipo, color: '#666', icon: 'fa-circle' };
                    const status = this.STATUS_META[p.status] || { label: p.status, color: '#666' };
                    const dt     = new Date(p.timestamp);
                    const podeAjustar = ['PENDENTE','REJEITADO'].includes(p.status);
                    return `<tr>
                      <td style="font-family:monospace;font-size:13px;">
                        ${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td>
                        <span style="display:inline-flex;align-items:center;gap:6px;color:${tipo.color};font-weight:600;font-size:12px;">
                          <i class="fa-solid ${tipo.icon}"></i> ${tipo.label}
                        </span>
                      </td>
                      <td>
                        <span style="background:${status.color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;">
                          ${status.label}
                        </span>
                      </td>
                      <td style="font-size:12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${Utils.escape(p.descricao || '—')}
                      </td>
                      <td>
                        ${podeAjustar ? `
                          <button class="btn btn-sm btn-outline" onclick="ProfessorPonto.abrirAjuste('${p.id}', '${p.timestamp}')">
                            <i class="fa-solid fa-pen"></i> Solicitar ajuste
                          </button>
                        ` : '—'}
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `);

    // Relógio em tempo real
    this._iniciarRelogio();
  },

  // ─── REGISTRAR PONTO (abre modal com campo descrição) ──────────────────────

  registrar(tipo) {
    const tipoMeta = this.TIPOS.find(t => t.value === tipo);
    if (!tipoMeta) return;

    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    Utils.modal(`Confirmar ${tipoMeta.label}`, `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 0;margin-bottom:8px;border-bottom:1px solid var(--border);">
        <div style="width:48px;height:48px;border-radius:12px;background:${tipoMeta.color}22;display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid ${tipoMeta.icon}" style="color:${tipoMeta.color};font-size:22px;"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:16px;color:${tipoMeta.color};">${tipoMeta.label}</div>
          <div style="font-size:13px;color:var(--text-muted);font-family:monospace;">Horário: ${agora}</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição / Justificativa <span style="color:var(--text-muted);font-weight:400;">(opcional)</span></label>
        <textarea id="ponto-descricao" class="form-control" rows="3" maxlength="500"
          placeholder="Ex: Atrasado por trânsito, saindo mais cedo para consulta médica..."></textarea>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
          <i class="fa-solid fa-info-circle"></i> Descreva o motivo se houver alguma observação importante.
        </div>
      </div>
    `, `
      <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="ProfessorPonto._confirmarRegistro('${tipo}')">
        <i class="fa-solid fa-check"></i> Confirmar
      </button>
    `);

    setTimeout(() => document.getElementById('ponto-descricao')?.focus(), 100);
  },

  async _confirmarRegistro(tipo) {
    const tipoMeta  = this.TIPOS.find(t => t.value === tipo);
    const descricao = document.getElementById('ponto-descricao')?.value?.trim() || null;

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada. Faça login novamente.', 'error');

    document.querySelector('.modal-overlay')?.remove();

    try {
      const resp = await fetch('/api/pontos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ tipo, descricao }),
      });
      const json = await resp.json();

      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao registrar ponto.', 'error');
        return;
      }

      const dt = new Date(json.data.timestamp);
      Utils.toast(`✅ ${tipoMeta?.label} registrado às ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`, 'success');
      await this.render();

    } catch (e) {
      console.error('[ProfessorPonto] registrar:', e);
      Utils.toast('Erro de conexão ao registrar ponto.', 'error');
    }
  },

  // ─── MODAL DE AJUSTE ───────────────────────────────────────────────────────

  abrirAjuste(pontoId, timestampOriginal) {
    const dt = new Date(timestampOriginal);
    const dtLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16);

    Utils.modal('Solicitar Ajuste Manual',`
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
        <i class="fa-solid fa-triangle-exclamation" style="color:#FF9800;"></i>
        O ajuste será enviado para aprovação do gestor.
      </p>
      <div class="form-group">
        <label class="form-label">Novo horário *</label>
        <input type="datetime-local" id="aj-timestamp" class="form-control"
          value="${dtLocal}" max="${new Date().toISOString().slice(0,16)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Justificativa * (mínimo 10 caracteres)</label>
        <textarea id="aj-justificativa" class="form-control" rows="3" maxlength="1000"
          placeholder="Descreva o motivo do ajuste..."></textarea>
      </div>
    `, `
      <button class="btn btn-outline" onclick="document.querySelector('.modal-overlay').remove()">Cancelar</button>
      <button class="btn btn-primary" onclick="ProfessorPonto.enviarAjuste('${pontoId}')">
        <i class="fa-solid fa-paper-plane"></i> Enviar
      </button>
    `);
  },

  async enviarAjuste(pontoId) {
    const timestamp_ajustado = document.getElementById('aj-timestamp')?.value;
    const justificativa      = document.getElementById('aj-justificativa')?.value?.trim();

    if (!timestamp_ajustado) return Utils.toast('Informe o horário ajustado.', 'error');
    if (!justificativa || justificativa.length < 10) return Utils.toast('Justificativa deve ter pelo menos 10 caracteres.', 'error');

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch('/api/pontos-ajuste', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({
          ponto_id:           pontoId,
          justificativa,
          timestamp_ajustado: new Date(timestamp_ajustado).toISOString(),
        }),
      });
      const json = await resp.json();

      if (!resp.ok) {
        Utils.toast(json.message || 'Erro ao enviar ajuste.', 'error');
        return;
      }

      document.querySelector('.modal-overlay')?.remove();
      Utils.toast('Ajuste enviado para aprovação!', 'success');
      await this.render();

    } catch (e) {
      console.error('[ProfessorPonto] enviarAjuste:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  async _buscarPontos(user) {
    try {
      const token = await this._getToken();
      if (!token) return [];
      const resp = await fetch(`/api/pontos?limit=30`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return json.data?.pontos || [];
    } catch { return []; }
  },

  async _getToken() {
    try {
      const { data } = await supabaseClient.auth.getSession();
      return data?.session?.access_token || null;
    } catch { return null; }
  },

  _iniciarRelogio() {
    const el = document.getElementById('relogio');
    if (!el) return;
    const tick = () => {
      if (!document.getElementById('relogio')) return; // parar se saiu da página
      el.textContent = new Date().toLocaleTimeString('pt-BR');
      setTimeout(tick, 1000);
    };
    tick();
  },
};

window.ProfessorPonto = ProfessorPonto;

Router.register('professor-ponto', () => {
  ProfessorPonto.render();

  // Realtime: re-renderiza ao receber update do gestor (aprovação/rejeição/ajuste)
  if (typeof Realtime !== 'undefined') {
    const refresh = () => {
      clearTimeout(ProfessorPonto._rtTimer);
      ProfessorPonto._rtTimer = setTimeout(() => ProfessorPonto.render(), 300);
    };
    Realtime.subscribe('pontos_docente', null, refresh);
    Realtime.subscribe('ajustes_ponto',  null, refresh);
  }
});
