// =============================================
//  GESTESCOLAR – UTILITÁRIOS
// =============================================

const Utils = {
  // Copiar texto — fallback para Safari iOS que bloqueia navigator.clipboard fora de gesture
  copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => this._copyFallback(text));
    } else {
      this._copyFallback(text);
    }
  },
  _copyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) { /* silencioso */ }
    document.body.removeChild(ta);
  },

  // Formatar moeda BRL
  currency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  },

  // Formatar data
  date(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR');
  },

  // Formatar data + hora
  datetime(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  },

  // Iniciais do nome
  initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  },

  // Status badge HTML
  statusBadge(status) {
    const map = {
      pago:     ['green',  'Pago'],
      pendente: ['yellow', 'Pendente'],
      vencido:  ['red',    'Vencido'],
      cancelado:['gray',   'Cancelado'],
      ativo:    ['green',  'Ativo'],
      inativo:  ['gray',   'Inativo'],
      presente: ['green',  'Presente'],
      falta:    ['red',    'Falta'],
    };
    const [color, label] = map[status] || ['gray', status];
    return `<span class="badge badge-${color}">${label}</span>`;
  },

  // Categoria de despesa
  expenseCategory(cat) {
    const map = {
      agua:    { icon: 'fa-droplet',      label: 'Água',        color: 'blue'   },
      luz:     { icon: 'fa-bolt',         label: 'Energia',     color: 'yellow' },
      salario: { icon: 'fa-users',        label: 'Salário',     color: 'purple' },
      imposto: { icon: 'fa-file-invoice', label: 'Imposto',     color: 'red'    },
      outros:  { icon: 'fa-ellipsis',     label: 'Outros',      color: 'gray'   },
    };
    return map[cat] || { icon: 'fa-circle', label: cat, color: 'gray' };
  },

  // Letra de nota
  gradeLabel(grade) {
    if (grade >= 9) return 'A';
    if (grade >= 7) return 'B';
    if (grade >= 5) return 'C';
    if (grade >= 3) return 'D';
    return 'F';
  },

  // Calcular % de presença
  attendancePercent(studentId) {
    const records = DB.getStudentAttendance(studentId);
    if (!records.length) return 0;
    const present = records.filter(r => r.status === 'presente').length;
    return Math.round((present / records.length) * 100);
  },

  // Gerar código PIX fake
  generatePix(amount, name) {
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    return `00020126330014BR.GOV.BCB.PIX0111escola@pix52040000530398654${String(amount.toFixed(2)).replace('.','').padStart(7,'0')}5802BR5913${name.replace(/\s/g,'').substring(0,13).padEnd(13,'X')}6009SAO PAULO62070503${rand}6304${Math.floor(Math.random()*9999).toString().padStart(4,'0')}`;
  },

  // Verificar se boleto vence em ≤5 dias
  isDueSoon(dueDateStr) {
    const due = new Date(dueDateStr);
    const now = new Date();
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 5;
  },

  // Verificar se está vencido
  isOverdue(dueDateStr) {
    return new Date(dueDateStr) < new Date();
  },

  // Toast notification
  toast(msg, type = 'default') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle', default: 'fa-bell' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.default}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  // Modal genérico
  modal(title, bodyHTML, footerHTML = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  },

  // Confirmar ação
  confirm(msg, onConfirm) {
    const overlay = Utils.modal(
      'Confirmar ação',
      `<p>${msg}</p>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
       <button class="btn btn-danger" id="confirmBtn">Confirmar</button>`
    );
    overlay.querySelector('#confirmBtn').onclick = () => { onConfirm(); overlay.remove(); };
  },

  // Escapar HTML
  escape(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  // ==========================
  // Máscaras / Filtros de input
  // ==========================

  // Nome: apenas letras (inclui acentuadas), espaços, hífen e apóstrofo
  maskName(v) {
    return String(v || '').replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/g, '').slice(0, 80);
  },

  // Telefone BR: apenas dígitos, formata (00) 00000-0000 — máximo 11 dígitos
  maskPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  },

  // CNPJ alfanumérico (novo formato 2026): 12 alfanuméricos + 2 dígitos verificadores
  // Formato visual: XX.XXX.XXX/XXXX-00 — aceita A-Z0-9, máximo 14 chars raw
  maskCnpj(v) {
    const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
    if (s.length === 0) return '';
    if (s.length <= 2) return s;
    if (s.length <= 5) return `${s.slice(0,2)}.${s.slice(2)}`;
    if (s.length <= 8) return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5)}`;
    if (s.length <= 12) return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8)}`;
    return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
  },

  // Aplica máscara a um input de forma consistente preservando a posição do cursor
  _applyMask(el, fn) {
    const raw = el.value;
    const masked = fn(raw);
    if (raw !== masked) el.value = masked;
  },
};

// Delegação global: aplica máscara conforme data-mask="name|phone|cnpj"
document.addEventListener('input', (e) => {
  const t = e.target;
  if (!t || !t.dataset || !t.dataset.mask) return;
  const map = { name: Utils.maskName, phone: Utils.maskPhone, cnpj: Utils.maskCnpj };
  const fn = map[t.dataset.mask];
  if (fn) Utils._applyMask(t, fn);
});
