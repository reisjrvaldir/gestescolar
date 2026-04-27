// =============================================
//  GESTESCOLAR – PAINEL FINANCEIRO
// =============================================

// ---------- DASHBOARD ----------
const FinDashboard = {
  _month: new Date().getMonth(),
  _year:  new Date().getFullYear(),

  applyMonth() {
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const month = this._month;
    const year  = this._year;
    const mm    = String(month + 1).padStart(2, '0');
    const ult   = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${mm}-01`;
    const dateTo   = `${year}-${mm}-${String(ult).padStart(2,'0')}`;
    const lbl = document.getElementById('fin-periodo-label');
    if (lbl) lbl.textContent = `${nomes[month]} ${year}`;
    this._renderCards(dateFrom, dateTo);
  },

  changeMonthStep(delta) {
    let m = this._month + delta;
    let y = this._year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    this._month = m;
    this._year  = y;
    this.applyMonth();
  },

  changeMonth(delta) { this.changeMonthStep(delta); },
  changeYear(delta)  { this._year += delta; this.applyMonth(); },

  _renderCards(dateFrom, dateTo) {
    const invoices = DB.getInvoices();
    const expenses = DB.getExpenses();
    // IDs de alunos ativos — invoices de inativos não entram na contabilidade
    const alunosAtivosIds = new Set(DB.getStudents().filter(s => s.status === 'ativo').map(s => s.id));

    // Apenas invoices de alunos ativos no período
    const invPeriodo  = invoices.filter(i =>
      i.dueDate >= dateFrom && i.dueDate <= dateTo &&
      (!i.studentId || alunosAtivosIds.has(i.studentId))
    );

    // Previsão = soma de todas as invoices do período (mensalidades + avulsas) de alunos ativos
    const previsao = invPeriodo.reduce((t,i) => t + (i.amount||0), 0);

    // Recebido = soma das invoices pagas no período
    const invPagas  = invPeriodo.filter(i => i.status === 'pago');
    const recebido  = invPagas.reduce((t,i) => t + (i.amount||0), 0);
    const nPago     = invPagas.length;

    const nPend     = invPeriodo.filter(i => i.status === 'pendente').length;
    const dueSoon   = invPeriodo.filter(i => i.status === 'pendente' && Utils.isDueSoon(i.dueDate));
    FinDashboard._dueSoonCache = dueSoon;

    // Despesas do período (todas — pendentes e pagas para refletir a realidade)
    const expPeriodo = expenses.filter(e => e.dueDate >= dateFrom && e.dueDate <= dateTo);
    const totalDesp  = expPeriodo.reduce((t,e) => t + (e.amount||0), 0);

    // Situação baseada no mês selecionado
    const percentual = previsao > 0 ? Math.round((recebido / previsao) * 100) : 0;
    const verde      = percentual >= 80;
    const amarelo    = !verde && percentual >= 50;

    // Aviso vencendo
    const alertHtml = dueSoon.length
      ? `<div class="alert alert-warning" style="margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
           <span><i class="fa-solid fa-bell"></i> <strong>${dueSoon.length} boleto(s)</strong> vencendo nos próximos 5 dias!</span>
           <button class="btn btn-sm" onclick="FinDashboard.showDueSoonModal()"
             style="margin-left:auto;background:#1a73e8;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">
             <i class="fa-solid fa-hand-holding-dollar"></i> Ver e cobrar
           </button>
         </div>`
      : '';

    const sit = document.getElementById('fin-situacao');
    if (sit) sit.innerHTML = alertHtml + `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:var(--radius);
        background:${verde?'#e8f5e9':amarelo?'#fff8e1':'#ffebee'};
        border-left:5px solid ${verde?'var(--secondary)':amarelo?'#f9ab00':'var(--danger)'};
        box-shadow:var(--shadow);">
        <span style="font-size:22px;">${verde?'🟢':amarelo?'🟡':'🔴'}</span>
        <div>
          <strong style="font-size:15px;color:${verde?'#2e7d32':amarelo?'#7a5f00':'#b71c1c'};">
            ${verde?'SITUAÇÃO: NO VERDE ✅':amarelo?'SITUAÇÃO: ATENÇÃO ⚠️':'SITUAÇÃO: NO VERMELHO ❌'}
          </strong>
          <div style="font-size:13px;color:${verde?'#388e3c':amarelo?'#b06000':'var(--danger)'};">
            ${percentual}% recebido do previsto no mês atual —
            ${verde?'Excelente!':amarelo?'Atenção: entre 50% e 80%.':'Abaixo de 50%. Tome providências!'}
          </div>
        </div>
        <div style="margin-left:auto;background:rgba(0,0,0,.06);border-radius:20px;height:10px;width:140px;overflow:hidden;flex-shrink:0;">
          <div style="height:100%;width:${percentual}%;background:${verde?'var(--secondary)':amarelo?'#f9ab00':'var(--danger)'};border-radius:20px;transition:width .4s;"></div>
        </div>
      </div>`;

    const cards = document.getElementById('fin-cards');
    if (cards) cards.innerHTML = `
      <div class="fin-card" style="border-top:4px solid #1a73e8;cursor:pointer;" onclick="FinDashboard._renderTransactions()">
        <div class="fin-card-label">Previsão</div>
        <div class="fin-card-value" style="color:#1a73e8;">${Utils.currency(previsao)}</div>
        <div class="fin-card-sub">${invPeriodo.length} cobranças no período</div>
      </div>
      <div class="fin-card" style="border-top:4px solid var(--secondary);cursor:pointer;" onclick="FinDashboard._renderTransactions()">
        <div class="fin-card-label">Recebido</div>
        <div class="fin-card-value" style="color:var(--secondary);">${Utils.currency(recebido)}</div>
        <div class="fin-card-sub">${nPago} pagamento(s)</div>
      </div>
      <div class="fin-card" style="border-top:4px solid var(--danger);">
        <div class="fin-card-label">Despesas do período</div>
        <div class="fin-card-value" style="color:var(--danger);">${Utils.currency(totalDesp)}</div>
        <div class="fin-card-sub">${expPeriodo.length} conta(s) no período</div>
      </div>`;
  },

  _renderTransactions() {
    const wrap = document.getElementById('fin-transactions');
    if (!wrap) return;
    const balance = DB.getBalance();
    const perPage = 10;
    const sorted  = (balance.transactions || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    const total   = sorted.length;
    const pages   = Math.max(1, Math.ceil(total / perPage));
    this._txPage  = Math.min(Math.max(1, this._txPage || 1), pages);
    const start   = (this._txPage - 1) * perPage;
    const slice   = sorted.slice(start, start + perPage);
    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor Líquido</th></tr></thead>
        <tbody>
          ${total === 0
            ? `<tr><td colspan="4"><div class="empty-state" style="padding:20px 0;"><p>Nenhuma transação registrada.</p></div></td></tr>`
            : slice.map(t=>`<tr>
                <td>${Utils.datetime(t.date)}</td>
                <td>${Utils.escape(t.description)}</td>
                <td>${t.type==='credit'?'<span class="badge badge-green">Crédito</span>':'<span class="badge badge-red">Débito</span>'}</td>
                <td style="font-weight:700;color:${t.netAmount>=0?'var(--secondary)':'var(--danger)'};">${Utils.currency(t.netAmount)}</td>
              </tr>`).join('')}
        </tbody>
      </table></div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 0;">
        <button class="btn btn-outline btn-sm" onclick="FinDashboard._txPage-=1;FinDashboard._renderTransactions();" ${this._txPage<=1?'disabled':''}>
          <i class="fa-solid fa-chevron-left"></i> Anterior
        </button>
        <span style="font-size:13px;color:var(--text-muted);">${total===0?'':('Página '+this._txPage+' de '+pages+' — '+total+' registro(s)')}</span>
        <button class="btn btn-outline btn-sm" onclick="FinDashboard._txPage+=1;FinDashboard._renderTransactions();" ${this._txPage>=pages?'disabled':''}>
          Próxima <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>`;
  },

  buildChart(fromYYYYMM) {
    const invoices   = DB.getInvoices();
    const expenses   = DB.getExpenses();
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const [fy, fm]   = fromYYYYMM.split('-').map(Number);
    const monthData  = [];

    for (let i = 0; i < 5; i++) {
      const d    = new Date(fy, fm - 1 + i, 1);
      const yyyy = d.getFullYear();
      const mm   = String(d.getMonth() + 1).padStart(2, '0');
      const key  = `${yyyy}-${mm}`;
      const rec  = invoices
        .filter(inv => inv.status === 'pago' && inv.dueDate && inv.dueDate.startsWith(key))
        .reduce((t, inv) => t + inv.amount, 0);
      const desp = expenses
        .filter(e => e.dueDate && e.dueDate.startsWith(key))
        .reduce((t, e) => t + e.amount, 0);
      monthData.push({ label: `${monthNames[d.getMonth()]}/${String(yyyy).slice(2)}`, rec, desp });
    }

    const maxVal = Math.max(...monthData.map(m => Math.max(m.rec, m.desp)), 1);
    const barH   = v => Math.max(4, Math.round((v / maxVal) * 140));

    return `
      <div class="month-chart">
        ${monthData.map(m => `
          <div class="month-col">
            <div class="month-bars-wrap">
              <div class="bar-pair">
                <div class="month-bar bar-rec"  style="height:${barH(m.rec)}px"  title="Recebido: ${Utils.currency(m.rec)}"></div>
                <div class="month-bar bar-desp" style="height:${barH(m.desp)}px" title="Despesas: ${Utils.currency(m.desp)}"></div>
              </div>
            </div>
            <div class="month-label">${m.label}</div>
            <div class="month-vals">
              <span class="mv-rec">${Utils.currency(m.rec)}</span>
              <span class="mv-desp">${Utils.currency(m.desp)}</span>
            </div>
          </div>`).join('')}
      </div>
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:var(--secondary)"></span> Recebido</span>
        <span><span class="legend-dot" style="background:var(--danger)"></span> Despesas</span>
      </div>`;
  },
  _chartMonth: new Date().getMonth(),
  _chartYear:  new Date().getFullYear(),

  changeChartMonth(delta) {
    const now = new Date();
    let m = this._chartMonth + delta;
    let y = this._chartYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    // não permite futuro
    if (y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())) return;
    this._chartMonth = m;
    this._chartYear  = y;
    this._updateChart();
  },

  _updateChart() {
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mm  = String(this._chartMonth + 1).padStart(2,'0');
    const key = `${this._chartYear}-${mm}`;
    const lbl = document.getElementById('chart-period-label');
    if (lbl) lbl.textContent = `A partir de ${nomes[this._chartMonth]} ${this._chartYear}`;
    const area = document.getElementById('chart-area');
    if (area) area.innerHTML = this.buildChart(key);
  },

  _dueSoonCache: [],

  showDueSoonModal() {
    const dueSoon = this._dueSoonCache;
    if (!dueSoon || dueSoon.length === 0) { Utils.toast('Nenhum boleto vencendo em breve.', 'info'); return; }
    const rows = dueSoon.map(inv => `
      <tr>
        <td><strong>${Utils.escape(inv.studentName || '–')}</strong></td>
        <td>${Utils.currency(inv.amount)}</td>
        <td>${Utils.date(inv.dueDate)}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-sm" onclick="FinEntradas.sendPix('${inv.studentId}','${inv.id}');this.closest('.modal-overlay').remove();"
              style="background:#1a73e8;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;">
              <i class="fa-solid fa-paper-plane"></i> PIX
            </button>
            <button class="btn btn-sm" onclick="FinEntradas.markPaidHist('${inv.id}');this.closest('.modal-overlay').remove();"
              style="background:var(--secondary);color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;">
              <i class="fa-solid fa-money-bill-wave"></i> Espécie
            </button>
          </div>
        </td>
      </tr>`).join('');
    Utils.modal(`<i class="fa-solid fa-bell" style="color:var(--warning);"></i> Boletos Vencendo em Breve (${dueSoon.length})`,
      `<div class="table-wrap" style="max-height:420px;overflow-y:auto;">
        <table>
          <thead><tr><th>Aluno</th><th>Valor</th><th>Vencimento</th><th>Ação</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" onclick="Router.go('fin-entradas');this.closest('.modal-overlay').remove();">
         <i class="fa-solid fa-arrow-right"></i> Ir para Entradas
       </button>`
    );
  },

  _txPage: 1,

  changeTxPage(delta) {
    this._txPage += delta;
    this._renderTransactions();
  }
};

