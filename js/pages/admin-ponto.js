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
    professor_id: '',
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

    // Carrega feriados (com cache), ausências e dados principais em paralelo
    const anoAtual = new Date().getFullYear();

    const ausenciasPromise = (() => {
      if (this._filtros.professor_id && this._aba === 'registros') {
        const base = this._filtros.data_inicio
          ? new Date(this._filtros.data_inicio + 'T12:00:00')
          : new Date();
        return this._carregarAusencias(this._filtros.professor_id, base.getMonth() + 1, base.getFullYear());
      }
      if (this._aba === 'relatorio' && this._filtrosRelatorio.professor_id) {
        return this._carregarAusencias(this._filtrosRelatorio.professor_id, this._filtrosRelatorio.mes, this._filtrosRelatorio.ano);
      }
      return Promise.resolve();
    })();

    const dadosPromise = this._aba === 'registros' ? this._buscarRegistros()
      : this._aba === 'ajustes' ? this._buscarAjustes()
      : this._buscarRelatorio();

    // Ajustes pendentes: reutiliza dados se já estamos na aba, senão busca em paralelo
    const ajustesPromise = this._aba === 'ajustes'
      ? dadosPromise
      : this._buscarAjustesPendentes();

    const [, dados, ajustesPendentes] = await Promise.all([
      Promise.all([
        this._carregarFeriados(`${anoAtual}-01-01`, `${anoAtual}-12-31`),
        ausenciasPromise,
      ]),
      dadosPromise,
      ajustesPromise,
    ]);

    const resumo = this._calcularResumo(dados, ajustesPendentes);

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
            onchange="AdminPonto._selecionarProfessor(this.value)">
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
          <button class="btn btn-sm btn-outline" onclick="AdminPonto._irParaMes(-1)" title="Mês anterior">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <input type="date" id="filtro-inicio" class="form-control" style="width:auto;"
            value="${this._filtros.data_inicio}" title="Data início" />
          <input type="date" id="filtro-fim" class="form-control" style="width:auto;"
            value="${this._filtros.data_fim}" title="Data fim" />
          <button class="btn btn-sm btn-outline" onclick="AdminPonto._irParaMes(1)" title="Próximo mês">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
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
          ${this._filtros.professor_id
            ? this._htmlTabelaPorDia(pontos, false)
            : pontos.length === 0
              ? `<div style="padding:40px;text-align:center;color:var(--text-muted);">
                  <i class="fa-solid fa-inbox" style="font-size:36px;opacity:.35;display:block;margin-bottom:10px;"></i>
                  Nenhum registro encontrado. Selecione um professor para ver o mês completo.
                </div>`
              : this._htmlTabelaPorDia(pontos, true)
          }
        </div>
      </div>
    `;
  },

  // ─── TABELA POR DIA (1 linha = 1 dia, 4 horários lado a lado) ──────────────

  _htmlTabelaPorDia(pontos, mostrarProfessor = false) {
    // Agrupa por (professor + dia) quando mostrar professor; senão por dia
    const grupos = {};
    pontos.forEach(p => {
      const dia    = new Date(p.timestamp).toISOString().slice(0, 10);
      const profId = p.user_id || 'unknown';
      const key    = mostrarProfessor ? `${profId}__${dia}` : dia;
      if (!grupos[key]) grupos[key] = { dia, profId, profNome: p.user_name || '—', pontos: [] };
      grupos[key].pontos.push(p);
    });

    // Quando há professor selecionado, preenche TODOS os dias do mês (1 até último dia)
    let ausencias = 0;
    if (!mostrarProfessor && this._filtros.professor_id) {
      const di = this._filtros.data_inicio ? new Date(this._filtros.data_inicio + 'T12:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const df = this._filtros.data_fim    ? new Date(this._filtros.data_fim + 'T12:00:00')    : new Date();
      const hoje = new Date(); hoje.setHours(23,59,59,999);
      const fimReal = df > hoje ? hoje : df;

      // Gera todos os dias do mês (não apenas úteis)
      const cur = new Date(di); cur.setHours(12,0,0,0);
      const end = new Date(fimReal); end.setHours(12,0,0,0);
      while (cur <= end) {
        const ymd = cur.toISOString().slice(0,10);
        if (!grupos[ymd]) {
          const ehUtil = this._ehDiaUtil(ymd);
          const ausencia = this._ausenciasCache.find(a => a.data === ymd);
          grupos[ymd] = {
            dia: ymd, profId: this._filtros.professor_id, profNome: '', pontos: [],
            _ausente: ehUtil, _fimDeSem: !ehUtil, _ausenciaRegistro: ausencia || null,
          };
          if (ehUtil && !ausencia) ausencias++;
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Ordena: professor selecionado = data CRESCENTE; "Todos" = por professor alfa + data desc
    const linhasOrdenadas = Object.values(grupos).sort((a, b) => {
      if (mostrarProfessor) {
        const cmpProf = a.profNome.localeCompare(b.profNome);
        if (cmpProf !== 0) return cmpProf;
        return b.dia.localeCompare(a.dia);
      }
      return a.dia.localeCompare(b.dia); // CRESCENTE quando professor selecionado
    });

    let saldoMes = 0;
    let totalTrab = 0;

    const linhas = linhasOrdenadas.map(g => {
      // ── Fim de semana / Feriado (sem ponto, mas pode ter ausência registrada) ──
      if (g._fimDeSem && g.pontos.length === 0) {
        const dataObj   = new Date(g.dia + 'T12:00:00');
        const dow       = dataObj.getDay();
        const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow];
        const isFer     = dow !== 0 && dow !== 6;
        const tagFds    = isFer
          ? `<span style="background:#FFE0B2;color:#E65100;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700;">FERIADO</span>`
          : `<span style="background:#E1BEE7;color:#4A148C;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700;">${dow===6?'SÁBADO':'DOMINGO'}</span>`;
        const reg = g._ausenciaRegistro;

        // Em fim de semana / feriado, ausência NÃO afeta o banco de horas
        // (apenas registro/documentação para eventos especiais)
        let conteudoCentro;
        if (reg) {
          const meta = this.TIPO_AUSENCIA[reg.tipo] || { label: reg.tipo, cor: '#666', icon: 'fa-question' };
          const obs  = reg.observacao ? ` — ${reg.observacao.slice(0,50)}` : '';
          conteudoCentro = `
            <td colspan="4" style="text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:6px;">
                <span style="background:${meta.cor}22;color:${meta.cor};padding:4px 12px;border-radius:8px;font-weight:700;font-size:12px;">
                  <i class="fa-solid ${meta.icon}"></i> ${meta.label}
                </span>
                ${reg.periodo !== 'integral' ? `<span style="font-size:10px;color:#666;background:#f0f0f0;padding:2px 6px;border-radius:4px;">${reg.periodo === 'manha' ? 'Manhã' : 'Tarde'}</span>` : ''}
                <button class="btn btn-sm" style="background:none;border:1px solid ${meta.cor};color:${meta.cor};padding:2px 8px;font-size:10px;cursor:pointer;"
                  onclick="AdminPonto.abrirModalAusencia('${g.profId}','${g.dia}')">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm" style="background:none;border:1px solid #F44336;color:#F44336;padding:2px 8px;font-size:10px;cursor:pointer;"
                  onclick="AdminPonto._excluirAusencia('${reg.id}')" title="Remover">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              ${obs ? `<div style="font-size:10px;color:#888;margin-top:2px;">${obs}</div>` : ''}
            </td>`;
        } else {
          conteudoCentro = `
            <td colspan="4" style="text-align:center;color:#BDBDBD;font-size:12px;">
              <span style="margin-right:8px;">—</span>
              <button class="btn btn-sm" style="background:none;color:#666;border:1px dashed #BDBDBD;padding:2px 10px;font-size:10px;cursor:pointer;border-radius:6px;"
                onclick="AdminPonto.abrirModalAusencia('${g.profId}','${g.dia}')" title="Registrar evento ou ausência neste dia">
                <i class="fa-solid fa-plus"></i> Registrar
              </button>
            </td>`;
        }

        const bgCor = reg ? (this.TIPO_AUSENCIA[reg.tipo]?.cor || '#666') + '11' : '#FAFAFA';
        return `<tr style="background:${bgCor};${reg ? '' : 'opacity:.7;'}">
          <td style="font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;color:${reg ? '#555' : '#999'};">
            ${dataObj.toLocaleDateString('pt-BR')}
            <div style="font-size:10px;color:${reg ? '#888' : '#999'};font-weight:400;">${diaSemana} ${tagFds}</div>
          </td>
          ${conteudoCentro}
          <td style="text-align:center;color:#BDBDBD;font-family:monospace;font-size:12px;">—</td>
          <td style="text-align:center;color:#BDBDBD;font-family:monospace;font-size:12px;">—</td>
        </tr>`;
      }

      // ── Dia útil sem ponto (AUSÊNCIA) ──
      if (g._ausente) {
        const dataObj   = new Date(g.dia + 'T12:00:00');
        const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];
        const reg       = g._ausenciaRegistro;

        // Cálculo de saldo conforme tipo de ausência
        let saldoDia = -this.CARGA_HORARIA_DIARIA; // default: desconta tudo
        if (reg) {
          const meta = this.TIPO_AUSENCIA[reg.tipo];
          if (meta) {
            if (meta.desconto === false) {
              saldoDia = 0; // ATESTADO_MEDICO / ABONADO → sem desconto
            } else if (meta.desconto === 'parcial') {
              // DECLARACAO_MEDICA → abona horas_abonadas, desconta o restante
              const abonadas = parseFloat(reg.horas_abonadas || 0) * 60;
              saldoDia = -(this.CARGA_HORARIA_DIARIA - abonadas);
            }
            // desconto === true → desconta tudo (FALTA_JUSTIFICADA, FALTA_INJUSTIFICADA)
          }
        }
        saldoMes += saldoDia;

        // Conteúdo da linha
        let conteudoCentro;
        if (reg) {
          const meta = this.TIPO_AUSENCIA[reg.tipo] || { label: reg.tipo, cor: '#666', icon: 'fa-question' };
          const obs  = reg.observacao ? ` — ${reg.observacao.slice(0,50)}` : '';
          conteudoCentro = `
            <td colspan="4" style="text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:6px;">
                <span style="background:${meta.cor}22;color:${meta.cor};padding:4px 12px;border-radius:8px;font-weight:700;font-size:12px;">
                  <i class="fa-solid ${meta.icon}"></i> ${meta.label}
                </span>
                ${reg.periodo !== 'integral' ? `<span style="font-size:10px;color:#666;background:#f0f0f0;padding:2px 6px;border-radius:4px;">${reg.periodo === 'manha' ? 'Manhã' : 'Tarde'}</span>` : ''}
                <button class="btn btn-sm" style="background:none;border:1px solid ${meta.cor};color:${meta.cor};padding:2px 8px;font-size:10px;cursor:pointer;"
                  onclick="AdminPonto.abrirModalAusencia('${g.profId}','${g.dia}')">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm" style="background:none;border:1px solid #F44336;color:#F44336;padding:2px 8px;font-size:10px;cursor:pointer;"
                  onclick="AdminPonto._excluirAusencia('${reg.id}')" title="Remover">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
              ${obs ? `<div style="font-size:10px;color:#888;margin-top:2px;">${obs}</div>` : ''}
            </td>`;
        } else {
          conteudoCentro = `
            <td colspan="4" style="text-align:center;">
              <span style="color:#C62828;font-weight:600;font-size:12px;margin-right:8px;">
                <i class="fa-solid fa-circle-exclamation"></i> Sem registro
              </span>
              <button class="btn btn-sm" style="background:#FF9800;color:#fff;padding:4px 12px;font-size:11px;border:none;border-radius:6px;cursor:pointer;"
                onclick="AdminPonto.abrirModalAusencia('${g.profId}','${g.dia}')">
                <i class="fa-solid fa-plus"></i> Registrar Ausência
              </button>
            </td>`;
        }

        const bgCor = reg ? (this.TIPO_AUSENCIA[reg.tipo]?.cor || '#666') + '11' : '#FFEBEE';
        return `<tr style="background:${bgCor};">
          <td style="font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;color:${reg ? '#555' : '#C62828'};">
            ${dataObj.toLocaleDateString('pt-BR')}
            <div style="font-size:10px;color:${reg ? '#888' : '#C62828'};font-weight:400;">${diaSemana}</div>
          </td>
          ${conteudoCentro}
          <td style="text-align:center;font-family:monospace;font-size:12px;color:${reg ? '#888' : '#C62828'};">0h00</td>
          <td style="text-align:center;font-family:monospace;font-size:12px;font-weight:700;color:${this._saldoCor(saldoDia)};">
            ${saldoDia === 0 ? '0h00' : (saldoDia > 0 ? '+' : '') + this._formatHoras(saldoDia)}
          </td>
        </tr>`;
      }

      const pts = g.pontos;
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
      // Em dia NÃO útil (sáb/dom/feriado), tudo trabalhado vira banco de horas (sem deduzir 8h)
      const ehUtil = this._ehDiaUtil(g.dia);
      const saldo  = (min !== null) ? (ehUtil ? min - this.CARGA_HORARIA_DIARIA : min) : null;
      if (min !== null)   totalTrab += min;
      if (saldo !== null) saldoMes  += saldo;

      const dataObj   = new Date(g.dia + 'T12:00:00');
      const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];
      const isFimSem  = dataObj.getDay() === 0 || dataObj.getDay() === 6;
      const isFeriado = !ehUtil && !isFimSem;
      const tag       = isFeriado ? `<span style="background:#FFE0B2;color:#E65100;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700;">FERIADO</span>` :
                        isFimSem  ? `<span style="background:#E1BEE7;color:#4A148C;font-size:9px;padding:1px 5px;border-radius:8px;font-weight:700;">${dataObj.getDay()===6?'SÁBADO':'DOMINGO'}</span>` : '';

      return `<tr ${!ehUtil && min ? 'style="background:#F1F8E9;"' : ''}>
        ${mostrarProfessor ? `
          <td style="font-size:13px;font-weight:600;white-space:nowrap;">${Utils.escape(g.profNome)}</td>
        ` : ''}
        <td style="font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;">
          ${dataObj.toLocaleDateString('pt-BR')}
          <div style="font-size:10px;color:var(--text-muted);font-weight:400;">${diaSemana} ${tag}</div>
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
    const colspanFooter = mostrarProfessor ? 6 : 5;

    return `
      <div style="overflow-x:auto;">
        <table class="table" style="font-size:12px;">
          <thead>
            <tr>
              ${mostrarProfessor ? `<th>Professor</th>` : ''}
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
          ${!mostrarProfessor ? `
            <tfoot>
              <tr style="background:#f5f5f5;font-weight:700;">
                <td colspan="${colspanFooter}" style="text-align:right;">TOTAL DO PERÍODO:</td>
                <td style="text-align:center;">${this._formatHoras(totalTrab)}</td>
                <td style="text-align:center;color:${corSaldoMes};">${sinalMes}${this._formatHoras(saldoMes)}</td>
              </tr>
            </tfoot>
          ` : ''}
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
  _feriadosCache: {},           // { 'YYYY-MM-DD': true }
  _feriadosCacheAno: null,      // ano já carregado no cache
  _ausenciasCache: [],          // ausências do mês carregado

  TIPO_AUSENCIA: {
    FALTA_JUSTIFICADA:   { label: 'Falta Justificada',   cor: '#FF9800', icon: 'fa-file-lines',      desconto: true  },
    FALTA_INJUSTIFICADA: { label: 'Falta Injustificada', cor: '#F44336', icon: 'fa-circle-xmark',    desconto: true  },
    ATESTADO_MEDICO:     { label: 'Atestado Médico',     cor: '#2196F3', icon: 'fa-file-medical',     desconto: false },
    DECLARACAO_MEDICA:   { label: 'Declaração Médica',   cor: '#9C27B0', icon: 'fa-file-waveform',    desconto: 'parcial' },
    ABONADO:             { label: 'Abonado',             cor: '#607D8B', icon: 'fa-calendar-check',   desconto: false },
  },

  async _carregarAusencias(userId, mes, ano) {
    try {
      const token = await this._getToken();
      if (!token) return;
      const resp = await fetch(`/api/ausencias?user_id=${userId}&mes=${mes}&ano=${ano}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) { this._ausenciasCache = []; return; }
      const json = await resp.json();
      this._ausenciasCache = json.data || [];
    } catch (e) {
      console.warn('[AdminPonto] ausencias:', e);
      this._ausenciasCache = [];
    }
  },

  // Verifica se uma data (YYYY-MM-DD) é dia útil (não é fim de semana nem feriado)
  _ehDiaUtil(dataYMD) {
    const dt  = new Date(dataYMD + 'T12:00:00');
    const dow = dt.getDay(); // 0 = dom, 6 = sáb
    if (dow === 0 || dow === 6) return false;                                  // fim de semana
    if (typeof FeriadosNacionais !== 'undefined' && FeriadosNacionais.ehFeriado(dataYMD)) return false;
    if (this._feriadosCache[dataYMD]) return false;                            // feriado da escola
    return true;
  },

  // Carrega feriados da escola para um intervalo
  async _carregarFeriados(dataInicioISO, dataFimISO) {
    try {
      const ai = new Date(dataInicioISO).getFullYear();
      const af = new Date(dataFimISO).getFullYear();
      // Só recarrega se o ano mudou ou o cache está vazio
      if (this._feriadosCacheAno === `${ai}-${af}` && Object.keys(this._feriadosCache).length > 0) return;
      const token = await this._getToken();
      if (!token) return;
      this._feriadosCache = {};
      const fetches = [];
      for (let ano = ai; ano <= af; ano++) {
        fetches.push(fetch(`/api/feriados?ano=${ano}`, { headers: { 'Authorization': `Bearer ${token}` } }));
      }
      const resps = await Promise.all(fetches);
      for (const resp of resps) {
        if (!resp.ok) continue;
        const json = await resp.json();
        (json.data || []).forEach(f => { this._feriadosCache[f.data] = f; });
      }
      this._feriadosCacheAno = `${ai}-${af}`;
    } catch (e) { console.warn('[AdminPonto] feriados:', e); }
  },

  // Lista todos os dias úteis dentro de um intervalo (inclusive)
  _diasUteisIntervalo(dataInicio, dataFim) {
    const lista = [];
    const cur = new Date(dataInicio);
    cur.setHours(12, 0, 0, 0);
    const end = new Date(dataFim);
    end.setHours(12, 0, 0, 0);
    while (cur <= end) {
      const ymd = cur.toISOString().slice(0, 10);
      if (this._ehDiaUtil(ymd)) lista.push(ymd);
      cur.setDate(cur.getDate() + 1);
    }
    return lista;
  },

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

    const professores = (typeof DB !== 'undefined' ? DB.getUsers() : [])
      .filter(u => u.role === 'professor')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const profSelecionado = this._filtrosRelatorio.professor_id;

    return `
      <!-- Filtros -->
      <div class="card" style="margin-bottom:16px;">
        <div style="padding:14px 20px;display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
          <select id="rel-professor" class="form-control" style="width:auto;min-width:220px;"
            onchange="AdminPonto._filtrosRelatorio.professor_id=this.value;AdminPonto.render('relatorio')">
            <option value="">— Selecione um professor —</option>
            ${professores.map(p => `
              <option value="${p.id}" ${profSelecionado === p.id ? 'selected' : ''}>${Utils.escape(p.name)}</option>
            `).join('')}
          </select>
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
          <button class="btn btn-sm btn-primary" onclick="AdminPonto._imprimirRelatorio()" ${!profSelecionado ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>
            <i class="fa-solid fa-print"></i> Imprimir
          </button>
        </div>
      </div>

      <!-- Conteúdo -->
      ${!profSelecionado ? `
        <div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">
          <i class="fa-solid fa-user-tie" style="font-size:36px;opacity:.35;display:block;margin-bottom:10px;"></i>
          Selecione um professor para gerar o relatório.
        </div>
      ` : (() => {
        // Sempre renderiza bloco do professor (mesmo sem pontos, mostra todos os dias do mês)
        const profObj = professores.find(p => p.id === profSelecionado);
        const nomeProf = profObj?.name || 'Professor';
        const dias = agrupado[nomeProf] || {};
        return this._htmlBlocoProfessor(nomeProf, dias);
      })()}
    `;
  },

  _htmlBlocoProfessor(prof, dias) {
    let saldoMes = 0;
    let totalTrabalhado = 0;

    // Gera TODOS os dias do mês (1 ao último dia)
    const mesNum = parseInt(this._filtrosRelatorio.mes, 10);
    const anoNum = parseInt(this._filtrosRelatorio.ano, 10);
    const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
    const todosOsDias = {};
    for (let d = 1; d <= ultimoDia; d++) {
      const ymd = `${anoNum}-${String(mesNum).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      todosOsDias[ymd] = dias[ymd] || [];
    }

    const hoje = new Date(); hoje.setHours(23,59,59,999);

    const linhas = Object.entries(todosOsDias).sort(([a], [b]) => a.localeCompare(b)).map(([dia, pts]) => {
      const dataObj   = new Date(dia + 'T12:00:00');
      const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];
      const ehUtil    = this._ehDiaUtil(dia);
      const dow       = dataObj.getDay();
      const isFimSem  = dow === 0 || dow === 6;
      const isFeriado = !ehUtil && !isFimSem;
      const futuro    = dataObj > hoje;
      const ausencia  = this._ausenciasCache.find(a => a.data === dia);

      const tag = isFeriado
        ? `<span style="background:#FFE0B2;color:#E65100;font-size:9px;padding:1px 5px;border-radius:6px;">FERIADO</span>`
        : isFimSem
          ? `<span style="background:#E1BEE7;color:#4A148C;font-size:9px;padding:1px 5px;border-radius:6px;">${dow===6?'SÁB':'DOM'}</span>`
          : '';

      // ── Tem pontos ──
      if (pts.length > 0) {
        const get = (tipo) => pts.find(x => x.tipo === tipo);
        const fmt = (p) => p ? new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—';
        const min   = this._minutosTrabalhados(pts);
        const saldo = (min !== null) ? (ehUtil ? min - this.CARGA_HORARIA_DIARIA : min) : null;
        if (min !== null)   totalTrabalhado += min;
        if (saldo !== null) saldoMes        += saldo;

        return `<tr ${!ehUtil && min ? 'style="background:#F1F8E9;"' : ''}>
          <td style="font-family:monospace;font-size:12px;white-space:nowrap;">
            ${dataObj.toLocaleDateString('pt-BR')} <span style="color:var(--text-muted);">${diaSemana}</span> ${tag}
          </td>
          <td style="font-family:monospace;font-size:12px;color:#4CAF50;">${fmt(get('ENTRADA'))}</td>
          <td style="font-family:monospace;font-size:12px;color:#FF9800;">${fmt(get('INTERVALO_INICIO'))}</td>
          <td style="font-family:monospace;font-size:12px;color:#2196F3;">${fmt(get('INTERVALO_FIM'))}</td>
          <td style="font-family:monospace;font-size:12px;color:#F44336;">${fmt(get('SAIDA'))}</td>
          <td style="font-family:monospace;font-size:12px;font-weight:700;">${this._formatHoras(min)}</td>
          <td style="font-family:monospace;font-size:12px;font-weight:700;color:${this._saldoCor(saldo)};">
            ${saldo !== null ? (saldo > 0 ? '+' : '') + this._formatHoras(saldo) : '—'}
          </td>
        </tr>`;
      }

      // ── Ausência registrada ──
      if (ausencia) {
        const meta = this.TIPO_AUSENCIA[ausencia.tipo] || { label: ausencia.tipo, cor:'#666' };
        let saldoDia = 0;
        if (ehUtil) {
          if (meta.desconto === true) saldoDia = -this.CARGA_HORARIA_DIARIA;
          else if (meta.desconto === 'parcial') saldoDia = -(this.CARGA_HORARIA_DIARIA - parseFloat(ausencia.horas_abonadas||0)*60);
        }
        saldoMes += saldoDia;

        return `<tr style="background:${meta.cor}11;">
          <td style="font-family:monospace;font-size:12px;white-space:nowrap;">
            ${dataObj.toLocaleDateString('pt-BR')} <span style="color:var(--text-muted);">${diaSemana}</span> ${tag}
          </td>
          <td colspan="4" style="text-align:center;">
            <span style="background:${meta.cor}22;color:${meta.cor};padding:3px 10px;border-radius:6px;font-weight:700;font-size:11px;">
              ${meta.label}${ausencia.periodo !== 'integral' ? ` (${ausencia.periodo === 'manha' ? 'Manhã' : 'Tarde'})` : ''}
            </span>
          </td>
          <td style="font-family:monospace;font-size:12px;font-weight:700;color:#888;">0h00</td>
          <td style="font-family:monospace;font-size:12px;font-weight:700;color:${this._saldoCor(saldoDia)};">
            ${saldoDia === 0 ? '0h00' : (saldoDia > 0 ? '+' : '') + this._formatHoras(saldoDia)}
          </td>
        </tr>`;
      }

      // ── Sem registro: dia útil → -8h, fds/feriado/futuro → 0 ──
      let saldoDia = 0;
      let labelCentro;
      let bgRow = '';
      let corTexto = 'var(--text-muted)';
      if (futuro) {
        labelCentro = `<span style="color:#BDBDBD;font-size:11px;">—</span>`;
      } else if (!ehUtil) {
        labelCentro = `<span style="color:#BDBDBD;font-size:11px;">—</span>`;
      } else {
        // Dia útil sem ponto e sem ausência → falta automática
        saldoDia = -this.CARGA_HORARIA_DIARIA;
        saldoMes += saldoDia;
        bgRow = 'background:#FFEBEE;';
        corTexto = '#C62828';
        labelCentro = `<span style="color:#C62828;font-weight:600;font-size:11px;">
          <i class="fa-solid fa-circle-exclamation"></i> Sem registro
        </span>`;
      }

      return `<tr style="${bgRow}">
        <td style="font-family:monospace;font-size:12px;white-space:nowrap;color:${corTexto};">
          ${dataObj.toLocaleDateString('pt-BR')} <span style="color:var(--text-muted);">${diaSemana}</span> ${tag}
        </td>
        <td colspan="4" style="text-align:center;">${labelCentro}</td>
        <td style="font-family:monospace;font-size:12px;color:${corTexto};">0h00</td>
        <td style="font-family:monospace;font-size:12px;font-weight:700;color:${this._saldoCor(saldoDia)};">
          ${saldoDia === 0 ? (futuro || !ehUtil ? '—' : '0h00') : (saldoDia > 0 ? '+' : '') + this._formatHoras(saldoDia)}
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

  _selecionarProfessor(id) {
    this._filtros.professor_id = id;
    this._filtros.page = 1;
    // Quando seleciona um professor, garante que mês está definido
    if (id && !this._filtros.data_inicio) {
      const hoje = new Date();
      const ini  = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      this._filtros.data_inicio = fmt(ini);
      this._filtros.data_fim    = fmt(fim);
    }
    this._recarregar();
  },

  _irParaMes(delta) {
    // Se tem data_inicio, navega a partir dela; senão, a partir do mês atual
    // IMPORTANTE: usar 'T12:00:00' para evitar bug de timezone (UTC vs local)
    const base = this._filtros.data_inicio
      ? new Date(this._filtros.data_inicio + 'T12:00:00')
      : new Date();
    const novoMes = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    const fimMes  = new Date(novoMes.getFullYear(), novoMes.getMonth() + 1, 0);
    const fmt = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    this._filtros.data_inicio = fmt(novoMes);
    this._filtros.data_fim    = fmt(fimMes);
    this._filtros.page        = 1;
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

  // Deriva os cards de resumo a partir dos dados já buscados (sem fetch adicional)
  _calcularResumo(dados, ajustesOuCount) {
    try {
      const pontos = Array.isArray(dados) ? dados : (dados?.pontos || []);
      let labelPeriodo;
      if (this._filtros.data_inicio || this._filtros.data_fim) {
        const di = this._filtros.data_inicio ? new Date(this._filtros.data_inicio) : new Date();
        const df = this._filtros.data_fim    ? new Date(this._filtros.data_fim)    : new Date();
        labelPeriodo = `Total ${di.toLocaleDateString('pt-BR')} a ${df.toLocaleDateString('pt-BR')}`;
      } else {
        labelPeriodo = 'Total do mês';
      }
      const contagem = { total: pontos.length, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0 };
      pontos.forEach(p => {
        const k = p.status?.toLowerCase();
        if (contagem[k] !== undefined) contagem[k]++;
      });
      // ajustesOuCount pode ser número (fetch paralelo) ou array (aba ajustes)
      const ajustesPendentes = typeof ajustesOuCount === 'number'
        ? ajustesOuCount
        : (Array.isArray(ajustesOuCount) ? ajustesOuCount.filter(a => a.status === 'PENDENTE').length : 0);
      return { ...contagem, ajustesPendentes, labelPeriodo };
    } catch { return { total: 0, pendente: 0, auto_validado: 0, aprovado: 0, rejeitado: 0, ajustesPendentes: 0, labelPeriodo: 'Total do mês' }; }
  },

  async _buscarAjustesPendentes() {
    try {
      const token = await this._getToken();
      if (!token) return 0;
      const resp = await fetch(`/api/pontos-ajuste?status=PENDENTE&limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) return 0;
      const json = await resp.json();
      return Array.isArray(json.data) ? json.data.length : 0;
    } catch { return 0; }
  },

  async _buscarRegistros() {
    try {
      const token = await this._getToken();
      if (!token) return { pontos: [], total: 0 };

      // Sempre busca mais registros para cobrir o mês
      const params = new URLSearchParams({ limit: 100, page: this._filtros.page });
      if (this._filtros.status)       params.set('status',       this._filtros.status);
      if (this._filtros.professor_id) params.set('user_id',      this._filtros.professor_id);

      // Se sem filtro de data, usa mês atual como padrão
      const dataInicio = this._filtros.data_inicio
        ? new Date(this._filtros.data_inicio + 'T00:00:00')
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      params.set('data_inicio', dataInicio.toISOString());

      if (this._filtros.data_fim) {
        const fim = new Date(this._filtros.data_fim + 'T23:59:59.999');
        params.set('data_fim', fim.toISOString());
      } else {
        // Sem data_fim = até o último dia do mês da data_inicio
        const fimMes = new Date(dataInicio.getFullYear(), dataInicio.getMonth() + 1, 0, 23, 59, 59, 999);
        params.set('data_fim', fimMes.toISOString());
      }

      console.log('[AdminPonto] buscando pontos:', params.toString());
      const resp = await fetch(`/api/pontos?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) {
        const errTxt = await resp.text().catch(() => '');
        console.error('[AdminPonto] API erro:', resp.status, errTxt);
        return { pontos: [], total: 0 };
      }
      const json = await resp.json();
      console.log('[AdminPonto] pontos recebidos:', json.data?.pontos?.length || 0);
      return { pontos: json.data?.pontos || [], total: json.data?.total || 0 };
    } catch (e) {
      console.error('[AdminPonto] buscarRegistros erro:', e);
      return { pontos: [], total: 0 };
    }
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
      // Sem professor selecionado, não busca pontos
      if (!this._filtrosRelatorio.professor_id) return { pontos: [], total: 0 };

      const token = await this._getToken();
      if (!token) return { pontos: [], total: 0 };

      const mes = String(this._filtrosRelatorio.mes).padStart(2, '0');
      const ano = this._filtrosRelatorio.ano;
      const dataInicio = new Date(`${ano}-${mes}-01T00:00:00`).toISOString();
      const proximoMes = this._filtrosRelatorio.mes == 12 ? 1 : Number(this._filtrosRelatorio.mes) + 1;
      const anoProx = this._filtrosRelatorio.mes == 12 ? Number(ano) + 1 : Number(ano);
      const mesProx = String(proximoMes).padStart(2, '0');
      const dataFim = new Date(`${anoProx}-${mesProx}-01T00:00:00`);
      dataFim.setDate(dataFim.getDate() - 1);
      dataFim.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        limit: 500,
        data_inicio: dataInicio,
        data_fim: dataFim.toISOString(),
        user_id: this._filtrosRelatorio.professor_id,
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
    if (!this._filtrosRelatorio.professor_id) {
      Utils.toast('Selecione um professor antes de imprimir.', 'warning');
      return;
    }

    const ano = this._filtrosRelatorio.ano;
    const mesLabel = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][this._filtrosRelatorio.mes - 1];

    const dados  = await this._buscarRelatorio();
    const pontos = dados?.pontos || [];

    // Recarrega ausências do mês para o impresso
    await this._carregarAusencias(this._filtrosRelatorio.professor_id, this._filtrosRelatorio.mes, this._filtrosRelatorio.ano);

    const agrupado = this._agruparPorProfDia(pontos);
    const profObj  = DB.getUsers().find(u => u.id === this._filtrosRelatorio.professor_id);
    const profNome = profObj?.name || 'Professor';
    if (!agrupado[profNome]) agrupado[profNome] = {};

    // Dados da escola
    const user   = Auth.current();
    const school = user?.schoolId ? DB.getSchool(user.schoolId) : null;
    const escolaNome = Utils.escape(school?.name || 'Escola');
    const escolaDoc  = school?.cnpj ? `CNPJ/CPF: ${Utils.escape(school.cnpj)}` : '';
    const logoUrl    = school?.logoUrl || '';

    // Gera todos os dias do mês para o impresso
    const mesNumImp = parseInt(this._filtrosRelatorio.mes, 10);
    const anoNumImp = parseInt(this._filtrosRelatorio.ano, 10);
    const ultimoDiaImp = new Date(anoNumImp, mesNumImp, 0).getDate();
    const hojeImp = new Date(); hojeImp.setHours(23,59,59,999);

    // Bloco por professor (apenas o selecionado)
    const blocosHtml = Object.entries(agrupado).map(([prof, dias]) => {
      let saldoMes = 0;
      let totalTrab = 0;

      // Preenche TODOS os dias do mês
      const todosOsDias = {};
      for (let d = 1; d <= ultimoDiaImp; d++) {
        const ymd = `${anoNumImp}-${String(mesNumImp).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        todosOsDias[ymd] = dias[ymd] || [];
      }

      const linhas = Object.entries(todosOsDias).sort(([a], [b]) => a.localeCompare(b)).map(([dia, pts]) => {
        const dataObj   = new Date(dia + 'T12:00:00');
        const diaSemana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dataObj.getDay()];
        const ehUtil    = this._ehDiaUtil(dia);
        const futuro    = dataObj > hojeImp;
        const ausencia  = this._ausenciasCache.find(a => a.data === dia);

        // Tem pontos
        if (pts.length > 0) {
          const get = (tipo) => pts.find(x => x.tipo === tipo);
          const fmt = (p) => p ? new Date(p.timestamp).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—';
          const min   = this._minutosTrabalhados(pts);
          const saldo = (min !== null) ? (ehUtil ? min - this.CARGA_HORARIA_DIARIA : min) : null;
          if (min !== null)   totalTrab += min;
          if (saldo !== null) saldoMes  += saldo;
          const corSaldo  = this._saldoCor(saldo);
          const sinal     = saldo !== null && saldo > 0 ? '+' : '';
          return `<tr>
            <td>${dataObj.toLocaleDateString('pt-BR')} <span style="color:#999;font-size:10px;">${diaSemana}</span></td>
            <td style="color:#4CAF50;">${fmt(get('ENTRADA'))}</td>
            <td style="color:#FF9800;">${fmt(get('INTERVALO_INICIO'))}</td>
            <td style="color:#2196F3;">${fmt(get('INTERVALO_FIM'))}</td>
            <td style="color:#F44336;">${fmt(get('SAIDA'))}</td>
            <td style="font-weight:bold;">${this._formatHoras(min)}</td>
            <td style="color:${corSaldo};font-weight:bold;">${saldo !== null ? sinal + this._formatHoras(saldo) : '—'}</td>
          </tr>`;
        }

        // Ausência registrada
        if (ausencia) {
          const meta = this.TIPO_AUSENCIA[ausencia.tipo] || { label: ausencia.tipo, cor:'#666' };
          let saldoDia = 0;
          if (ehUtil) {
            if (meta.desconto === true) saldoDia = -this.CARGA_HORARIA_DIARIA;
            else if (meta.desconto === 'parcial') saldoDia = -(this.CARGA_HORARIA_DIARIA - parseFloat(ausencia.horas_abonadas||0)*60);
          }
          saldoMes += saldoDia;
          const sinalA = saldoDia > 0 ? '+' : '';
          return `<tr style="background:${meta.cor}11;">
            <td>${dataObj.toLocaleDateString('pt-BR')} <span style="color:#999;font-size:10px;">${diaSemana}</span></td>
            <td colspan="4" style="text-align:center;color:${meta.cor};font-weight:bold;">${meta.label}${ausencia.periodo!=='integral'?` (${ausencia.periodo==='manha'?'Manhã':'Tarde'})`:''}</td>
            <td>0h00</td>
            <td style="color:${this._saldoCor(saldoDia)};font-weight:bold;">${saldoDia===0?'0h00':sinalA+this._formatHoras(saldoDia)}</td>
          </tr>`;
        }

        // Sem registro
        let saldoDia = 0;
        let centro = '<span style="color:#999;">—</span>';
        let bg = '';
        if (!futuro && ehUtil) {
          saldoDia = -this.CARGA_HORARIA_DIARIA;
          saldoMes += saldoDia;
          centro = '<span style="color:#C62828;font-weight:bold;">Sem registro</span>';
          bg = 'background:#FFEBEE;';
        }
        const sinalS = saldoDia > 0 ? '+' : '';
        return `<tr style="${bg}">
          <td>${dataObj.toLocaleDateString('pt-BR')} <span style="color:#999;font-size:10px;">${diaSemana}</span></td>
          <td colspan="4" style="text-align:center;">${centro}</td>
          <td style="color:#999;">0h00</td>
          <td style="color:${this._saldoCor(saldoDia)};font-weight:bold;">${saldoDia===0?(futuro||!ehUtil?'—':'0h00'):sinalS+this._formatHoras(saldoDia)}</td>
        </tr>`;
      }).join('');

      const corSaldoMes = this._saldoCor(saldoMes);
      const sinalMes    = saldoMes > 0 ? '+' : '';

      return `
        <div class="page-prof">
          <div class="header">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ''}
            <div class="info">
              <h1>${escolaNome}</h1>
              ${escolaDoc ? `<div class="doc">${escolaDoc}</div>` : ''}
              <div class="periodo">Relatório de Ponto Docente — ${mesLabel}/${ano}</div>
            </div>
          </div>
          <div class="prof-name">${Utils.escape(prof)}</div>
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
          <div class="assinatura">
            <div class="assinatura-linha"></div>
            <div class="assinatura-label">${Utils.escape(prof)}</div>
          </div>
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
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; color: #222; }
          .page-prof {
            page-break-after: always;
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 0;
          }
          .page-prof:last-child { page-break-after: auto; }
          .header { display:flex; align-items:center; gap:10px; border-bottom:2px solid #2196F3; padding-bottom:6px; margin-bottom:4px; flex-shrink:0; }
          .header img { max-height:45px; max-width:60px; object-fit:contain; }
          .header .info { flex:1; }
          .header h1 { margin:0; font-size:15px; color:#333; }
          .header .doc { font-size:10px; color:#666; margin-top:1px; }
          .header .periodo { font-size:11px; color:#2196F3; font-weight:bold; margin-top:2px; }
          .prof-name {
            background:#f0f7ff; padding:5px 10px; border-left:4px solid #2196F3;
            margin-bottom:4px; font-size:13px; font-weight:bold; flex-shrink:0;
          }
          table { width: 100%; border-collapse: collapse; font-size: 10px; flex:1; }
          th, td { border: 1px solid #ddd; padding: 2px 4px; text-align: left; }
          th { background-color: #2196F3; color: white; font-weight: bold; font-size:10px; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          tfoot td { background:#fafafa; }
          .assinatura {
            flex-shrink: 0;
            margin-top: 10px;
            padding-top: 4px;
            text-align: center;
          }
          .assinatura-linha {
            width: 300px;
            margin: 0 auto;
            border-top: 1px solid #333;
          }
          .assinatura-label {
            font-size: 11px;
            color: #333;
            margin-top: 2px;
          }
        </style>
      </head>
      <body>
        ${blocosHtml}
      </body>
      </html>
    `;

    const win = window.open('', '', 'width=1100,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 350);
  },

  // ─── MODAL DE AUSÊNCIA ─────────────────────────────────────────────────────

  abrirModalAusencia(userId, data) {
    const reg = this._ausenciasCache.find(a => a.data === data);
    const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
    const tiposOpts = Object.entries(this.TIPO_AUSENCIA).map(([k, v]) =>
      `<option value="${k}" ${reg && reg.tipo === k ? 'selected' : ''}>${v.label}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'modal-ausencia';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;width:440px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.2);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h3 style="margin:0;font-size:16px;"><i class="fa-solid fa-calendar-xmark" style="color:#FF9800;"></i> ${reg ? 'Editar' : 'Registrar'} Ausência</h3>
          <button onclick="document.getElementById('modal-ausencia').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#999;">✕</button>
        </div>
        <div style="font-size:13px;color:#666;margin-bottom:16px;">
          <strong>Data:</strong> ${dataFmt}
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Tipo de Ausência *</label>
          <select id="aus-tipo" class="form-control" style="width:100%;" onchange="AdminPonto._onTipoAusenciaChange()">
            ${tiposOpts}
          </select>
        </div>
        <div id="aus-periodo-wrap" style="margin-bottom:14px;${(!reg || reg.tipo !== 'DECLARACAO_MEDICA') ? 'display:none;' : ''}">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Período</label>
          <select id="aus-periodo" class="form-control" style="width:100%;">
            <option value="integral" ${reg && reg.periodo === 'integral' ? 'selected' : ''}>Integral (dia todo)</option>
            <option value="manha" ${reg && reg.periodo === 'manha' ? 'selected' : ''}>Manhã</option>
            <option value="tarde" ${reg && reg.periodo === 'tarde' ? 'selected' : ''}>Tarde</option>
          </select>
        </div>
        <div id="aus-horas-wrap" style="margin-bottom:14px;${(!reg || reg.tipo !== 'DECLARACAO_MEDICA') ? 'display:none;' : ''}">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Horas Abonadas (ex: 4.00)</label>
          <input type="number" id="aus-horas" class="form-control" style="width:100%;" step="0.5" min="0" max="12" value="${reg ? reg.horas_abonadas || 0 : 0}" />
        </div>
        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Observação</label>
          <textarea id="aus-obs" class="form-control" style="width:100%;min-height:60px;" maxlength="500" placeholder="Ex: CID informado, documento apresentado...">${reg ? (reg.observacao || '') : ''}</textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="btn btn-outline" onclick="document.getElementById('modal-ausencia').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="AdminPonto._salvarAusencia('${userId}','${data}')">
            <i class="fa-solid fa-check"></i> Salvar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this._onTipoAusenciaChange();
  },

  _onTipoAusenciaChange() {
    const tipo = document.getElementById('aus-tipo')?.value;
    const periodoWrap = document.getElementById('aus-periodo-wrap');
    const horasWrap   = document.getElementById('aus-horas-wrap');
    if (periodoWrap) periodoWrap.style.display = tipo === 'DECLARACAO_MEDICA' ? '' : 'none';
    if (horasWrap)   horasWrap.style.display   = tipo === 'DECLARACAO_MEDICA' ? '' : 'none';
  },

  async _salvarAusencia(userId, data) {
    const tipo    = document.getElementById('aus-tipo')?.value;
    const periodo = document.getElementById('aus-periodo')?.value || 'integral';
    const horas   = parseFloat(document.getElementById('aus-horas')?.value) || 0;
    const obs     = document.getElementById('aus-obs')?.value || '';

    if (!tipo) { Utils.toast('Selecione o tipo de ausência.', 'warning'); return; }

    const payload = {
      user_id: userId,
      data,
      tipo,
      periodo: tipo === 'DECLARACAO_MEDICA' ? periodo : 'integral',
      horas_abonadas: tipo === 'DECLARACAO_MEDICA' ? horas : 0,
      observacao: obs,
    };
    console.log('[Ausencia] Tentando salvar:', payload);

    const token = await this._getToken();
    if (!token) {
      console.error('[Ausencia] Sem token disponível!');
      return Utils.toast('Sessão expirada. Faça login novamente.', 'error');
    }
    console.log('[Ausencia] Token obtido, enviando POST...');

    try {
      const resp = await fetch('/api/ausencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      console.log('[Ausencia] Resposta status:', resp.status, resp.statusText);

      const text = await resp.text();
      console.log('[Ausencia] Resposta body:', text);

      let json;
      try { json = JSON.parse(text); } catch { json = { message: text }; }

      if (!resp.ok) {
        const msg = json.message || `HTTP ${resp.status}`;
        console.error('[Ausencia] FALHA:', msg);
        Utils.toast('Erro ao salvar: ' + msg, 'error');
        return;
      }

      console.log('[Ausencia] Sucesso:', json);
      document.getElementById('modal-ausencia')?.remove();
      Utils.toast('Ausência registrada com sucesso!', 'success');
      await this._recarregar();
    } catch (e) {
      console.error('[AdminPonto] salvarAusencia:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  async _excluirAusencia(id) {
    if (!confirm('Remover este registro de ausência?')) return;

    const token = await this._getToken();
    if (!token) return Utils.toast('Sessão expirada.', 'error');

    try {
      const resp = await fetch(`/api/ausencias?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const json = await resp.json();
        Utils.toast(json.message || 'Erro ao remover ausência.', 'error');
        return;
      }
      Utils.toast('Ausência removida.', 'success');
      await this._recarregar();
    } catch (e) {
      console.error('[AdminPonto] excluirAusencia:', e);
      Utils.toast('Erro de conexão.', 'error');
    }
  },

  async _getToken() {
    try {
      let { data } = await supabaseClient.auth.getSession();
      const expiresAt = data?.session?.expires_at; // epoch seconds
      const expirado  = !expiresAt || expiresAt < (Date.now() / 1000) + 30;
      if (!data?.session?.access_token || expirado) {
        const refresh = await supabaseClient.auth.refreshSession();
        data = refresh.data;
      }
      return data?.session?.access_token || null;
    } catch (e) {
      console.error('[AdminPonto] getToken erro:', e);
      return null;
    }
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
