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
  // walletId opcional: se fornecido, busca saldo da subconta; senão, saldo da conta principal
  async getBalance(walletId = null) {
    return this._call('getBalance', { walletId });
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

  // ── RECUPERAR/GERAR API KEY DA SUBCONTA ──────
  // Usado quando escola foi criada sem salvar asaasSubApiKey
  // Usa a chave master do proxy — operação administrativa segura
  async refreshSubaccountApiKey(accountId) {
    return this._call('refreshSubaccountApiKey', { accountId });
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
    //    Asaas SEMPRE desconta: R$1,99 de taxa PIX
    //    GestEscolar SEMPRE desconta: 3% de comissão (sobre o líquido após taxa Asaas)
    //    Fórmula: Bruto - R$1,99 (taxa Asaas) - 3% (comissão sobre líquido) = Escola recebe
    const grossValue = chargeAmount;
    const ASAAS_PIX_FEE = 1.99;
    const commissionRate = Number(school.commissionRate) || 3;

    // Passo 1: Asaas desconta sua taxa
    const netAfterAsaasFee = grossValue - ASAAS_PIX_FEE;

    // Passo 2: GestEscolar desconta comissão sobre o líquido
    const commissionGestEscolar = netAfterAsaasFee * (commissionRate / 100);

    // Passo 3: Escola recebe o restante
    const schoolReceives = Number((netAfterAsaasFee - commissionGestEscolar).toFixed(2));

    // Validação: valor mínimo
    const minValue = ASAAS_PIX_FEE + 0.50; // Mínimo: taxa Asaas + R$0,50
    if (grossValue < minValue) {
      Utils.toast(`Valor muito baixo para PIX. Mínimo R$ ${minValue.toFixed(2)}.`, 'error');
      return null;
    }

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

    // 4. Salvar asaas_id na invoice (NÃO define paymentMethod aqui — só quando pago)
    // paymentMethod é definido somente no momento do pagamento:
    //   'pix_asaas' → webhook do Asaas confirma pagamento via PIX
    //   'especie'   → usuário marca manualmente como recebido em espécie
    DB.updateInvoice(invoice.id, { asaasId: charge.id });

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