Router.register('fin-dashboard', async () => {
  const user = Auth.require(); if (!user) return;

  // Sincroniza com o Supabase para pegar pagamentos confirmados pelo webhook
  await DB.refreshInvoices?.();

  const now    = new Date();
  const defVal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  FinDashboard._month = now.getMonth();
  FinDashboard._year  = now.getFullYear();

  Router.renderLayout(user, 'fin-dashboard', `
    <h2 style="margin-bottom:16px;">Painel Financeiro</h2>

    <!-- FILTRO DE PERÍODO (centralizado) -->
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" onclick="FinDashboard.changeMonthStep(-1)"><i class="fa-solid fa-chevron-left"></i></button>
      <span id="fin-periodo-label" style="font-size:18px;font-weight:700;min-width:180px;text-align:center;"></span>
      <button class="btn btn-outline btn-sm" onclick="FinDashboard.changeMonthStep(1)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>

    <!-- SITUAÇÃO -->
    <div id="fin-situacao" style="margin-bottom:16px;"></div>

    <!-- CARDS -->
    <div id="fin-cards" class="financial-summary fin-cards-3"></div>

    <!-- GRÁFICO -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-chart-bar"></i> Evolução Mensal</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 0 4px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="FinDashboard.changeChartMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
        <span id="chart-period-label" style="font-size:16px;font-weight:700;min-width:180px;text-align:center;"></span>
        <button class="btn btn-outline btn-sm" onclick="FinDashboard.changeChartMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div id="chart-area">${FinDashboard.buildChart(defVal)}</div>
    </div>

    <!-- TRANSAÇÕES -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header"><span class="card-title">Últimas Transações</span></div>
      <div id="fin-transactions"></div>
    </div>
  `);

  FinDashboard.applyMonth();
  FinDashboard._updateChart();
  FinDashboard._renderTransactions();
});

