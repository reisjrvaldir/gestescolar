// =============================================
//  GESTESCOLAR – CLIENTE ASAAS (Frontend)
//  Todas as chamadas passam pelo proxy /api/asaas
// =============================================

const AsaasClient = {
  _baseUrl: '/api/asaas',

  // Token Supabase Auth para autenticação no proxy
  async _getToken() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.access_token || null;
  },

  async _call(action, data = {}, opts = {}) {
    const silent = !!opts.silent;
    const token = await this._getToken();
    if (!token) {
      if (!silent) Utils.toast('Sessão expirada. Faça login novamente.', 'error');
      return null;
    }
    try {
      const res = await fetch(this._baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, data }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(`[Asaas] ${action} erro:`, json);
        if (!silent) Utils.toast(json.error || 'Erro na API de pagamentos.', 'error');
        return null;
      }
      return json;
    } catch (err) {
      console.error(`[Asaas] ${action} falha:`, err);
      if (!silent) Utils.toast('Erro de conexão com o servidor de pagamentos.', 'error');
      return null;
    }
  },

  // ── CLIENTES ─────────────────────────────────
  async createCustomer({ name, cpfCnpj, email, phone, externalReference }) {
    return this._call('createCustomer', { name, cpfCnpj, email, phone, externalReference });
  },

  // ── COBRANÇA PIX ─────────────────────────────
  async createPixCharge({ customerId, value, dueDate, description, externalReference, split }) {
    return this._call('createPixCharge', {
      customerId, value, dueDate, description, externalReference, split,
    });
  },

  // ── QR CODE PIX ──────────────────────────────
  async getPixQrCode(paymentId, opts = {}) {
    return this._call('getPixQrCode', { paymentId }, opts);
  },

  // ── CONSULTAR PAGAMENTO ──────────────────────
  async getPayment(paymentId) {
    return this._call('getPayment', { paymentId });
  },

  // ── SALDO ────────────────────────────────────
  async getBalance() {
    return this._call('getBalance', {});
  },

  // ── SOLICITAR SAQUE ──────────────────────────
  async requestWithdraw({ value, pixKey, pixKeyType, description }) {
    return this._call('requestWithdraw', { value, pixKey, pixKeyType, description });
  },

  // ── LISTAR TRANSFERÊNCIAS ────────────────────
  async listTransfers(offset = 0, limit = 20) {
    return this._call('listTransfers', { offset, limit });
  },

  // ── SUBCONTAS ────────────────────────────────
  async createSubaccount({ name, cpfCnpj, email, phone, postalCode, address, addressNumber, complement, province, city, state }) {
    return this._call('createSubaccount', { name, cpfCnpj, email, phone, postalCode, address, addressNumber, complement, province, city, state });
  },

  async getSubaccount(accountId) {
    return this._call('getSubaccount', { accountId });
  },

  // ── HELPER: Gerar cobrança PIX para invoice ──
  async chargeInvoice(invoice, student, school) {
    // Verificação unificada: trial, plano vencido ou escola bloqueada
    if (!Plans.canGeneratePayment(school)) {
      if (Plans.isOnTrial(school)) {
        Plans.showPaymentBlockedOnTrial();
      } else if (Plans.isSchoolBlocked(school)) {
        Plans.showBlockedModal(school);
      } else if (Plans.isPlanExpired(school)) {
        Plans.showExpiredModal(school);
      }
      return null;
    }

    // 1. Buscar/criar cliente Asaas para o aluno
    const resp = (student.responsaveis || [])[0];
    const customerName = resp?.nome || student.parentName || student.name;
    const customerCpf  = resp?.cpf || student.cpf || '';
    const customerEmail = resp?.email || student.parentEmail || '';

    if (!customerCpf) {
      Utils.toast('CPF do responsável obrigatório para gerar cobrança PIX.', 'error');
      return null;
    }

    if (!school.asaasWalletId) {
      Utils.toast('Escola sem subconta Asaas. Crie a subconta no painel superadmin.', 'error');
      return null;
    }

    const customer = await this.createCustomer({
      name: customerName,
      cpfCnpj: customerCpf,
      email: customerEmail || `${student.matricula || student.id}@gestescolar.app`,
      externalReference: student.id,
    });
    if (!customer) return null;

    // 2. Ajustar fatura vencida: aplicar multa + juros e mover dueDate para hoje
    //    (Asaas rejeita cobranças com dueDate no passado)
    const finePercent        = Number(school.finePercent        ?? 2.0);
    const interestDayPercent = Number(school.interestDayPercent ?? 0.033);
    const hojeStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    let chargeAmount = Number(invoice.amount) || 0;
    let chargeDueDate = invoice.dueDate;

    if (invoice.dueDate) {
      const hoje = new Date(hojeStr + 'T00:00:00');
      const due  = new Date(invoice.dueDate + 'T00:00:00');
      if (!isNaN(due.getTime()) && due < hoje) {
        const diasAtraso = Math.floor((hoje - due) / (1000 * 60 * 60 * 24));
        const multa = chargeAmount * (finePercent / 100);
        const juros = chargeAmount * Math.pow(1 + (interestDayPercent / 100), diasAtraso) - chargeAmount;
        chargeAmount = Number((chargeAmount + multa + juros).toFixed(2));
        chargeDueDate = hojeStr; // Asaas exige data >= hoje
      }
    }

    // 3. Calcular split via fixedValue (mais seguro que percentualValue)
    //    O Asaas valida split contra o valor LÍQUIDO (bruto − taxa PIX ~R$1,99).
    //    Reservamos R$2,50 de margem de segurança para a taxa do gateway.
    const grossValue = chargeAmount;
    const gatewayFeeReserve = 2.50; // taxa Asaas PIX (~R$1,99) + margem
    const commissionRate = Number(school.commissionRate) || 3;

    // Valor mínimo para cobrir gateway + comissão + R$0,50 para a escola
    const minValue = gatewayFeeReserve + 0.50 + (gatewayFeeReserve * commissionRate / 100);
    if (grossValue < minValue) {
      Utils.toast(`Valor muito baixo para PIX. Mínimo R$ ${minValue.toFixed(2)}.`, 'error');
      return null;
    }

    // Valor que sobra após taxa do gateway
    const netValue = grossValue - gatewayFeeReserve;
    // Comissão da plataforma (sobre o líquido)
    const platformCommission = netValue * (commissionRate / 100);
    // Escola recebe o restante
    const schoolReceives = Number((netValue - platformCommission).toFixed(2));

    // 4. Criar cobrança PIX com split em valor fixo
    const splitConfig = {
      walletId: school.asaasWalletId,
      fixedValue: schoolReceives,
    };

    const charge = await this.createPixCharge({
      customerId: customer.id,
      value: grossValue,
      dueDate: chargeDueDate,
      description: invoice.description || `Mensalidade - ${student.name}`,
      // Formato schoolId|invoiceId — necessário para a verificação de
      // propriedade (IDOR) no proxy /api/asaas ao buscar o QR Code.
      externalReference: `${school.id}|${invoice.id}`,
      split: splitConfig,
    });

    if (!charge || !charge.id) return null;

    // 4. Salvar asaas_id na invoice
    DB.updateInvoice(invoice.id, { asaasId: charge.id, paymentMethod: 'pix_asaas' });

    // 5. Buscar QR Code
    const qr = await this.getPixQrCode(charge.id);
    if (!qr || !qr.payload) {
      Utils.toast('Cobrança criada mas QR Code indisponível. Tente novamente.', 'error');
      return null;
    }

    return {
      chargeId: charge.id,
      status: charge.status,
      value: charge.value,
      dueDate: charge.dueDate,
      pixCopiaECola: qr.payload,
      pixQrCodeBase64: qr.encodedImage || '',
      invoiceUrl: charge.invoiceUrl,
    };
  },
};
