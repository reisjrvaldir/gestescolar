// =============================================
//  GESTESCOLAR – Ponto Docente (Professor)
//  Rota: professor-ponto
// =============================================

const ProfessorPonto = {

  _ajusteModal: null,
  _filtroData:  '', // Data específica (YYYY-MM-DD) ou vazio = mostra histórico geral

  CARGA_HORARIA_DIARIA: 8 * 60, // minutos (8h)

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

    const [pontos, bancoMes] = await Promise.all([
      this._buscarPontos(user),
      this._buscarBancoMes(),
    ]);
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

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

        <!-- Banco de Horas (mês atual) -->
        ${this._htmlBancoHoras(bancoMes)}

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
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span class="card-title"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</span>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <input type="date" id="prof-filtro-data" class="form-control" style="width:auto;font-size:13px;padding:6px 10px;"
                value="${this._filtroData}" max="${new Date().toISOString().slice(0,10)}"
                title="Buscar dia específico" />
              ${this._filtroData ? `
                <button class="btn btn-sm" style="background:var(--danger,#F44336);color:#fff;border:none;"
                  onclick="ProfessorPonto._limparFiltroData()">
                  <i class="fa-solid fa-xmark"></i> Limpar
                </button>
              ` : `
                <button class="btn btn-sm btn-primary" onclick="ProfessorPonto._aplicarFiltroData()">
                  <i class="fa-solid fa-magnifying-glass"></i> Buscar
                </button>
              `}
            </div>
          </div>
          <div style="padding:8px 0;">
            ${pontos.length === 0 ? (this._filtroData ? this._htmlRegistroManual() : `
              <div style="padding:32px;text-align:center;color:var(--text-muted);">
                <i class="fa-solid fa-inbox" style="font-size:32px;opacity:.4;display:block;margin-bottom:8px;"></i>
                Nenhum registro encontrado.
              </div>
            `) : this._htmlTabelaDias(pontos) /*`
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
            `*/}
          </div>
        </div>
      </div>
    `);

    // Relógio em tempo real
    this._iniciarRelogio();
  },

  // ─── REGISTRO MANUAL RETROATIVO ────────────────────────────────────────────

  _htmlRegistroManual() {
    const data = this._filtroData;
    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    return `
      <div style="padding:24px;">
        <div style="background:#FFF3E0;border-left:4px solid #FF9800;padding:14px 16px;border-radius:8px;margin-bottom:20px;">
          <div style="font-weight:700;color:#E65100;font-size:14px;margin-bottom:4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> Nenhum ponto registrado em ${dataFmt}
          </div>
          <div style="font-size:12px;color:#5D4037;">
            Você pode cadastrar manualmente os horários abaixo. Os registros serão enviados para
            <strong>aprovação do gestor</strong>.
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:18px;">
          ${this.TIPOS.map(t => `
            <div style="border:2px solid ${t.color}33;border-radius:10px;padding:12px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:${t.color};margin-bottom:8px;">
                <i class="fa-solid ${t.icon}"></i> ${t.label}
              </label>
              <input type="time" id="manual-${t.value}" class="form-control" style="width:100%;font-family:monospace;font-size:14px;" />
            </div>
          `).join('')}
        </div>

        <div class="form-group">
          <label class="form-label">Justificativa <span style="color:#F44336;">*</span></label>
          <textarea id="manual-justificativa" class="form-control" rows="3" maxlength="1000"
            placeholder="Ex: Esqueci de bater o ponto neste dia, estava em reunião externa, etc. (mínimo 10 caracteres)"></textarea>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
            <i class="fa-solid fa-info-circle"></i> A mesma justificativa será aplicada a todos os registros.
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button class="btn btn-outline" onclick="ProfessorPonto._limparFiltroData()">
            <i class="fa-solid fa-arrow-left"></i> Voltar
          </button>
          <button class="btn btn-primary" onclick="ProfessorPonto.enviarPontosManuais()">
            <i class="fa-solid fa-paper-plane"></i> Enviar para aprovação
          </button>
        </div>
      </div>
    `;
  },

  async enviarPontosManuais() {
    const justificativa = document.getElementById('manual-justificativa')?.value?.trim() || '';
    if (justificativa.length < 10)
      return Utils.toast('Justificativa deve ter ao menos 10 caracteres.', 'error');

    // Coleta horários preenchidos
    const horarios = this.TIPOS
      .map(t => ({ tipo: t.value, label: t.label, hora: document.getElementById(`manual-${t.value}`)?.value }))
      .filter(item => item.hora);

    if (horarios.length === 0)
      return Utils.toast('Preencha ao menos um horário.', 'error');

    // Confirmação
    if (!confirm(`Enviar ${horarios.length} registro(s) para aprovação do gestor?`)) return;

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    const data = this._filtroData; // YYYY-MM-DD
    let sucessos = 0, falhas = 0;
    const erros = [];

    for (const item of horarios) {
      try {
        // Monta timestamp local: data + hora
        const timestamp_manual = new Date(`${data}T${item.hora}:00`).toISOString();

        const resp = await fetch('/api/pontos', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body:    JSON.stringify({
            tipo: item.tipo,
            timestamp_manual,
            justificativa,
          }),
        });
        const json = await resp.json();
        if (resp.ok) sucessos++;
        else { falhas++; erros.push(`${item.label}: ${json.message || 'erro'}`); }
      } catch (e) {
        falhas++;
        erros.push(`${item.label}: erro de conexão`);
      }
    }

    if (sucessos > 0) {
      Utils.toast(`✅ ${sucessos} registro(s) enviado(s) para aprovação${falhas > 0 ? ` (${falhas} falhou)` : ''}!`, 'success');
    }
    if (erros.length > 0) {
      console.warn('[ProfessorPonto] erros no envio manual:', erros);
      if (sucessos === 0) Utils.toast(erros[0], 'error');
    }

    await this.render();
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

  // ─── TABELA AGRUPADA POR DIA ───────────────────────────────────────────────

  _htmlTabelaDias(pontos) {
    // Agrupa por dia
    const porDia = {};
    pontos.forEach(p => {
      const dia = new Date(p.timestamp).toISOString().slice(0, 10);
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(p);
    });

    const dias = Object.entries(porDia).sort(([a], [b]) => b.localeCompare(a)); // mais recente primeiro

    const linhas = dias.map(([dia, pts]) => {
      const get = (tipo) => pts.find(x => x.tipo === tipo);
      const cell = (tipo, cor) => {
        const p = get(tipo);
        if (!p) return `<td style="text-align:center;color:#ccc;font-family:monospace;">—</td>`;
        const hora     = new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        const status   = this.STATUS_META[p.status] || { color:'#666', label:p.status };
        const ajustar  = ['PENDENTE','REJEITADO'].includes(p.status);
        const titleDesc = p.descricao ? `\n${p.descricao}` : '';
        return `<td style="font-family:monospace;font-size:13px;text-align:center;" title="${status.label}${titleDesc}">
          <div style="color:${cor};font-weight:700;">${hora}</div>
          <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.color};margin-top:4px;" title="${status.label}"></div>
          ${ajustar ? `
            <button class="btn btn-sm btn-outline" style="padding:2px 6px;font-size:10px;margin-top:4px;display:block;margin-left:auto;margin-right:auto;"
              onclick="ProfessorPonto.abrirAjuste('${p.id}', '${p.timestamp}')" title="Solicitar ajuste">
              <i class="fa-solid fa-pen"></i>
            </button>
          ` : ''}
        </td>`;
      };

      const min       = this._minutosTrabalhados(pts);
      const saldo     = (min !== null) ? min - this.CARGA_HORARIA_DIARIA : null;
      const dataObj   = new Date(dia + 'T12:00:00');
      const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];

      return `<tr>
        <td style="font-family:monospace;font-size:13px;font-weight:600;white-space:nowrap;">
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
        </table>
      </div>
    `;
  },

  // ─── BANCO DE HORAS ────────────────────────────────────────────────────────

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
    if (min > 0)  return '#4CAF50';
    if (min < 0)  return '#F44336';
    return '#666';
  },

  _minutosTrabalhados(pontosDia) {
    const get = (tipo) => {
      const p = pontosDia.find(x => x.tipo === tipo);
      return p ? new Date(p.timestamp) : null;
    };
    const entrada = get('ENTRADA');
    const saida   = get('SAIDA');
    const intIni  = get('INTERVALO_INICIO');
    const intFim  = get('INTERVALO_FIM');
    if (!entrada || !saida) return null;
    let total = (saida - entrada) / 60000;
    if (intIni && intFim) total -= (intFim - intIni) / 60000;
    return Math.max(0, Math.round(total));
  },

  async _buscarBancoMes() {
    try {
      const token = await this._getToken();
      if (!token) return null;

      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);

      const params = new URLSearchParams({
        limit: 500,
        data_inicio: inicio.toISOString(),
        data_fim:    fim.toISOString(),
      });
      const resp = await fetch(`/api/pontos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      const pontos = json.data?.pontos || [];

      // Agrupa por dia e calcula saldo
      const porDia = {};
      pontos.forEach(p => {
        const dia = new Date(p.timestamp).toISOString().slice(0, 10);
        if (!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(p);
      });

      let saldoTotal = 0;
      let totalTrabalhado = 0;
      let diasComputados = 0;
      Object.values(porDia).forEach(pts => {
        const min = this._minutosTrabalhados(pts);
        if (min !== null) {
          saldoTotal      += min - this.CARGA_HORARIA_DIARIA;
          totalTrabalhado += min;
          diasComputados++;
        }
      });

      return { saldoTotal, totalTrabalhado, diasComputados, mesLabel: hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
    } catch { return null; }
  },

  _htmlBancoHoras(banco) {
    if (!banco) return '';
    const cor   = this._saldoCor(banco.saldoTotal);
    const sinal = banco.saldoTotal > 0 ? '+' : '';
    const icon  = banco.saldoTotal >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';

    return `
      <div class="card" style="margin-bottom:20px;border-left:5px solid ${cor};">
        <div style="padding:16px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:18px;">
          <div style="flex:1;min-width:200px;">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
              <i class="fa-solid fa-piggy-bank"></i> Banco de Horas — ${banco.mesLabel}
            </div>
            <div style="display:flex;align-items:baseline;gap:6px;">
              <span style="font-size:28px;font-weight:800;color:${cor};font-family:monospace;">
                <i class="fa-solid ${icon}" style="font-size:18px;"></i> ${sinal}${this._formatHoras(banco.saldoTotal)}
              </span>
              <span style="font-size:12px;color:var(--text-muted);">
                ${banco.saldoTotal > 0 ? 'horas a mais' : banco.saldoTotal < 0 ? 'horas em débito' : 'em equilíbrio'}
              </span>
            </div>
          </div>
          <div style="text-align:right;font-size:12px;color:var(--text-muted);">
            <div>Trabalhado: <strong style="color:#333;">${this._formatHoras(banco.totalTrabalhado)}</strong></div>
            <div>Dias completos: <strong style="color:#333;">${banco.diasComputados}</strong></div>
            <div>Meta diária: <strong style="color:#333;">8h00</strong></div>
          </div>
        </div>
      </div>
    `;
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  async _buscarPontos(user) {
    try {
      const token = await this._getToken();
      if (!token) return [];

      const params = new URLSearchParams({ limit: 30 });
      if (this._filtroData) {
        const di = new Date(this._filtroData);
        di.setHours(0, 0, 0, 0);
        const df = new Date(this._filtroData);
        df.setHours(23, 59, 59, 999);
        params.set('data_inicio', di.toISOString());
        params.set('data_fim',    df.toISOString());
      }

      const resp = await fetch(`/api/pontos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return json.data?.pontos || [];
    } catch { return []; }
  },

  _aplicarFiltroData() {
    const valor = document.getElementById('prof-filtro-data')?.value || '';
    if (!valor) {
      Utils.toast('Selecione uma data para buscar.', 'warning');
      return;
    }
    this._filtroData = valor;
    this.render();
  },

  _limparFiltroData() {
    this._filtroData = '';
    this.render();
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