// ---------- BOLETOS ----------
Router.register('fin-invoices', async () => {
  const user = Auth.require(); if (!user) return;

  // Sincroniza com o Supabase para pegar pagamentos confirmados pelo webhook
  await DB.refreshInvoices?.();

  const render = (filter='todos') => {
    let list = DB.getInvoices();
    if (filter !== 'todos') list = list.filter(i => i.status === filter);
    list = list.sort((a,b) => a.dueDate.localeCompare(b.dueDate));

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-file-invoice"></i> Boletos</span>
          <button class="btn btn-primary btn-sm" onclick="FinInvoices.generate()">
            <i class="fa-solid fa-plus"></i> Gerar Boleto
          </button>
        </div>
        <div class="tabs">
          ${['todos','pendente','pago','vencido'].map(f=>`
            <button class="tab-btn ${filter===f?'active':''}" onclick="window._renderInv('${f}')">
              ${f==='todos'?'Todos':f==='pendente'?'Pendentes':f==='pago'?'Pagos':'Vencidos'}
            </button>`).join('')}
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Aluno</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${list.length===0?`<tr><td colspan="6"><div class="empty-state"><i class="fa-solid fa-file-invoice"></i><p>Nenhum boleto</p></div></td></tr>`:
              list.map(inv=>{
                const soon = inv.status==='pendente' && Utils.isDueSoon(inv.dueDate);
                const over = inv.status==='pendente' && Utils.isOverdue(inv.dueDate);
                const st   = over?'vencido':inv.status;
                return `<tr ${soon?'style="background:#fffde7"':''}>
                  <td><strong>${Utils.escape(inv.studentName)}</strong></td>
                  <td>${Utils.escape(inv.description)} ${soon?'<span class="badge badge-yellow">Vence em breve</span>':''}</td>
                  <td><strong>${Utils.currency(inv.amount)}</strong></td>
                  <td>${Utils.date(inv.dueDate)}</td>
                  <td>${Utils.statusBadge(st)}</td>
                  <td>
                    ${inv.status==='pendente'?`
                      <button class="btn btn-primary btn-sm" onclick="FinInvoices.generatePix('${inv.id}')" title="Gerar PIX"><i class="fa-solid fa-qrcode"></i> PIX</button>
                      <button class="btn btn-secondary btn-sm" onclick="FinInvoices.markPaid('${inv.id}')"><i class="fa-solid fa-check"></i> Pago</button>
                      <button class="btn btn-outline btn-sm" onclick="FinInvoices.sendReminder('${inv.id}')"><i class="fa-solid fa-paper-plane"></i></button>`
                    :inv.status==='pago'?`<span class="text-muted">Pago em ${Utils.date(inv.paidAt)}</span>`
                    :`<span class="text-muted">${st}</span>`}
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table></div>
      </div>`;
  };
  window._renderInv = f => { document.getElementById('page-content').innerHTML = render(f); };
  Router.renderLayout(user, 'fin-invoices', render());

  // Realtime: atualiza automaticamente ao receber pagamento confirmado
  if (user.schoolId) {
    Realtime.subscribe('invoices', `school_id=eq.${user.schoolId}`, async (payload) => {
      await DB.refreshInvoices?.();
      const pc = document.getElementById('page-content');
      if (pc) pc.innerHTML = render();
      if (payload.eventType === 'UPDATE' && payload.new?.status === 'pago') {
        Utils.toast('Pagamento confirmado!', 'success');
      }
    });
  }
});

const FinInvoices = {
  generate() {
    const students = DB.getStudents().filter(s=>s.status==='ativo');
    Utils.modal('Gerar Boleto', `
      <div class="form-group"><label class="form-label">Aluno *</label>
        <select class="form-control" id="invStudent">
          <option value="">Selecione</option>
          ${students.map(s=>`<option value="${s.id}" data-fee="${s.monthlyFee}" data-due="${s.dueDay}">${Utils.escape(s.name)}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Descrição *</label>
        <input class="form-control" id="invDesc" placeholder="Ex: Mensalidade Maio/2026" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Valor (R$) *</label>
          <input type="number" class="form-control" id="invAmount" min="0" step="0.01" /></div>
        <div class="form-group"><label class="form-label">Vencimento *</label>
          <input type="date" class="form-control" id="invDue" /></div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="FinInvoices.save()">Gerar</button>`
    );
    document.getElementById('invStudent').addEventListener('change', function() {
      const o = this.options[this.selectedIndex];
      document.getElementById('invAmount').value = o.dataset.fee||'';
      if (o.dataset.due) {
        const d = new Date(); d.setDate(parseInt(o.dataset.due));
        document.getElementById('invDue').value = d.toISOString().split('T')[0];
      }
    });
  },
  save() {
    const sId = document.getElementById('invStudent').value;
    const s   = DB.getStudents().find(s=>s.id===sId);
    if (!s) { Utils.toast('Selecione um aluno.','error'); return; }
    DB.addInvoice({ studentId:s.id, studentName:s.name, description:document.getElementById('invDesc').value, amount:parseFloat(document.getElementById('invAmount').value), dueDate:document.getElementById('invDue').value });
    Utils.toast('Boleto gerado!','success');
    document.querySelector('.modal-overlay')?.remove();
    window._renderInv?.('todos');
  },
  markPaid(id) {
    FinEntradas.markPaidHist(id);
  },
  sendReminder(id) {
    const inv = DB.getInvoices().find(i=>i.id===id);
    Utils.toast(`Lembrete enviado para ${inv?.studentName}!`,'info');
  },

  async generatePix(invoiceId) {
    const inv = DB.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;

    // Se já tem asaas_id, tentar buscar QR code existente
    if (inv.asaasId) {
      Utils.toast('Buscando QR Code...', 'info');
      const qr = await AsaasClient.getPixQrCode(inv.asaasId);
      if (qr && qr.payload) {
        this._showPixModal(inv, qr.payload, qr.encodedImage, inv.asaasId);
        return;
      }
      // QR existente inválido — limpa e regenera
      DB.updateInvoice(invoiceId, { asaasId: null });
    }

    const student = DB.getStudents().find(s => s.id === inv.studentId);
    if (!student) { Utils.toast('Aluno não encontrado.', 'error'); return; }

    const school = DB.getSchool(DB._schoolId);
    if (!school) { Utils.toast('Escola não encontrada.', 'error'); return; }

    Utils.toast('Gerando cobrança PIX...', 'info');
    const result = await AsaasClient.chargeInvoice(inv, student, school);
    if (!result) return; // erro já exibido pelo chargeInvoice

    this._showPixModal(inv, result.pixCopiaECola, result.pixQrCodeBase64, result.chargeId);
    window._renderInv?.('pendente');
  },

  _showPixModal(inv, copiaECola, qrBase64, chargeId) {
    Utils.modal('Cobrança PIX Gerada',
      `<div style="text-align:center;">
        <div style="margin-bottom:12px;">
          <i class="fa-solid fa-circle-check" style="font-size:36px;color:var(--secondary);"></i>
          <p style="font-weight:700;margin:8px 0 4px;">${Utils.escape(inv.studentName)}</p>
          <p style="font-size:13px;color:var(--text-muted);">${Utils.escape(inv.description)} – <strong>${Utils.currency(inv.amount)}</strong></p>
        </div>
        ${qrBase64 ? `<img src="data:image/png;base64,${qrBase64}" style="width:220px;height:220px;margin:8px auto;display:block;border:2px solid var(--border);border-radius:8px;" />` : ''}
        <div style="margin-top:12px;">
          <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:4px;">PIX Copia e Cola</label>
          <div style="display:flex;gap:6px;">
            <input class="form-control" id="pixCopiaECola" value="${Utils.escape(copiaECola || '')}" readonly style="font-size:11px;font-family:monospace;" />
            <button class="btn btn-outline btn-sm" onclick="Utils.copyText(document.getElementById('pixCopiaECola').value);Utils.toast('Copiado!','success');">
              <i class="fa-solid fa-copy"></i>
            </button>
          </div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);">
          <i class="fa-solid fa-info-circle"></i> Asaas ID: ${Utils.escape(chargeId || '')}
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" onclick="Utils.copyText(document.getElementById('pixCopiaECola').value);Utils.toast('PIX copiado!','success');">
         <i class="fa-solid fa-copy"></i> Copiar PIX
       </button>`
    );
  }
};

// ---------- CONTAS A PAGAR ----------
Router.register('fin-expenses', () => {
  const user = Auth.require(); if (!user) return;

  Router.renderLayout(user, 'fin-expenses', `
    <div style="display:flex;flex-direction:column;gap:20px;">

      <div class="card-header" style="background:#fff;border-radius:var(--radius);padding:16px 20px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:space-between;">
        <span class="card-title"><i class="fa-solid fa-credit-card"></i> Contas a Pagar</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="FinExpenses.exportPDF()">
            <i class="fa-solid fa-file-pdf"></i> Exportar PDF
          </button>
          <button class="btn btn-primary btn-sm" onclick="FinExpenses.openNew()" style="background:#1a73e8;color:#fff;border:none;">
            ADD NOVA CONTA
          </button>
        </div>
      </div>

      <!-- FILTRO DE PERÍODO (centralizado) -->
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-sm" onclick="FinExpenses.changeMonthStep(-1)"><i class="fa-solid fa-chevron-left"></i></button>
        <span id="exp-periodo-label" style="font-size:18px;font-weight:700;min-width:180px;text-align:center;"></span>
        <button class="btn btn-outline btn-sm" onclick="FinExpenses.changeMonthStep(1)"><i class="fa-solid fa-chevron-right"></i></button>
      </div>

      <!-- CARDS -->
      <div id="exp-cards" class="financial-summary" style="grid-template-columns:1fr 1fr 1fr;"></div>

      <!-- CONTEÚDO DAS TABELAS -->
      <div id="exp-content" style="display:flex;flex-direction:column;gap:16px;"></div>

    </div>
  `);

  window._reloadExpenses = () => FinExpenses._reloadCurrent?.();
  FinExpenses.applyMonth();
});

const FinExpenses = {
  _lastFrom: null,
  _lastTo:   null,
  _month: new Date().getMonth(),
  _year:  new Date().getFullYear(),

  applyMonth() {
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const month = this._month;
    const year  = this._year;
    const mm    = String(month + 1).padStart(2, '0');
    const ult   = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${mm}-01`;
    const dateTo   = `${year}-${mm}-${String(ult).padStart(2,'0')}`;
    const lbl = document.getElementById('exp-periodo-label');
    if (lbl) lbl.textContent = `${nomes[month]} ${year}`;
    this._renderByPeriod(dateFrom, dateTo);
  },

  changeMonthStep(delta) {
    let m = this._month + delta;
    let y = this._year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    this._month = m;
    this._year  = y;
    this.applyMonth();
  },

  _reloadCurrent() {
    if (this._lastFrom && this._lastTo) {
      this._renderByPeriod(this._lastFrom, this._lastTo);
    }
  },

  _renderByPeriod(dateFrom, dateTo) {
    this._lastFrom = dateFrom;
    this._lastTo   = dateTo;
    const all       = DB.getExpenses();
    const filtered  = all.filter(e => e.dueDate >= dateFrom && e.dueDate <= dateTo);
    const fixas     = filtered.filter(e => e.tipo === 'fixa');
    const variaveis = filtered.filter(e => e.tipo === 'variavel');
    const pendFixed = fixas.filter(e => e.status === 'pendente').reduce((s,e) => s + e.amount, 0);
    const pendVar   = variaveis.filter(e => e.status === 'pendente').reduce((s,e) => s + e.amount, 0);

    const totalPend = pendFixed + pendVar;
    const nFixed = fixas.filter(e=>e.status==='pendente').length;
    const nVar   = variaveis.filter(e=>e.status==='pendente').length;
    const cardsEl = document.getElementById('exp-cards');
    if (cardsEl) cardsEl.innerHTML = `
      <div class="fin-card" style="border-top:4px solid #1a73e8;">
        <div class="fin-card-label">Fixas Pendentes</div>
        <div class="fin-card-value" style="font-size:20px;">${Utils.currency(pendFixed)}</div>
        <div class="fin-card-sub">${nFixed} conta(s)</div>
      </div>
      <div class="fin-card" style="border-top:4px solid #f9ab00;">
        <div class="fin-card-label">Variáveis Pendentes</div>
        <div class="fin-card-value" style="font-size:20px;">${Utils.currency(pendVar)}</div>
        <div class="fin-card-sub">${nVar} conta(s)</div>
      </div>
      <div class="fin-card" style="border-top:4px solid var(--danger);">
        <div class="fin-card-label">Total Pendente</div>
        <div class="fin-card-value" style="font-size:20px;color:var(--danger);">${Utils.currency(totalPend)}</div>
        <div class="fin-card-sub">${nFixed + nVar} conta(s) no período</div>
      </div>`;

    const contentEl = document.getElementById('exp-content');
    if (contentEl) contentEl.innerHTML = `
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-thumbtack" style="color:#1a73e8;"></i> Contas Fixas</span>
          <span style="font-size:13px;color:var(--text-muted);">${fixas.length} registro(s)</span>
        </div>
        ${FinExpenses._expenseTable(fixas, 'Nenhuma conta fixa no período.')}
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <span class="card-title"><i class="fa-solid fa-shuffle" style="color:#f9ab00;"></i> Contas Variáveis</span>
          <span style="font-size:13px;color:var(--text-muted);">${variaveis.length} registro(s)</span>
        </div>
        ${FinExpenses._expenseTable(variaveis, 'Nenhuma conta variável no período.')}
      </div>`;
  },

  _expenseRow(e) {
    const soon = e.status==='pendente' && Utils.isDueSoon(e.dueDate);
    return `<tr ${soon?'style="background:#fffde7"':''}>
      <td>
        <strong>${Utils.escape(e.description)}</strong>
        ${soon?'<span class="badge badge-red" style="margin-left:4px;">Urgente</span>':''}
      </td>
      <td><strong>${Utils.currency(e.amount)}</strong></td>
      <td>${Utils.date(e.dueDate)}</td>
      <td>${e.parcelado && e.parcelas>1?`${e.parcelaNum||1}/${e.parcelas}`:'–'}</td>
      <td>${Utils.statusBadge(e.status)}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
        ${e.status==='pendente'
          ? `<button class="btn btn-secondary btn-sm" onclick="FinExpenses.markPaid('${e.id}')"><i class="fa-solid fa-check"></i> Pago</button>`
          : `<button class="btn btn-sm" onclick="FinExpenses.undoPaid('${e.id}')"
               style="background:#fff3e0;color:#e65100;border:1.5px solid #ffb74d;font-size:12px;padding:4px 10px;border-radius:6px;cursor:pointer;">
               <i class="fa-solid fa-rotate-left"></i> Desfazer
             </button>`}
        <button class="btn btn-sm" onclick="FinExpenses.openEdit('${e.id}')"
          style="background:#f1f3f4;color:#5f6368;border:1.5px solid var(--border);font-size:12px;padding:4px 8px;border-radius:6px;cursor:pointer;"
          title="Editar conta">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn btn-sm" onclick="FinExpenses.confirmDelete('${e.id}','${Utils.escape(e.description)}')"
          style="background:#ffebee;color:#c62828;border:1.5px solid #ef9a9a;font-size:12px;padding:4px 8px;border-radius:6px;cursor:pointer;"
          title="Excluir conta">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>`;
  },

  _expenseTable(list, emptyMsg) {
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Parcela</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${list.length===0
            ? `<tr><td colspan="6"><div class="empty-state" style="padding:20px 0;"><p>${emptyMsg}</p></div></td></tr>`
            : list.map(e => FinExpenses._expenseRow(e)).join('')}
        </tbody>
      </table></div>`;
  },

  openNew() {
    Utils.modal('Nova Conta a Pagar', `
      <div class="form-group">
        <label class="form-label" style="font-weight:700;">Tipo de Conta *</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
          <button type="button" id="btn-tipo-fixa"
            onclick="FinExpenses.selectTipo('fixa')"
            style="padding:14px;border:2px solid #1a73e8;border-radius:8px;background:#e8f0fe;
                   color:#1a73e8;font-weight:700;font-size:14px;cursor:pointer;">
            <i class="fa-solid fa-thumbtack" style="display:block;font-size:20px;margin-bottom:4px;"></i>
            FIXA
            <div style="font-size:11px;font-weight:400;margin-top:2px;">Luz, água, salário…</div>
          </button>
          <button type="button" id="btn-tipo-variavel"
            onclick="FinExpenses.selectTipo('variavel')"
            style="padding:14px;border:2px solid var(--border);border-radius:8px;background:#fff;
                   color:var(--text-muted);font-weight:700;font-size:14px;cursor:pointer;">
            <i class="fa-solid fa-shuffle" style="display:block;font-size:20px;margin-bottom:4px;"></i>
            VARIÁVEL
            <div style="font-size:11px;font-weight:400;margin-top:2px;">Material, viagens…</div>
          </button>
        </div>
        <input type="hidden" id="expTipo" value="fixa" />
      </div>

      <div class="form-group"><label class="form-label">Descrição *</label>
        <input class="form-control" id="expDesc" placeholder="Ex: Conta de luz – Abril/2026" /></div>

      <div class="form-group"><label class="form-label">Categoria</label>
        <select class="form-control" id="expCat">
          <option value="agua">Água</option>
          <option value="luz">Energia</option>
          <option value="salario">Salário</option>
          <option value="imposto">Imposto</option>
          <option value="outros">Outros</option>
        </select>
      </div>

      <div class="form-group"><label class="form-label">Parcelado?</label>
        <select class="form-control" id="expParcelado" onchange="FinExpenses.toggleParcelas(this.value)">
          <option value="nao">Não</option><option value="sim">Sim</option>
        </select></div>
      <div id="parcelasRow" style="display:none;">
        <div class="form-group"><label class="form-label">Número de parcelas</label>
          <input type="number" class="form-control" id="expParcelas" value="2" min="2" max="60" placeholder="Ex: 5" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Valor total (R$) *</label>
          <input type="number" class="form-control" id="expAmount" min="0" step="0.01" /></div>
        <div class="form-group"><label class="form-label">Data de vencimento *</label>
          <input type="date" class="form-control" id="expDue" /></div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="FinExpenses.save()">Salvar</button>`
    );
  },
  selectTipo(tipo) {
    document.getElementById('expTipo').value = tipo;
    const btnFixa = document.getElementById('btn-tipo-fixa');
    const btnVar  = document.getElementById('btn-tipo-variavel');
    if (tipo === 'fixa') {
      btnFixa.style.border      = '2px solid #1a73e8';
      btnFixa.style.background  = '#e8f0fe';
      btnFixa.style.color       = '#1a73e8';
      btnVar.style.border       = '2px solid var(--border)';
      btnVar.style.background   = '#fff';
      btnVar.style.color        = 'var(--text-muted)';
      document.getElementById('expCat').innerHTML =
        `<option value="agua">Água</option>
         <option value="luz">Energia</option>
         <option value="salario">Salário</option>
         <option value="imposto">Imposto</option>
         <option value="outros">Outros</option>`;
    } else {
      btnVar.style.border       = '2px solid #f59e0b';
      btnVar.style.background   = '#fffbeb';
      btnVar.style.color        = '#b45309';
      btnFixa.style.border      = '2px solid var(--border)';
      btnFixa.style.background  = '#fff';
      btnFixa.style.color       = 'var(--text-muted)';
      document.getElementById('expCat').innerHTML =
        `<option value="material">Material</option>
         <option value="alimentacao">Alimentação</option>
         <option value="transporte">Transporte</option>
         <option value="manutencao">Manutenção</option>
         <option value="outros">Outros</option>`;
    }
  },
  toggleParcelas(val) {
    document.getElementById('parcelasRow').style.display = val==='sim'?'block':'none';
  },
  save() {
    const parcelado = document.getElementById('expParcelado').value === 'sim';
    const parcelas  = parcelado ? parseInt(document.getElementById('expParcelas').value)||1 : 1;
    const total     = parseFloat(String(document.getElementById('expAmount').value).replace(',','.'));
    const desc      = (document.getElementById('expDesc')?.value || '').trim();
    const due       = document.getElementById('expDue')?.value || '';
    const tipo      = document.getElementById('expTipo')?.value || 'fixa';
    const cat       = document.getElementById('expCat')?.value || 'outros';

    if (!desc)  { Utils.toast('Informe a descrição.', 'error'); return; }
    if (!total || isNaN(total) || total <= 0) { Utils.toast('Informe o valor.', 'error'); return; }
    if (!due)   { Utils.toast('Informe a data de vencimento.', 'error'); return; }

    // Não permitir meses anteriores ao mês atual
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
    const mesDue   = due.substring(0,7);
    if (mesDue < mesAtual) { Utils.toast('Não é permitido lançar contas em meses já encerrados.', 'error'); return; }

    const data = { description: desc, tipo, category: cat, parcelado, parcelas, parcelaNum: 1,
      amount: parcelado ? parseFloat((total/parcelas).toFixed(2)) : total, dueDate: due };
    DB.addExpense(data);
    Utils.toast(parcelado ? `Despesa parcelada em ${parcelas}x gerada!` : 'Conta cadastrada!', 'success');
    document.querySelector('.modal-overlay')?.remove();
    this._reloadCurrent();
  },
  markPaid(id) {
    const e = DB.getExpenses().find(e=>e.id===id);
    DB.updateExpense(id, { status:'pago', paidAt:new Date().toISOString() });
    DB.addTransaction('debit', e.amount, e.description);
    Utils.toast('Conta paga! Saldo debitado.','success');
    this._reloadCurrent();
  },

  undoPaid(id) {
    const e = DB.getExpenses().find(e=>e.id===id);
    if (!e || e.status !== 'pago') return;
    DB.updateExpense(id, { status:'pendente', paidAt: null });
    // Estorna o débito adicionando um crédito equivalente
    DB.addTransaction('credit', e.amount, `Estorno – ${e.description}`);
    Utils.toast('Pagamento desfeito. Saldo estornado.', 'success');
    this._reloadCurrent();
  },

  openEdit(id) {
    const e = DB.getExpenses().find(ex=>ex.id===id);
    if (!e) return;
    const cats = {
      fixa:    ['agua','energia','internet','aluguel','salario','manutencao','outros'],
      variavel:['material','alimentacao','transporte','evento','equipamento','outros'],
    };
    const allCats = [...new Set([...cats.fixa,...cats.variavel])];
    Utils.modal('<i class="fa-solid fa-pen"></i> Editar Conta', `
      <div class="form-group"><label class="form-label">Descrição *</label>
        <input class="form-control" id="editExpDesc" value="${Utils.escape(e.description)}" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Valor (R$) *</label>
          <input type="number" class="form-control" id="editExpAmount" value="${e.amount}" min="0" step="0.01" /></div>
        <div class="form-group"><label class="form-label">Vencimento *</label>
          <input type="date" class="form-control" id="editExpDue" value="${e.dueDate}" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Tipo</label>
          <select class="form-control" id="editExpTipo">
            <option value="fixa"    ${e.tipo==='fixa'    ?'selected':''}>Fixa</option>
            <option value="variavel"${e.tipo==='variavel'?'selected':''}>Variável</option>
          </select></div>
        <div class="form-group"><label class="form-label">Categoria</label>
          <select class="form-control" id="editExpCat">
            ${allCats.map(c=>`<option value="${c}" ${e.category===c?'selected':''}>${Utils.expenseCategory(c).label||c}</option>`).join('')}
          </select></div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="FinExpenses.saveEdit('${id}')">Salvar</button>`
    );
  },

  saveEdit(id) {
    const desc   = document.getElementById('editExpDesc').value.trim();
    const amount = parseFloat(document.getElementById('editExpAmount').value);
    const due    = document.getElementById('editExpDue').value;
    if (!desc || !amount || !due) { Utils.toast('Preencha todos os campos.','error'); return; }
    DB.updateExpense(id, {
      description: desc,
      amount,
      dueDate: due,
      tipo:     document.getElementById('editExpTipo').value,
      category: document.getElementById('editExpCat').value,
    });
    Utils.toast('Conta atualizada!','success');
    document.querySelector('.modal-overlay')?.remove();
    this._reloadCurrent();
  },

  confirmDelete(id, desc) {
    const overlay = document.createElement('div');
    overlay.id = 'delete-exp-modal';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:'9999'
    });
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;
                  box-shadow:0 8px 32px rgba(0,0,0,.18);text-align:center;">
        <div style="font-size:44px;margin-bottom:12px;">⚠️</div>
        <h3 style="margin:0 0 10px;font-size:18px;color:#c62828;">Excluir Despesa</h3>
        <p style="color:var(--text-muted);font-size:14px;margin:0 0 20px;">
          Tem certeza que deseja excluir "<strong>${desc}</strong>"?
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button onclick="document.getElementById('delete-exp-modal').remove()"
            style="padding:10px 24px;border:1.5px solid var(--border);border-radius:8px;
                   background:#fff;color:var(--text-muted);font-size:14px;cursor:pointer;font-weight:600;">
            Cancelar
          </button>
          <button onclick="FinExpenses._executeDelete('${id}')"
            style="padding:10px 24px;border:none;border-radius:8px;
                   background:#c62828;color:#fff;font-size:14px;cursor:pointer;font-weight:700;">
            Excluir
          </button>
        </div>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  },

  _executeDelete(id) {
    document.getElementById('delete-exp-modal')?.remove();
    DB.deleteExpense(id);
    Utils.toast('Despesa excluída!', 'success');
    this._reloadCurrent();
  },

  exportPDF() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { Utils.toast('jsPDF não disponível.','error'); return; }
    const doc = new jsPDF();
    const school = DB.getSchoolConfig();
    const expenses = DB.getExpenses().filter(e => e.dueDate >= this._lastFrom && e.dueDate <= this._lastTo)
        .sort((a,b) => a.dueDate.localeCompare(b.dueDate));

    doc.setFontSize(16); doc.setFont(undefined,'bold');
    doc.text('Contas a Pagar', 105, 18, {align:'center'});
    doc.setFontSize(10); doc.setFont(undefined,'normal');
    doc.text(school.name || '', 105, 25, {align:'center'});
    doc.text(`Período: ${Utils.date(this._lastFrom)} a ${Utils.date(this._lastTo)}`, 105, 31, {align:'center'});

    let y = 42;
    doc.setFontSize(9); doc.setFont(undefined,'bold');
    doc.text('Descrição', 14, y); doc.text('Tipo', 90, y); doc.text('Vencimento', 120, y);
    doc.text('Valor', 155, y); doc.text('Status', 175, y);
    doc.line(14, y+2, 196, y+2); y += 8;

    doc.setFont(undefined,'normal');
    expenses.forEach(e => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(Utils.escape(e.description).substring(0,40), 14, y);
        doc.text(e.tipo === 'fixa' ? 'Fixa' : 'Variável', 90, y);
        doc.text(Utils.date(e.dueDate), 120, y);
        doc.text(Utils.currency(e.amount), 155, y);
        doc.text(e.status === 'pago' ? 'Pago' : 'Pendente', 175, y);
        y += 7;
    });

    const total = expenses.reduce((t,e)=>t+e.amount,0);
    y += 3; doc.line(14, y, 196, y); y += 6;
    doc.setFont(undefined,'bold');
    doc.text(`Total: ${Utils.currency(total)}`, 155, y, {align:'right'});

    doc.save(`contas-pagar-${this._lastFrom?.substring(0,7)||'relatorio'}.pdf`);
  }
};

// ---------- ENTRADAS ----------
Router.register('fin-entradas', () => {
  const user = Auth.require(); if (!user) return;
  const cfg  = DB.getSchoolConfig();

  FinEntradas._pixKey     = cfg.pixKey || '';
  FinEntradas._histFilter = 'todos';
  FinEntradas._invPeriodo = null;

  Router.renderLayout(user, 'fin-entradas', `
    <h2 style="margin-bottom:16px;">Entradas</h2>

    <!-- FILTRO DE PERÍODO (centralizado) -->
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" onclick="FinEntradas.changeMonthStep(-1)"><i class="fa-solid fa-chevron-left"></i></button>
      <span id="ent-periodo-label" style="font-size:18px;font-weight:700;min-width:180px;text-align:center;"></span>
      <button class="btn btn-outline btn-sm" onclick="FinEntradas.changeMonthStep(1)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>

    <!-- AÇÕES -->
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="FinEntradas.openNovaCobranca()">
        <i class="fa-solid fa-plus"></i> Nova Cobrança Avulsa (festa, evento, etc.)
      </button>
    </div>

    <!-- CARDS -->
    <div id="ent-cards" class="financial-summary" style="grid-template-columns:repeat(2,1fr);"></div>

    <!-- PENDENTES + HISTÓRICO (renderizado por JS) -->
    <div id="ent-content"></div>
  `);

  FinEntradas.applyMonth();
});

const FinEntradas = {
  _pixKey:     '',
  _all:        [],
  _page:       1,
  _perPage:    10,
  _histFilter: 'todos',
  _invPeriodo: null,
  _avulsaPage: 1,
  _avulsaAll:  [],

  _month: new Date().getMonth(),
  _year:  new Date().getFullYear(),

  applyMonth() {
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const month = this._month;
    const year  = this._year;
    const mm    = String(month + 1).padStart(2, '0');
    const ult   = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${mm}-01`;
    const dateTo   = `${year}-${mm}-${String(ult).padStart(2,'0')}`;
    const lbl = document.getElementById('ent-periodo-label');
    if (lbl) lbl.textContent = `${nomes[month]} ${year}`;
    this._renderByPeriod(dateFrom, dateTo);
  },

  changeMonthStep(delta) {
    let m = this._month + delta;
    let y = this._year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    this._month = m;
    this._year  = y;
    this.applyMonth();
  },

  _renderByPeriod(dateFrom, dateTo) {
    const invoices  = DB.getInvoices();
    const expenses  = DB.getExpenses();
    const students  = DB.getStudents();
    const classes   = DB.getClasses();
    const users     = DB.getUsers();
    const cfg       = DB.getSchoolConfig();

    // Filtra por período (baseado em dueDate)
    const invPeriodo = invoices.filter(i => i.dueDate >= dateFrom && i.dueDate <= dateTo);
    const expPeriodo = expenses.filter(e => e.dueDate >= dateFrom && e.dueDate <= dateTo);

    const totalRecebido = invPeriodo.filter(i => i.status === 'pago').reduce((t,i) => t + i.amount, 0);
    const totalPendente = invPeriodo.filter(i => i.status === 'pendente').reduce((t,i) => t + i.amount, 0);
    const nPago         = invPeriodo.filter(i => i.status === 'pago').length;
    const nPend         = invPeriodo.filter(i => i.status === 'pendente').length;

    // Atualiza cards
    const cardsEl = document.getElementById('ent-cards');
    if (cardsEl) cardsEl.innerHTML = `
      <div class="fin-card" style="border-top:4px solid var(--secondary);">
        <div class="fin-card-label">Total Recebido</div>
        <div class="fin-card-value" style="color:var(--secondary);">${Utils.currency(totalRecebido)}</div>
        <div class="fin-card-sub">${nPago} boleto(s) pago(s)</div>
      </div>
      <div class="fin-card" style="border-top:4px solid var(--warning);">
        <div class="fin-card-label">A Receber</div>
        <div class="fin-card-value" style="color:#b06000;">${Utils.currency(totalPendente)}</div>
        <div class="fin-card-sub">${nPend} pendente(s)</div>
      </div>`;

    // Atualiza pendentes (mensalidades pendentes no período)
    const today = new Date(); today.setHours(0,0,0,0);
    const pendingList = students.filter(s => s.status === 'ativo').flatMap(s => {
      const cls     = classes.find(c => c.id === s.classId);
      const teacher = cls ? users.find(u => u.id === cls.teacherId) : null;
      const resp    = (s.responsaveis || [])[0];
      return invPeriodo
        .filter(i => i.studentId === s.id && i.status === 'pendente' && /mensalidade/i.test(i.description || ''))
        .map(inv => ({ s, inv, cls, teacher, resp }));
    }).sort((a,b) => a.inv.dueDate.localeCompare(b.inv.dueDate));

    this._all    = pendingList;
    this._page   = 1;
    this._pixKey = cfg.pixKey || '';

    // Cobranças avulsas: invoices do período que não são "Mensalidade" e status pendente
    // Some 5 dias após vencer
    const todayTs = new Date(); todayTs.setHours(0,0,0,0);
    const cutoffTs = new Date(todayTs.getTime() - 5*86400000);
    const cutoffStr = cutoffTs.toISOString().slice(0,10);
    const avulsaPending = invPeriodo.filter(i =>
      i.status === 'pendente' &&
      !(i.description || '').toLowerCase().startsWith('mensalidade') &&
      i.dueDate >= cutoffStr
    ).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    this._avulsaAll  = avulsaPending;
    this._avulsaPage = 1;

    const contentEl = document.getElementById('ent-content');
    if (contentEl) {
      const totalInv = invPeriodo.length;
      contentEl.innerHTML = `
        <!-- LAYOUT 50/50: MENSALIDADES | AVULSAS -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;align-items:start;">

          <!-- PAINEL ESQUERDO: MENSALIDADES PENDENTES -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <i class="fa-solid fa-triangle-exclamation" style="color:var(--warning);"></i>
                Mensalidades Pendentes
                <span id="due-count-badge" style="margin-left:8px;background:#e8f0fe;color:#1a73e8;border-radius:20px;padding:2px 10px;font-size:13px;font-weight:700;">
                  ${pendingList.length}
                </span>
              </span>
              <button class="btn btn-sm" onclick="FinEntradas.sendMassPix()"
                style="background:#1a73e8;color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:13px;">
                <i class="fa-solid fa-paper-plane"></i> PIX em massa
              </button>
            </div>
            <div id="due-table-wrap"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 0;">
              <button class="btn btn-outline btn-sm" id="btn-prev-page" onclick="FinEntradas.changePage(-1)">
                <i class="fa-solid fa-chevron-left"></i> Anterior
              </button>
              <span id="page-info" style="font-size:13px;color:var(--text-muted);"></span>
              <button class="btn btn-outline btn-sm" id="btn-next-page" onclick="FinEntradas.changePage(1)">
                Próxima <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>

          <!-- PAINEL DIREITO: COBRANÇAS AVULSAS PENDENTES -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                <i class="fa-solid fa-receipt" style="color:#7b1fa2;"></i>
                Cobranças Avulsas Pendentes
                <span style="margin-left:8px;background:#f3e8ff;color:#7b1fa2;border-radius:20px;padding:2px 10px;font-size:13px;font-weight:700;">
                  ${avulsaPending.length}
                </span>
              </span>
              <button class="btn btn-sm" onclick="FinEntradas.sendMassAvulsa()"
                style="background:#7b1fa2;color:#fff;border:none;padding:6px 14px;border-radius:var(--radius);cursor:pointer;font-size:13px;">
                <i class="fa-solid fa-paper-plane"></i> Enviar para todos
              </button>
            </div>
            <div id="avulsa-table-wrap"></div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0 0;">
              <button class="btn btn-outline btn-sm" id="btn-prev-avulsa" onclick="FinEntradas.changeAvulsaPage(-1)">
                <i class="fa-solid fa-chevron-left"></i> Anterior
              </button>
              <span id="page-info-avulsa" style="font-size:13px;color:var(--text-muted);"></span>
              <button class="btn btn-outline btn-sm" id="btn-next-avulsa" onclick="FinEntradas.changeAvulsaPage(1)">
                Próxima <i class="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- EXPORTAR PDF -->
        <div style="margin-top:12px;text-align:right;">
          <button class="btn btn-outline btn-sm" onclick="FinEntradas.exportPDF()">
            <i class="fa-solid fa-file-pdf"></i> Exportar PDF (${totalInv} registros)
          </button>
        </div>`;

      this._invPeriodo = invPeriodo;
      this.renderTable();
      this.renderAvulsaTable();
    }
  },

  filterHist(filter) {
    this._histFilter = filter;
    // Atualizar abas
    ['todos','pendente','pago','vencido'].forEach(f => {
      const btn = document.getElementById(`hist-tab-${f}`);
      if (btn) btn.classList.toggle('active', f === filter);
    });
    this.renderHist(filter);
  },

  renderHist(filter) {
    const wrap = document.getElementById('hist-table-wrap');
    if (!wrap) return;
    const today     = new Date(); today.setHours(0,0,0,0);
    const students  = DB.getStudents();
    let list        = (this._invPeriodo || DB.getInvoices()).slice().sort((a,b)=>b.dueDate.localeCompare(a.dueDate));

    if (filter === 'pago')       list = list.filter(i => i.status === 'pago');
    else if (filter === 'pendente')  list = list.filter(i => i.status === 'pendente' && !Utils.isOverdue(i.dueDate));
    else if (filter === 'vencido')   list = list.filter(i => i.status === 'pendente' && Utils.isOverdue(i.dueDate));
    else if (filter === 'cancelado') list = list.filter(i => i.status === 'cancelado');

    if (list.length === 0) {
      wrap.innerHTML = `<div class="empty-state" style="padding:32px 0;">
        <i class="fa-solid fa-file-invoice" style="font-size:32px;color:var(--text-muted);"></i>
        <p>Nenhum boleto encontrado.</p>
      </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Aluno</th><th>Descrição</th><th>Valor</th>
          <th>Vencimento</th><th>Status</th><th>Ação</th>
        </tr></thead>
        <tbody>
          ${list.map(inv => {
            const venceu = inv.status === 'pendente' && Utils.isOverdue(inv.dueDate);
            const status = venceu ? 'vencido' : inv.status;
            const rowBg  = venceu ? '#fff8f8' : inv.status === 'pendente' ? '#fffde7' : '';
            let acaoHtml = '';
            if (inv.status === 'pendente') {
              acaoHtml = '<button class="btn btn-sm" onclick="FinEntradas.markPaidHist(\'' + inv.id + '\')" '
                + 'style="background:var(--secondary);color:#fff;border:none;font-size:12px;padding:6px 16px;border-radius:6px;cursor:pointer;font-weight:600;">'
                + '<i class="fa-solid fa-money-bill-wave"></i> Pagar</button>';
            } else if (inv.status === 'pago') {
              acaoHtml = '<span style="font-size:12px;color:var(--secondary);font-weight:600;"><i class="fa-solid fa-check-circle"></i> Pago em ' + Utils.date(inv.paidAt) + '</span>';
            } else if (inv.status === 'cancelado') {
              acaoHtml = '<span style="font-size:12px;color:var(--text-muted);">Cancelado</span>';
            }
            return '<tr style="' + (rowBg ? 'background:'+rowBg : '') + '">'
              + '<td><strong>' + Utils.escape(inv.studentName || '–') + '</strong></td>'
              + '<td>' + Utils.escape(inv.description) + '</td>'
              + '<td><strong>' + Utils.currency(inv.amount) + '</strong></td>'
              + '<td>' + Utils.date(inv.dueDate) + '</td>'
              + '<td>' + Utils.statusBadge(status) + '</td>'
              + '<td>' + acaoHtml + '</td>'
              + '</tr>';
          }).join('')}
        </tbody>
      </table></div>`;
  },

  markPaidHist(invoiceId) {
    const inv = DB.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    const s = DB.getStudents().find(s => s.id === inv.studentId);

    Utils.modal('Confirmar Pagamento em Espécie',
      `<div style="text-align:center;padding:8px 0;">
        <div style="font-size:40px;margin-bottom:8px;">💵</div>
        <p style="font-size:15px;margin-bottom:4px;">Confirmar baixa para <strong>${Utils.escape(inv.studentName)}</strong>?</p>
        <p style="font-size:14px;color:var(--text-muted);margin-bottom:16px;">
          ${Utils.escape(inv.description)} — <strong>${Utils.currency(inv.amount)}</strong>
        </p>
        <div class="form-group" style="text-align:left;">
          <label class="form-label">Valor recebido (R$)</label>
          <input type="number" id="especie-valor" class="form-control" value="${inv.amount}" step="0.01" min="0" />
        </div>
        <div class="form-group" style="text-align:left;">
          <label class="form-label">Observação</label>
          <input type="text" id="especie-obs" class="form-control" placeholder="Opcional" />
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="FinEntradas._confirmEspecie('${invoiceId}')">
         <i class="fa-solid fa-money-bill-wave"></i> Confirmar Recebimento
       </button>`
    );
  },

  _confirmEspecie(invoiceId) {
    const inv = DB.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    const valor = parseFloat(document.getElementById('especie-valor').value) || inv.amount;
    const obs = document.getElementById('especie-obs').value.trim();
    const desc = obs ? `${inv.description} — ${obs}` : inv.description;
    // Registrar como pagamento em espécie (sem taxa do Asaas)
    DB.updateInvoice(invoiceId, {
      status: 'pago',
      paidAt: new Date().toISOString(),
      amount: valor,
      paymentMethod: 'especie'  // ✅ Define tipo de pagamento como espécie
    });
    // Crédito completo, sem desconto de taxa (espécie não passa pelo Asaas)
    DB.addTransaction('credit', valor, `Espécie – ${inv.studentName} – ${desc}`);
    document.querySelector('.modal-overlay')?.remove();
    Utils.toast('Pagamento em espécie registrado!', 'success');
    this.applyMonth();
  },

  _buildMsg(s, inv, resp) {
    const escola = DB.getSchoolConfig();
    const pix    = this._pixKey || '(chave PIX não configurada — acesse Configurações)';
    return `Olá, ${resp?.nome || 'responsável'}! A mensalidade de ${s.name} no valor de ${Utils.currency(inv?.amount || s.monthlyFee)} vence em ${inv ? Utils.date(inv.dueDate) : '–'}. Realize o pagamento via PIX: ${pix}.${escola.name ? ' Att, ' + escola.name : ''}`;
  },

  renderTable() {
    const wrap = document.getElementById('due-table-wrap');
    if (!wrap) return;
    const total  = this._all.length;
    const pages  = Math.max(1, Math.ceil(total / this._perPage));
    this._page   = Math.min(this._page, pages);
    const start  = (this._page - 1) * this._perPage;
    const slice  = this._all.slice(start, start + this._perPage);
    const today  = new Date(); today.setHours(0,0,0,0);

    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Aluno</th><th>Responsável</th><th>Turma</th><th>Professor</th>
          <th>Valor</th><th>Vencimento</th><th>Ação</th>
        </tr></thead>
        <tbody>
          ${slice.length === 0
            ? `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--secondary);"></i><p>Nenhuma mensalidade pendente!</p></div></td></tr>`
            : slice.map(({s, inv, cls, teacher, resp}) => {
                const due    = new Date(inv.dueDate + 'T00:00:00');
                const venceu = due < today;
                const soon   = !venceu && Utils.isDueSoon(inv.dueDate);
                const rowBg  = venceu ? '#fff8f8' : soon ? '#fffde7' : '';
                return `<tr style="${rowBg ? 'background:'+rowBg : ''}">
                  <td>
                    <strong>${Utils.escape(s.name)}</strong>
                    ${venceu ? '<br><span class="badge badge-red" style="font-size:10px;">Vencida</span>' : soon ? '<br><span class="badge badge-yellow" style="font-size:10px;">Vence em breve</span>' : ''}
                  </td>
                  <td>${resp ? Utils.escape(resp.nome) : '–'}</td>
                  <td>${cls ? Utils.escape(cls.name) : '–'}</td>
                  <td>${teacher ? Utils.escape(teacher.name) : '–'}</td>
                  <td><strong>${Utils.currency(inv.amount || s.monthlyFee)}</strong></td>
                  <td>${Utils.date(inv.dueDate)}</td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      <button class="btn btn-sm" onclick="FinEntradas.sendPix('${s.id}','${inv.id}')"
                        style="background:#1a73e8;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;min-width:70px;text-align:center;">
                        <i class="fa-solid fa-paper-plane"></i> PIX
                      </button>
                      <button class="btn btn-sm" onclick="FinEntradas.markPaidHist('${inv.id}')"
                        style="background:var(--secondary);color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;min-width:70px;text-align:center;">
                        <i class="fa-solid fa-money-bill-wave"></i> Espécie
                      </button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>`;

    const prevBtn  = document.getElementById('btn-prev-page');
    const nextBtn  = document.getElementById('btn-next-page');
    const pageInfo = document.getElementById('page-info');
    if (prevBtn) prevBtn.disabled = this._page <= 1;
    if (nextBtn) nextBtn.disabled = this._page >= pages;
    if (pageInfo) pageInfo.textContent = total === 0 ? '' : `Página ${this._page} de ${pages} — ${total} registro(s)`;
  },

  changePage(delta) {
    this._page += delta;
    this.renderTable();
  },

  renderAvulsaTable() {
    const wrap = document.getElementById('avulsa-table-wrap');
    if (!wrap) return;
    const perPage = 10;
    const list    = this._avulsaAll || [];
    const total   = list.length;
    const pages   = Math.max(1, Math.ceil(total / perPage));
    this._avulsaPage = Math.min(Math.max(1, this._avulsaPage || 1), pages);
    const start   = (this._avulsaPage - 1) * perPage;
    const slice   = list.slice(start, start + perPage);

    wrap.innerHTML = `
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Aluno</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Ação</th>
        </tr></thead>
        <tbody>
          ${slice.length === 0
            ? `<tr><td colspan="5"><div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--secondary);"></i><p>Nenhuma cobrança avulsa pendente!</p></div></td></tr>`
            : slice.map(inv => {
                const venceu = Utils.isOverdue(inv.dueDate);
                const soon   = !venceu && Utils.isDueSoon(inv.dueDate);
                const rowBg  = venceu ? '#fff8f8' : soon ? '#fffde7' : '';
                return `<tr style="${rowBg ? 'background:'+rowBg : ''}">
                  <td><strong>${Utils.escape(inv.studentName || '–')}</strong></td>
                  <td>${Utils.escape(inv.description)}${venceu ? ' <span class="badge badge-red" style="font-size:10px;">Vencida</span>' : soon ? ' <span class="badge badge-yellow" style="font-size:10px;">Vence em breve</span>' : ''}</td>
                  <td><strong>${Utils.currency(inv.amount)}</strong></td>
                  <td>${Utils.date(inv.dueDate)}</td>
                  <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      <button class="btn btn-sm" onclick="FinEntradas.sendPix('${inv.studentId}','${inv.id}')"
                        style="background:#1a73e8;color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;min-width:70px;text-align:center;">
                        <i class="fa-solid fa-paper-plane"></i> PIX
                      </button>
                      <button class="btn btn-sm" onclick="FinEntradas.markPaidHist('${inv.id}')"
                        style="background:var(--secondary);color:#fff;border:none;padding:5px 10px;border-radius:6px;font-size:11px;cursor:pointer;min-width:70px;text-align:center;">
                        <i class="fa-solid fa-money-bill-wave"></i> Espécie
                      </button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>`;

    const prevBtn  = document.getElementById('btn-prev-avulsa');
    const nextBtn  = document.getElementById('btn-next-avulsa');
    const pageInfo = document.getElementById('page-info-avulsa');
    if (prevBtn) prevBtn.disabled = this._avulsaPage <= 1;
    if (nextBtn) nextBtn.disabled = this._avulsaPage >= pages;
    if (pageInfo) pageInfo.textContent = total === 0 ? '' : `Página ${this._avulsaPage} de ${pages} — ${total} registro(s)`;
  },

  changeAvulsaPage(delta) {
    this._avulsaPage += delta;
    this.renderAvulsaTable();
  },

  async sendMassAvulsa() {
    if (!this._avulsaAll || this._avulsaAll.length === 0) { Utils.toast('Nenhuma cobrança avulsa pendente.', 'info'); return; }
    const user   = Auth.current();
    const school = DB.getSchool(DB._schoolId);
    const cfg    = DB.getSchoolConfig();
    let sent = 0, semConta = 0;
    Utils.toast('Gerando cobranças PIX...', 'info');
    for (const inv of this._avulsaAll) {
      const s = DB.getStudents().find(x => x.id === inv.studentId);
      if (!s || !s.parentId) { semConta++; continue; }
      const resp = (s.responsaveis || [])[0];

      // Gerar PIX Asaas individual para cada cobrança
      let pixCode = null;
      if (school?.asaasWalletId) {
        try {
          const result = await AsaasClient.chargeInvoice(inv, s, school);
          if (result) pixCode = result.pixCopiaECola;
        } catch(e) { /* fallback abaixo */ }
      }
      if (!pixCode) pixCode = cfg.pixKey || null;

      const msg = pixCode
        ? `Olá, ${resp?.nome || 'responsável'}! A cobrança "${Utils.escape(inv.description)}" de ${s.name} no valor de ${Utils.currency(inv.amount)} vence em ${Utils.date(inv.dueDate)}.\n\n📱 PIX Copia e Cola:\n${pixCode}`
        : `Olá, ${resp?.nome || 'responsável'}! A cobrança "${Utils.escape(inv.description)}" de ${s.name} no valor de ${Utils.currency(inv.amount)} vence em ${Utils.date(inv.dueDate)}. Entre em contato com a escola para realizar o pagamento.`;

      DB.addMessage?.({
        fromUserId: user.id, fromName: user.name,
        toUserId: s.parentId, studentId: s.id,
        studentName: s.name, subject: `Cobrança: ${inv.description}`, text: msg,
      });
      sent++;
    }
    Utils.toast(
      `${sent} mensagem(ns) enviada(s) com PIX.${semConta > 0 ? ` ${semConta} responsável(is) sem conta no sistema.` : ''}`,
      sent > 0 ? 'success' : 'info'
    );
  },

  _calcularValorComJuros(inv, school) {
    // Calcular juros se a data for passada
    let valorFinal = inv.amount || 0;
    if (inv.dueDate) {
      const dueDate = new Date(inv.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        const diasAtraso = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        const finePercent = Number(school?.finePercent ?? 2.0);
        const interestDayPercent = Number(school?.interestDayPercent ?? 0.033);

        // Multa fixa (uma vez)
        const multa = valorFinal * (finePercent / 100);
        // Juros compostos diários
        const juros = valorFinal * Math.pow(1 + (interestDayPercent / 100), diasAtraso) - valorFinal;

        valorFinal = valorFinal + multa + juros;
      }
    }
    return Number(valorFinal.toFixed(2));
  },

  async sendPix(studentId, invoiceId) {
    const s    = DB.getStudents().find(s => s.id === studentId);
    const inv  = DB.getInvoices().find(i => i.id === invoiceId);
    const resp = (s?.responsaveis || [])[0];
    const user = Auth.current();
    const school = DB.getSchool(DB._schoolId);

    if (!s || !inv) return;

    Utils.toast('Gerando cobrança PIX...', 'info');

    // chargeInvoice aplica internamente multa+juros e ajusta dueDate se vencida
    let pixCode = null;
    let valorCobrado = inv.amount;
    if (school?.asaasWalletId) {
      const result = await AsaasClient.chargeInvoice(inv, s, school);
      if (result) {
        pixCode = result.pixCopiaECola;
        valorCobrado = Number(result.value) || inv.amount;
      }
    }

    // Fallback para chave PIX configurada
    if (!pixCode) {
      const cfg = DB.getSchoolConfig();
      pixCode = cfg.pixKey || null;
      // Sem Asaas, calcular juros manualmente para exibir no chat
      valorCobrado = this._calcularValorComJuros(inv, school);
    }

    const msgPix = pixCode
      ? `Olá, ${resp?.nome || 'responsável'}! A cobrança de ${s.name} no valor de ${Utils.currency(valorCobrado)} vence em ${Utils.date(inv.dueDate)}.\n\n📱 PIX Copia e Cola:\n${pixCode}`
      : `Olá, ${resp?.nome || 'responsável'}! A cobrança de ${s.name} no valor de ${Utils.currency(valorCobrado)} vence em ${Utils.date(inv.dueDate)}. Entre em contato com a escola para realizar o pagamento.`;

    // Envia mensagem no chat interno
    if (s.parentId) {
      DB.addMessage({
        fromUserId: user.id,
        fromName:   user.name,
        toUserId:   s.parentId,
        studentId:  s.id,
        studentName: s.name,
        subject:    `PIX — ${inv.description}`,
        text:       msgPix,
      });
      Utils.toast(`PIX enviado ao responsável de ${s.name} via chat!`, 'success');
    }

    // Modal com PIX + WhatsApp
    this._showPixEnvioModal(s, inv, resp, pixCode);
  },

  _showPixEnvioModal(s, inv, resp, pixCode) {
    const telefone = resp?.telefone ? resp.telefone.replace(/\D/g, '') : null;
    const msgWpp = pixCode
      ? `Olá ${resp?.nome || 'responsável'}! A cobrança de ${s.name} - ${inv.description} no valor de *${Utils.currency(inv.amount)}* vence em ${Utils.date(inv.dueDate)}. PIX: ${pixCode}`
      : `Olá ${resp?.nome || 'responsável'}! A cobrança de ${s.name} no valor de *${Utils.currency(inv.amount)}* vence em ${Utils.date(inv.dueDate)}.`;
    const wppUrl = telefone
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(msgWpp)}`
      : null;

    Utils.modal('PIX Gerado e Enviado',
      `<div style="text-align:center;">
        <i class="fa-solid fa-circle-check" style="font-size:36px;color:var(--secondary);margin-bottom:8px;display:block;"></i>
        <p style="font-weight:700;margin-bottom:4px;">${Utils.escape(s.name)}</p>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">${Utils.escape(inv.description)} — ${Utils.currency(inv.amount)}</p>
        ${pixCode ? `
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block;margin-bottom:4px;">PIX Copia e Cola</label>
        <div style="display:flex;gap:6px;margin-bottom:16px;">
          <input id="sendpix-code" class="form-control" value="${Utils.escape(pixCode)}" readonly style="font-size:11px;font-family:monospace;" />
          <button type="button" class="btn btn-outline btn-sm" onclick="Utils.copyText(document.getElementById('sendpix-code').value);Utils.toast('Copiado!','success');">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>` : '<p style="color:var(--warning);">Escola sem subconta Asaas. Configure para gerar PIX automático.</p>'}
        ${s.parentId ? '<p style="font-size:12px;color:var(--secondary);"><i class="fa-solid fa-check"></i> Mensagem enviada ao chat do responsável.</p>' : '<p style="font-size:12px;color:var(--text-muted);">Responsável sem conta no sistema.</p>'}
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       ${wppUrl ? `<a href="${wppUrl}" target="_blank" class="btn" style="background:#25d366;color:#fff;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
         <i class="fa-brands fa-whatsapp"></i> Enviar via WhatsApp
       </a>` : ''}
       <button class="btn btn-primary" onclick="FinEntradas._showBaixaModal(DB.getStudents().find(s=>s.id==='${s.id}'),DB.getInvoices().find(i=>i.id==='${inv.id}'));this.closest('.modal-overlay').remove()">
         <i class="fa-solid fa-check"></i> Dar Baixa
       </button>`
    );
  },

  _showBaixaModal(s, inv) {
    const existing = document.getElementById('pix-baixa-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pix-baixa-modal';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.45)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:'9999'
    });

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.18);text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">💰</div>
        <h3 style="margin:0 0 8px;font-size:18px;">Pagamento já confirmado?</h3>
        <p style="color:var(--text-muted);font-size:14px;margin:0 0 24px;">
          Deseja dar baixa na mensalidade de <strong>${Utils.escape(s.name)}</strong>
          no valor de <strong>${Utils.currency(inv?.amount || s.monthlyFee)}</strong>?
        </p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button onclick="FinEntradas._confirmBaixa('${s.id}','${inv?.id}')"
            style="background:#1a73e8;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
            Sim, dar baixa
          </button>
          <button onclick="document.getElementById('pix-baixa-modal').remove()"
            style="background:#f1f3f4;color:#5f6368;border:1.5px solid var(--border);padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;">
            Não agora
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  },

  _confirmBaixa(studentId, invoiceId) {
    document.getElementById('pix-baixa-modal')?.remove();
    const inv = DB.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;

    DB.updateInvoice(invoiceId, { status: 'pago', paidAt: new Date().toISOString() });
    DB.addTransaction('credit', inv.amount, inv.description);
    Utils.toast('Baixa realizada com sucesso!', 'success');
    // Re-renderiza tudo com dados frescos do banco
    this.applyMonth();
  },

  async sendMassPix() {
    if (this._all.length === 0) { Utils.toast('Nenhuma mensalidade pendente.', 'info'); return; }
    const user   = Auth.current();
    const school = DB.getSchool(DB._schoolId);
    const cfg    = DB.getSchoolConfig();
    let sent = 0, semConta = 0;
    Utils.toast(`Gerando PIX para ${this._all.length} aluno(s)...`, 'info');

    for (const {s, inv, resp} of this._all) {
      if (!s.parentId) { semConta++; continue; }

      // Gerar PIX Asaas individual para cada mensalidade
      let pixCode = null;
      let valorCobrado = inv.amount;
      if (school?.asaasWalletId) {
        try {
          const result = await AsaasClient.chargeInvoice(inv, s, school);
          if (result) {
            pixCode = result.pixCopiaECola;
            valorCobrado = Number(result.value) || inv.amount;
          }
        } catch(e) {
          console.error('[sendMassPix] Erro ao gerar PIX:', e);
        }
      }
      if (!pixCode) pixCode = cfg.pixKey || null;

      const msg = pixCode
        ? `Olá, ${resp?.nome || 'responsável'}! Segue a chave PIX para a mensalidade de ${s.name}.\n\n💰 Valor: ${Utils.currency(valorCobrado)}\n📅 Vencimento: ${Utils.date(inv.dueDate)}\n\n📱 PIX Copia e Cola:\n${pixCode}`
        : `Olá, ${resp?.nome || 'responsável'}! A mensalidade de ${s.name} no valor de ${Utils.currency(inv.amount)} vence em ${Utils.date(inv.dueDate)}. Entre em contato com a escola para realizar o pagamento.`;

      DB.addMessage?.({
        fromUserId: user.id, fromName: user.name,
        toUserId: s.parentId, studentId: s.id,
        studentName: s.name, subject: `Mensalidade: ${s.name}`, text: msg,
      });
      sent++;
    }
    Utils.toast(
      `${sent} PIX(s) gerado(s) e mensagem(ns) enviada(s).${semConta > 0 ? ` ${semConta} responsável(is) sem conta no sistema.` : ''}`,
      sent > 0 ? 'success' : 'info'
    );
  },

  exportPDF() {
    const inv = this._invPeriodo || [];
    if (inv.length === 0) { Utils.toast('Nenhum boleto no período para exportar.', 'info'); return; }
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const periodo = `${nomes[FinEntradas._month]} ${FinEntradas._year}`;

    let html = `<html><head><title>Histórico de Entradas - ${periodo}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;font-size:12px;}
        h2{color:#1a73e8;margin-bottom:4px;}
        .sub{color:#666;margin-bottom:16px;font-size:13px;}
        table{width:100%;border-collapse:collapse;margin-top:12px;}
        th{background:#1a73e8;color:#fff;padding:8px 10px;text-align:left;font-size:12px;}
        td{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;}
        tr:nth-child(even){background:#f8f9fa;}
        .total{margin-top:16px;font-size:14px;font-weight:bold;}
        .pago{color:#2e7d32;} .pendente{color:#b06000;} .cancelado{color:#999;} .vencido{color:#c62828;}
        @media print{body{padding:0;}}
      </style></head><body>
      <h2>Histórico de Entradas</h2>
      <div class="sub">Período: ${periodo}</div>
      <table><thead><tr><th>Aluno</th><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>`;

    const totalRec = inv.filter(i=>i.status==='pago').reduce((t,i)=>t+i.amount,0);
    const totalPend = inv.filter(i=>i.status==='pendente').reduce((t,i)=>t+i.amount,0);

    inv.slice().sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).forEach(i => {
      const venceu = i.status === 'pendente' && Utils.isOverdue(i.dueDate);
      const st = venceu ? 'vencido' : i.status;
      const stLabel = st === 'pago' ? 'Pago' : st === 'pendente' ? 'Pendente' : st === 'vencido' ? 'Vencido' : 'Cancelado';
      html += `<tr><td>${Utils.escape(i.studentName||'–')}</td><td>${Utils.escape(i.description)}</td>
        <td>${Utils.currency(i.amount)}</td><td>${Utils.date(i.dueDate)}</td>
        <td class="${st}">${stLabel}</td></tr>`;
    });

    html += `</tbody></table>
      <div class="total">Total Recebido: <span class="pago">${Utils.currency(totalRec)}</span></div>
      <div class="total">Total Pendente: <span class="pendente">${Utils.currency(totalPend)}</span></div>
      </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  },

  _toggleAlvo(val) {
    document.getElementById('nc-class-wrap').style.display   = val === 'class' ? 'block' : 'none';
    document.getElementById('nc-student-wrap').style.display = val === 'one'   ? 'block' : 'none';
  },

  // ---------- COBRANÇA AVULSA (festa, evento, material, etc.) ----------
  openNovaCobranca() {
    const students = DB.getStudents().filter(s => s.status === 'ativo')
      .sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
    if (students.length === 0) {
      Utils.toast('Cadastre alunos antes de criar cobranças.', 'warning');
      return;
    }
    const today  = new Date();
    const amanha = new Date(today.getTime() + 86400000).toISOString().slice(0,10);  // mínimo = amanhã
    const defDue = new Date(today.getTime() + 7*86400000).toISOString().slice(0,10); // padrão = +7 dias
    const html = `
      <div class="modal-overlay" onclick="if(event.target===this)this.remove()">
        <div class="modal" style="max-width:560px;">
          <div class="modal-header">
            <h3><i class="fa-solid fa-receipt"></i> Nova Cobrança Avulsa</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Descrição *</label>
              <input type="text" id="nc-desc" class="form-control" placeholder="Ex.: Festa Junina, Material Didático, Passeio..." />
            </div>
            <div class="form-group">
              <label>Valor (R$) *</label>
              <input type="number" id="nc-amount" class="form-control" step="0.01" min="0.01" placeholder="0,00" />
            </div>
            <div class="form-group">
              <label>Vencimento * <span style="color:var(--danger);font-size:11px;font-weight:600;">somente datas futuras</span></label>
              <input type="date" id="nc-due" class="form-control" value="${defDue}" min="${amanha}" />
              <small style="color: var(--text-muted);">Mínimo: amanhã (${Utils.date(amanha)})</small>
            </div>
            <div class="form-group">
              <label>Aplicar a:</label>
              <select id="nc-target" class="form-control" onchange="FinEntradas._toggleAlvo(this.value)">
                <option value="all">Todos os alunos ativos (${students.length})</option>
                <option value="class">Turma específica</option>
                <option value="one">Apenas um aluno</option>
              </select>
            </div>
            <div class="form-group" id="nc-class-wrap" style="display:none;">
              <label>Turma</label>
              <select id="nc-class" class="form-control">
                ${DB.getClasses().map(c => {
                  const n = students.filter(s => s.classId === c.id).length;
                  return `<option value="${c.id}">${Utils.escape(c.name)} — ${Utils.escape(c.level||'')} (${n} aluno${n!==1?'s':''})</option>`;
                }).join('') || '<option value="">Nenhuma turma cadastrada</option>'}
              </select>
            </div>
            <div class="form-group" id="nc-student-wrap" style="display:none;">
              <label>Aluno</label>
              <select id="nc-student" class="form-control">
                ${students.map(s => `<option value="${s.id}">${Utils.escape(s.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                <input type="checkbox" id="nc-sendmsg" checked /> Enviar PIX automaticamente aos responsáveis pelo chat
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
            <button class="btn btn-primary" onclick="FinEntradas.salvarNovaCobranca()">
              <i class="fa-solid fa-check"></i> Criar Cobrança
            </button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async salvarNovaCobranca() {
    const desc    = document.getElementById('nc-desc').value.trim();
    const amount  = parseFloat(document.getElementById('nc-amount').value);
    const due     = document.getElementById('nc-due').value;
    const target  = document.getElementById('nc-target').value;
    const sendMsg = document.getElementById('nc-sendmsg').checked;
    if (!desc) { Utils.toast('Informe a descrição.', 'error'); return; }
    if (!amount || amount <= 0) { Utils.toast('Informe um valor válido.', 'error'); return; }
    if (!due) { Utils.toast('Informe o vencimento.', 'error'); return; }

    // Validar que o vencimento é sempre no futuro (nunca hoje nem passado)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje.getTime() + 86400000);
    const dueDate = new Date(due + 'T00:00:00');
    if (dueDate < amanha) {
      Utils.toast('O vencimento deve ser para um dia futuro (a partir de amanhã).', 'error');
      document.getElementById('nc-due')?.focus();
      return;
    }

    let alvos = [];
    if (target === 'one') {
      const s = DB.getStudents().find(x => x.id === document.getElementById('nc-student').value);
      if (s) alvos = [s];
    } else if (target === 'class') {
      const cid = document.getElementById('nc-class').value;
      alvos = DB.getStudents().filter(s => s.status === 'ativo' && s.classId === cid);
    } else {
      alvos = DB.getStudents().filter(s => s.status === 'ativo');
    }
    if (alvos.length === 0) { Utils.toast('Nenhum aluno selecionado.', 'error'); return; }

    document.querySelector('.modal-overlay')?.remove();
    Utils.toast(`Criando ${alvos.length} cobrança(s)...`, 'info');

    const user   = Auth.current();
    const school = DB.getSchool(DB._schoolId);
    let criados  = 0;

    for (const s of alvos) {
      const inv = DB.addInvoice({
        studentId: s.id, studentName: s.name,
        description: desc, amount, dueDate: due, status: 'pendente',
      });
      criados++;

      // Gerar PIX Asaas real
      let pixCode = null;
      if (school?.asaasWalletId) {
        try {
          const result = await AsaasClient.chargeInvoice(inv, s, school);
          if (result) pixCode = result.pixCopiaECola;
        } catch(e) { /* continua sem PIX */ }
      }

      // Enviar no chat do responsável
      if (sendMsg && s.parentId) {
        const resp = (s.responsaveis || [])[0];
        const msg = pixCode
          ? `Olá, ${resp?.nome || 'responsável'}! Foi gerada a cobrança "${desc}" no valor de ${Utils.currency(amount)} para ${s.name}, vencimento em ${Utils.date(due)}.\n\n📱 PIX Copia e Cola:\n${pixCode}`
          : `Olá, ${resp?.nome || 'responsável'}! Foi gerada a cobrança "${desc}" no valor de ${Utils.currency(amount)} para ${s.name}, vencimento em ${Utils.date(due)}. Entre em contato para obter o PIX.`;
        DB.addMessage?.({
          fromUserId: user.id, fromName: user.name,
          toUserId: s.parentId, studentId: s.id,
          studentName: s.name, matricula: s.matricula,
          subject: `Cobrança: ${desc}`, text: msg,
        });
      }
    }

    Utils.toast(`${criados} cobrança(s) criada(s) com PIX gerado!`, 'success');
    this.applyMonth();
  }
};

// ---------- BALANÇO FINANCEIRO ----------
Router.register('fin-balance', async () => {
  const user = Auth.require(); if (!user) return;

  await DB.refreshInvoices?.();

  // Inicializa sempre no mês atual ao entrar na página
  const now = new Date();
  FinBalance._month = now.getMonth();
  FinBalance._year  = now.getFullYear();

  // Renderiza estrutura base e carrega dados do mês
  Router.renderLayout(user, 'fin-balance', `
    <h2 style="margin-bottom:20px;">Balanço / Saldo / Resgate</h2>

    <!-- Seletor de mês -->
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:20px;">
      <button class="btn btn-outline btn-sm" onclick="FinBalance.changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
      <span id="fin-balance-mes-label" style="font-size:18px;font-weight:700;min-width:160px;text-align:center;"></span>
      <button class="btn btn-outline btn-sm" onclick="FinBalance.changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>

    <!-- Resumo geral (preenchido pelo JS) -->
    <div id="fin-balance-resumo"></div>

    <!-- Saldos Consolidados (Espécie vs PIX) -->
    <div class="card" style="background: linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%); border: 2px solid var(--border); margin-bottom: 20px;">
      <div class="card-header" style="border-bottom: 2px solid var(--border);">
        <span class="card-title"><i class="fa-solid fa-scale-balanced"></i> Consolidação de Saldos</span>
        <button class="btn btn-outline btn-sm" onclick="FinBalance.atualizarConsolidacao()">
          <i class="fa-solid fa-rotate"></i> Atualizar
        </button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 24px;">

        <!-- Saldo Espécie -->
        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #7b1fa2;">
          <div style="font-size: 14px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">
            <i class="fa-solid fa-money-bill-wave"></i> Pagamento em Espécie
          </div>
          <div style="font-size: 32px; font-weight: 900; color: #7b1fa2; margin-bottom: 4px;" id="saldo-especie-valor">R$ 0,00</div>
          <div style="font-size: 12px; color: var(--text-muted);">Recebido 100% (sem taxa)</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;" id="saldo-especie-info">–</div>
        </div>

        <!-- Saldo PIX (Asaas) -->
        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #1a73e8;">
          <div style="font-size: 14px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 8px;">
            <i class="fa-brands fa-pix"></i> Pagamento via PIX (Asaas)
          </div>
          <div style="font-size: 32px; font-weight: 900; color: #1a73e8; margin-bottom: 4px;" id="saldo-pix-valor">R$ 0,00</div>
          <div style="font-size: 12px; color: var(--text-muted);">Saldo com taxa já descontada</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;" id="saldo-pix-info">–</div>
        </div>

      </div>

      <!-- Resumo Total -->
      <div style="padding: 16px 24px; background: #f9f9f9; border-top: 1px solid var(--border); border-radius: 0 0 8px 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Saldo Total Disponível</div>
          <div style="font-size: 24px; font-weight: 800; color: var(--primary);" id="saldo-total-valor">R$ 0,00</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Resgate PIX (saldo na plataforma)</div>
          <div id="saldo-resgate-valor">
            <div style="font-size:24px;font-weight:800;color:var(--text-muted);">R$ 0,00</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Saldo disponível no gateway Asaas (detalhado) -->
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fa-solid fa-building-columns"></i> Detalhes Asaas</span>
        <button class="btn btn-outline btn-sm" onclick="FinBalance.recarregarSaldo()">
          <i class="fa-solid fa-rotate"></i> Atualizar
        </button>
      </div>
      <div id="asaas-balance-area" style="padding:24px;text-align:center;">
        <div style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Consultando saldo no Asaas...</div>
      </div>
    </div>

    <!-- Pagamentos PIX confirmados (preenchido pelo JS) -->
    <div class="card">
      <div class="card-header"><span class="card-title"><i class="fa-brands fa-pix"></i> Pagamentos PIX Confirmados</span></div>
      <div id="fin-balance-pix-table"></div>
    </div>
  `);

  FinBalance.renderMes();
  FinBalance.recarregarSaldo();
  FinBalance.atualizarConsolidacao();

  // Realtime: atualiza quando invoice é paga
  if (user.schoolId) {
    Realtime.subscribe('invoices', `school_id=eq.${user.schoolId}`, async (payload) => {
      if (payload.new?.status === 'pago' || payload.eventType === 'UPDATE') {
        await DB.refreshInvoices?.();
        Utils.toast('Pagamento confirmado! Atualizando...', 'success');
        FinBalance.renderMes();
        FinBalance.recarregarSaldo();
        FinBalance.atualizarConsolidacao();
      }
    });
  }
});

const FinBalance = {
  _month: null,
  _year: null,

  _nomes: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],

  changeMonth(delta) {
    let m = this._month + delta;
    let y = this._year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    this._month = m;
    this._year  = y;
    this.renderMes();
  },

  renderMes() {
    const month = this._month;
    const year  = this._year;
    const mm    = String(month + 1).padStart(2, '0');
    const ult   = new Date(year, month + 1, 0).getDate();
    const dateFrom = `${year}-${mm}-01`;
    const dateTo   = `${year}-${mm}-${String(ult).padStart(2,'0')}`;

    // Atualiza label do mês
    const lbl = document.getElementById('fin-balance-mes-label');
    if (lbl) lbl.textContent = `${this._nomes[month]} ${year}`;

    const school   = DB.getSchool(DB._schoolId);
    const students = DB.getStudents().filter(s => s.status === 'ativo');
    const invoices = DB.getInvoices();

    // Filtra por período (usa dueDate para previsto/pendentes, paidAt para recebidos)
    const invMes    = invoices.filter(i => (i.dueDate || '').slice(0,7) === `${year}-${mm}`);
    const previsao  = students.reduce((t, s) => t + (s.monthlyFee || 0), 0);
    const pagosNoMes = invoices.filter(i => i.status === 'pago' && (i.paidAt || i.updatedAt || '').slice(0,7) === `${year}-${mm}`);
    const recebido  = pagosNoMes.reduce((t, i) => t + i.amount, 0);
    const percentual = previsao > 0 ? Math.min(Math.round((recebido / previsao) * 100), 100) : 0;
    const verde   = percentual >= 80;
    const amarelo = percentual >= 50 && percentual < 80;

    const commissionRate = Number(school?.commissionRate) || 3;
    const ASAAS_PIX_FEE = 1.99;
    const calcTaxa = (amount) => ASAAS_PIX_FEE + (amount - ASAAS_PIX_FEE) * commissionRate / 100;

    const pixPagos    = pagosNoMes.filter(i => i.paymentMethod === 'pix_asaas');
    const totalPix    = pixPagos.reduce((t, i) => t + i.amount, 0);
    const totalTaxa   = pixPagos.reduce((t, i) => t + calcTaxa(i.amount), 0);
    const especiePagos = pagosNoMes.filter(i => i.paymentMethod !== 'pix_asaas');
    const totalEspecie = especiePagos.reduce((t, i) => t + i.amount, 0);

    // Resumo
    const resumo = document.getElementById('fin-balance-resumo');
    if (resumo) resumo.innerHTML = `
      <div class="card" style="text-align:center;padding:32px;margin-bottom:16px;">
        <div style="font-size:56px;margin-bottom:8px;">${verde ? '🟢' : amarelo ? '🟡' : '🔴'}</div>
        <div style="font-size:24px;font-weight:900;color:${verde ? 'var(--secondary)' : amarelo ? '#b06000' : 'var(--danger)'};">
          ${verde ? 'NO VERDE ✅' : amarelo ? 'ATENÇÃO ⚠️' : 'NO VERMELHO ❌'}
        </div>
        <div style="margin-top:6px;color:var(--text-muted);font-size:13px;">
          ${verde ? 'Recebimento acima de 80% do previsto.'
            : amarelo ? 'Recebimento entre 50% e 80% do previsto.'
            : 'Recebimento abaixo de 50% do previsto.'}
        </div>
        <div style="margin:20px auto;max-width:400px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:600;">Recebido vs Previsto</span>
            <strong style="color:${verde ? 'var(--secondary)' : amarelo ? '#b06000' : 'var(--danger)'};">${percentual}%</strong>
          </div>
          <div class="progress-bar-wrap" style="height:14px;border-radius:20px;">
            <div class="progress-bar" style="width:${percentual}%;height:14px;border-radius:20px;background:${verde ? 'var(--secondary)' : amarelo ? 'var(--warning)' : 'var(--danger)'};"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;max-width:900px;margin:0 auto 20px;">
          <div><div style="font-size:12px;color:var(--text-muted);">Previsto</div><div style="font-size:18px;font-weight:800;">${Utils.currency(previsao)}</div></div>
          <div><div style="font-size:12px;color:var(--text-muted);">Recebido total</div><div style="font-size:18px;font-weight:800;color:var(--secondary);">${Utils.currency(recebido)}</div></div>
          <div><div style="font-size:12px;color:var(--text-muted);">Via PIX</div><div style="font-size:18px;font-weight:800;color:#1a73e8;">${Utils.currency(totalPix)}</div></div>
          <div><div style="font-size:12px;color:var(--text-muted);">Em espécie</div><div style="font-size:18px;font-weight:800;color:#7b1fa2;">${Utils.currency(totalEspecie)}</div></div>
          <div><div style="font-size:12px;color:var(--text-muted);">Taxa de serviço (PIX)</div><div style="font-size:18px;font-weight:800;color:var(--danger);">-${Utils.currency(totalTaxa)}</div></div>
        </div>
      </div>`;

    // Tabela PIX
    const tbl = document.getElementById('fin-balance-pix-table');
    if (tbl) tbl.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Data</th><th>Aluno</th><th>Descrição</th><th>Valor</th><th>Taxa (R$1,99 + ${commissionRate}%)</th><th>Líquido</th><th>Ação</th></tr></thead>
      <tbody>
        ${pixPagos.length === 0
          ? `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum pagamento PIX em ${this._nomes[month]}/${year}.</td></tr>`
          : pixPagos.sort((a,b) => new Date(b.paidAt||b.createdAt) - new Date(a.paidAt||a.createdAt)).map(i => {
              const taxa = calcTaxa(i.amount);
              const liq  = i.amount - taxa;
              return `<tr>
                <td>${Utils.date(i.paidAt || i.createdAt)}</td>
                <td>${Utils.escape(i.studentName)}</td>
                <td>${Utils.escape(i.description)}</td>
                <td style="font-weight:700;color:var(--secondary);">${Utils.currency(i.amount)}</td>
                <td style="color:var(--danger);">-${Utils.currency(taxa)}</td>
                <td style="font-weight:700;">${Utils.currency(liq)}</td>
                <td>
                  <button title="Reclassificar como recebido em espécie (sem taxa)"
                    onclick="FinBalance.reclassificarEspecie('${i.id}')"
                    style="background:#7b1fa2;color:#fff;border:none;padding:4px 8px;border-radius:5px;font-size:11px;cursor:pointer;white-space:nowrap;">
                    <i class="fa-solid fa-money-bill-wave"></i> Era Espécie
                  </button>
                </td>
              </tr>`;
            }).join('')}
      </tbody>
    </table></div>`;

    // Atualizar consolidação de saldos
    this.atualizarConsolidacao();
  },

  async recarregarSaldo() {
    const area = document.getElementById('asaas-balance-area');
    if (!area) return;
    const school = DB.getSchool(DB._schoolId);

    if (!school?.asaasWalletId) {
      area.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">
        <i class="fa-solid fa-circle-info"></i>
        Escola sem subconta Asaas configurada. Acesse o painel superadmin para criar.
      </div>`;
      return;
    }

    area.innerHTML = `<div style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Consultando saldo REAL do Asaas...</div>`;

    try {
      // Buscar saldo REAL da subconta da escola no Asaas
      const result = await AsaasClient.getBalance(school.asaasWalletId);

      if (!result) {
        area.innerHTML = `<div style="color:var(--danger);font-size:13px;">
          <i class="fa-solid fa-triangle-exclamation"></i> Não foi possível consultar o Asaas. Tente novamente.
        </div>`;
        return;
      }

      const saldo = result.balance !== undefined ? result.balance : (result.totalBalance || 0);
      const pixKey = school?.pixKey || '';

      // Se saldo negativo, mostrar aviso
      if (saldo < 0) {
        area.innerHTML = `
          <div style="font-size:36px;font-weight:900;color:var(--warning);margin-bottom:4px;">${Utils.currency(saldo)}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Saldo em Asaas (REAL)</div>
          <div style="background:#fff8e1;border:1px solid #ffd54f;border-radius:8px;padding:12px;font-size:12px;color:#8b6914;">
            <i class="fa-solid fa-info-circle"></i> Saldo negativo. Pode haver deduções ou operações pendentes no Asaas.
          </div>
        `;
        return;
      }

      area.innerHTML = `
        <div style="font-size:36px;font-weight:900;color:var(--secondary);margin-bottom:4px;">${Utils.currency(saldo)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Saldo REAL em Asaas</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:20px;font-style:italic;">Atualizado agora</div>
        ${saldo > 0 ? `
          <button class="btn btn-primary" onclick="FinWithdraw.open(${saldo})" style="font-size:15px;padding:12px 32px;">
            <i class="fa-solid fa-money-bill-transfer"></i> Fazer Resgate via PIX
          </button>
          <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            ${pixKey ? `Chave PIX cadastrada: <strong>${Utils.escape(pixKey)}</strong>` : '<span style="color:var(--danger);">⚠️ Chave PIX não cadastrada. Configure em Configurações.</span>'}
          </div>
        ` : `<div style="color:var(--text-muted);font-size:13px;"><i class="fa-solid fa-info-circle"></i> Nenhum saldo disponível para resgate.</div>`}
      `;
    } catch (err) {
      console.error('[recarregarSaldo] Erro:', err);
      area.innerHTML = `<div style="color:var(--danger);font-size:13px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Erro ao consultar Asaas: ${err.message || 'tente novamente'}
      </div>`;
    }
  },

  atualizarConsolidacao() {
    const month = this._month;
    const year = this._year;
    const mm = String(month + 1).padStart(2, '0');

    // Calcular saldos
    const invoices = DB.getInvoices();
    const pagosNoMes = invoices.filter(i => i.status === 'pago' && (i.paidAt || i.updatedAt || '').slice(0, 7) === `${year}-${mm}`);

    // Espécie: Recebe 100% do valor
    const especiePagos = pagosNoMes.filter(i => i.paymentMethod === 'especie' || !i.paymentMethod);
    const totalEspecie = especiePagos.reduce((t, i) => t + (i.amount || 0), 0);

    // PIX: Asaas SEMPRE desconta R$1,99 + GestEscolar SEMPRE desconta 3%
    // Fórmula por transação: Bruto - R$1,99 (taxa Asaas) - 3% sobre líquido = Escola recebe
    const school = DB.getSchool(DB._schoolId);
    const commissionRate = Number(school?.commissionRate) || 3;
    const ASAAS_PIX_FEE = 1.99;

    const pixPagos = pagosNoMes.filter(i => i.paymentMethod === 'pix_asaas');
    const totalPixNominal = pixPagos.reduce((t, i) => t + (i.amount || 0), 0);

    // Calcular deduções para cada transação PIX
    let totalTaxaAsaas = 0;
    let totalComissao = 0;

    pixPagos.forEach((inv) => {
      // Taxa Asaas: SEMPRE R$1,99 por transação
      totalTaxaAsaas += ASAAS_PIX_FEE;

      // Comissão GestEscolar: 3% sobre o líquido (após taxa Asaas)
      const netAfterAsaasFee = inv.amount - ASAAS_PIX_FEE;
      const comissao = netAfterAsaasFee * (commissionRate / 100);
      totalComissao += comissao;
    });

    const totalDeducoes = totalTaxaAsaas + totalComissao;
    const totalPixLiquido = totalPixNominal - totalDeducoes;

    // Atualizar card de consolidação
    const saldoEspecieEl = document.getElementById('saldo-especie-valor');
    const saldoPixEl = document.getElementById('saldo-pix-valor');
    const saldoTotalEl = document.getElementById('saldo-total-valor');
    const saldoResgateEl = document.getElementById('saldo-resgate-valor');
    const infoEspecieEl = document.getElementById('saldo-especie-info');
    const infoPixEl = document.getElementById('saldo-pix-info');

    if (saldoEspecieEl) {
      saldoEspecieEl.textContent = Utils.currency(totalEspecie);
      infoEspecieEl.textContent = `${especiePagos.length} pagamento(s) recebido(s)`;
    }

    if (saldoPixEl) {
      saldoPixEl.textContent = Utils.currency(totalPixLiquido);
      const infoTaxa = totalPixNominal > 0 ? ` (de ${Utils.currency(totalPixNominal)} com taxa de ${Utils.currency(totalTaxaPix)})` : '';
      infoPixEl.textContent = `${pixPagos.length} pagamento(s) no Asaas${infoTaxa}`;
    }

    const totalSaldoDisponivel = totalEspecie + totalPixLiquido;

    if (saldoTotalEl) saldoTotalEl.textContent = Utils.currency(totalSaldoDisponivel);

    // Área de resgate: botão aparece quando há saldo PIX líquido > 0
    if (saldoResgateEl) {
      const school = DB.getSchool(DB._schoolId);
      const pixKey = school?.pixKey || '';
      if (totalPixLiquido > 0) {
        saldoResgateEl.innerHTML = `
          <div style="font-size:24px;font-weight:800;color:var(--secondary);margin-bottom:8px;">${Utils.currency(totalPixLiquido)}</div>
          <button class="btn btn-primary btn-sm" onclick="FinWithdraw.open(${totalPixLiquido})" style="margin-top:4px;">
            <i class="fa-solid fa-money-bill-transfer"></i> Resgatar via PIX
          </button>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
            ${pixKey ? `Chave: <strong>${Utils.escape(pixKey)}</strong>` : '<span style="color:var(--danger);">⚠️ Configure a chave PIX em Configurações</span>'}
          </div>`;
      } else {
        saldoResgateEl.innerHTML = `<div style="font-size:24px;font-weight:800;color:var(--text-muted);">R$ 0,00</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Sem saldo PIX disponível para resgate</div>`;
      }
    }
  },

  reclassificarEspecie(invoiceId) {
    const inv = DB.getInvoices().find(i => i.id === invoiceId);
    if (!inv) return;
    Utils.modal('Reclassificar como Espécie',
      `<div style="text-align:center;padding:8px 0;">
        <div style="font-size:36px;margin-bottom:8px;">💵</div>
        <p>Confirma que <strong>${Utils.escape(inv.studentName)}</strong> pagou</p>
        <p><strong>${Utils.escape(inv.description)}</strong> — <strong>${Utils.currency(inv.amount)}</strong></p>
        <p style="margin-top:12px;color:var(--text-muted);font-size:13px;">
          O pagamento será reclassificado para <strong>Espécie</strong>.<br>
          Sem taxa do Asaas. O valor integral fica com a escola.
        </p>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" onclick="FinBalance._confirmarReclassificacao('${invoiceId}')">
         <i class="fa-solid fa-money-bill-wave"></i> Confirmar — Era Espécie
       </button>`
    );
  },

  async _confirmarReclassificacao(invoiceId) {
    document.querySelector('.modal-overlay')?.remove();
    await DB.updateInvoice(invoiceId, { paymentMethod: 'especie' });
    await DB.refreshInvoices?.();
    Utils.toast('Pagamento reclassificado como espécie!', 'success');
    this.renderMes();
  },
};

// ---------- RESGATE (SAQUE) VIA PIX ----------
const FinWithdraw = {
  open(maxValue) {
    const school = DB.getSchool(DB._schoolId);
    const pixKey = school?.pixKey || '';

    if (!pixKey) {
      Utils.modal('PIX não configurado',
        `<div style="text-align:center;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:40px;color:var(--warning);"></i>
          <p style="margin:12px 0;">Você precisa cadastrar uma <strong>chave PIX</strong> nas configurações da escola antes de solicitar resgate.</p>
        </div>`,
        `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
         <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();Router.go('admin-settings');">
           <i class="fa-solid fa-gear"></i> Ir para Configurações
         </button>`
      );
      return;
    }

    Utils.modal('Solicitar Resgate via PIX',
      `<div style="text-align:center;margin-bottom:16px;">
        <i class="fa-solid fa-money-bill-transfer" style="font-size:36px;color:var(--secondary);"></i>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Saldo disponível</div>
            <div style="font-size:20px;font-weight:800;color:var(--secondary);">${Utils.currency(maxValue)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Chave PIX destino</div>
            <div style="font-size:14px;font-weight:600;font-family:monospace;">${Utils.escape(pixKey)}</div>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Valor do resgate (R$)</label>
        <input type="number" class="form-control" id="withdrawValue" min="1" max="${maxValue}" step="0.01" value="${maxValue}" style="font-size:18px;font-weight:700;text-align:center;" />
        <small style="color:var(--text-muted);font-size:11px;">Mínimo: R$ 1,00 — Máximo: ${Utils.currency(maxValue)}</small>
      </div>
      <div class="alert alert-info" style="font-size:12px;">
        <i class="fa-solid fa-info-circle"></i> O valor será transferido para a chave PIX <strong>${Utils.escape(pixKey)}</strong>.
        A transferência pode levar alguns minutos.
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-primary" id="btnWithdraw" onclick="FinWithdraw.confirm(${maxValue}, '${Utils.escape(pixKey)}')">
         <i class="fa-solid fa-paper-plane"></i> Confirmar Resgate
       </button>`
    );
  },

  async confirm(maxValue, pixKey) {
    const value = parseFloat(document.getElementById('withdrawValue').value);
    if (!value || value < 1) { Utils.toast('Valor mínimo: R$ 1,00', 'error'); return; }
    if (value > maxValue) { Utils.toast(`Valor máximo: ${Utils.currency(maxValue)}`, 'error'); return; }

    const btn = document.getElementById('btnWithdraw');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...'; }

    const school = DB.getSchool(DB._schoolId);
    const result = await AsaasClient.requestWithdraw({
      value,
      pixKey,
      description: `Resgate GestEscolar – ${school?.name || ''}`,
    });

    if (!result) {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Confirmar Resgate'; }
      return;
    }

    // Registrar transação de débito
    DB.addTransaction('debit', value, `Resgate PIX – ${pixKey}`);

    document.querySelector('.modal-overlay')?.remove();
    Utils.modal('Resgate Solicitado',
      `<div style="text-align:center;">
        <i class="fa-solid fa-circle-check" style="font-size:48px;color:var(--secondary);"></i>
        <p style="font-size:18px;font-weight:700;margin:12px 0;">Resgate de ${Utils.currency(value)} solicitado!</p>
        <p style="color:var(--text-muted);">O valor será transferido para <strong>${Utils.escape(pixKey)}</strong>.</p>
        <p style="color:var(--text-muted);font-size:13px;">ID da transferência: ${result.id || '–'}</p>
      </div>`,
      `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();Router.go('fin-balance');">OK</button>`
    );
  },
};
