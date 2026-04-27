// =============================================
//  GESTESCOLAR – PÁGINA DE CHECKOUT
//  Layout side-by-side: Cadastro + Pagamento
// =============================================

Router.register('checkout', (params = {}) => {
  const planId = params.planId || localStorage.getItem('selectedPlan') || 'free';
  const plan = Plans.get(planId);
  const isAnual = params.annual || localStorage.getItem('billingMode') === 'anual';
  const basePrice = Plans.getPrice(plan);
  const total = isAnual ? parseFloat((basePrice * 12).toFixed(2)) : basePrice;

  if (plan.price === 0) {
    Router.go('school-register');
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="checkout-page-wrapper">

    <!-- ═══ NAVBAR ═══ -->
    <nav class="lp-nav" id="lpNav" style="position:sticky;top:0;z-index:100;">
      <div class="lp-nav-inner">
        <a class="lp-logo" href="#" onclick="event.preventDefault();Router.go('landing')">
          <i class="fa-solid fa-graduation-cap"></i> GestEscolar
        </a>
        <div class="lp-nav-links" id="lpNavLinks">
          <a onclick="Router.go('landing')">Início</a>
          <a onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('features'),300)">Funcionalidades</a>
          <a onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('plans'),300)">Planos</a>
          <a onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('faq'),300)">FAQ</a>
        </div>
        <div class="lp-nav-btns">
          <button class="lp-btn lp-btn-outline lp-btn-nav" onclick="Router.go('login')">
            <i class="fa-solid fa-right-to-bracket"></i> Entrar
          </button>
        </div>
        <button class="lp-hamburger" onclick="document.getElementById('lpNavLinks').classList.toggle('open')">
          <i class="fa-solid fa-bars"></i>
        </button>
      </div>
    </nav>

    <!-- ═══ CHECKOUT ═══ -->
    <div class="checkout-container">
      <!-- ESQUERDA: FORMULÁRIO DE CADASTRO -->
      <div class="checkout-left">
        <div class="checkout-form-wrapper">
          <div style="margin-bottom:24px;">
            <h2 style="margin:0 0 6px;font-size:24px;font-weight:900;">
              <i class="fa-solid fa-graduation-cap" style="color:var(--primary);margin-right:8px;"></i>
              Criar sua Escola
            </h2>
            <p style="color:var(--text-muted);font-size:13px;margin:0;">
              Preencha os dados para começar o cadastro
            </p>
          </div>

          <form id="checkoutForm">
            <div id="checkout-alert"></div>

            <!-- SEÇÃO 1: Dados da Escola -->
            <div class="checkout-section">
              <h4 class="checkout-section-title">
                <i class="fa-solid fa-school" style="color:var(--primary);"></i> Dados da Escola
              </h4>

              <div class="form-group">
                <label class="form-label">Tipo de pessoa *</label>
                <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap;">
                  <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:6px;flex:1;min-width:120px;">
                    <input type="radio" name="coPersonType" value="PJ" checked onchange="CheckoutPage._togglePersonType()" />
                    <span><strong>PJ</strong><br><small style="color:var(--text-muted);">Pessoa Jurídica</small></span>
                  </label>
                  <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:6px;flex:1;min-width:120px;">
                    <input type="radio" name="coPersonType" value="MEI" onchange="CheckoutPage._togglePersonType()" />
                    <span><strong>MEI</strong><br><small style="color:var(--text-muted);">Microempreendedor</small></span>
                  </label>
                  <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:6px;flex:1;min-width:120px;">
                    <input type="radio" name="coPersonType" value="CPF" onchange="CheckoutPage._togglePersonType()" />
                    <span><strong>CPF</strong><br><small style="color:var(--text-muted);">Pessoa Física</small></span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Nome da escola / Responsável *</label>
                <input type="text" class="form-control" id="coSchoolName"
                  placeholder="Ex: Escola Exemplo LTDA" maxlength="100" required />
              </div>

              <div class="checkout-row">
                <div class="form-group">
                  <label class="form-label" id="coCnpjLabel">CNPJ *</label>
                  <input type="text" class="form-control" id="coCnpj"
                    placeholder="00.000.000/0000-00" maxlength="18" required
                    data-mask="cnpj" />
                </div>
                <div class="form-group">
                  <label class="form-label">Telefone *</label>
                  <input type="tel" class="form-control" id="coPhone"
                    placeholder="(00) 00000-0000" maxlength="15" required
                    data-mask="phone" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">E-mail da escola *</label>
                <input type="email" class="form-control" id="coSchoolEmail"
                  placeholder="seu@escola.com" required />
              </div>
            </div>

            <!-- SEÇÃO 2: Dados do Gestor -->
            <div class="checkout-section">
              <h4 class="checkout-section-title">
                <i class="fa-solid fa-user-tie" style="color:var(--primary);"></i> Gestor Responsável
              </h4>

              <div class="form-group">
                <label class="form-label">Nome completo *</label>
                <input type="text" class="form-control" id="coName"
                  placeholder="Ex: João Silva" maxlength="80" required />
              </div>

              <div class="checkout-row">
                <div class="form-group">
                  <label class="form-label">E-mail *</label>
                  <input type="email" class="form-control" id="coEmail"
                    placeholder="joao@escola.com" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Senha *</label>
                  <input type="password" class="form-control" id="coPassword"
                    placeholder="Mín. 6 caracteres" minlength="6" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Confirmar senha *</label>
                <input type="password" class="form-control" id="coPasswordConfirm"
                  placeholder="Repita a senha" required />
              </div>
            </div>

            <!-- SEÇÃO 3: Endereço -->
            <div class="checkout-section">
              <h4 class="checkout-section-title">
                <i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> Endereço
              </h4>

              <div class="form-group">
                <label class="form-label">CEP *</label>
                <input type="text" class="form-control" id="coPostalCode"
                  placeholder="00000-000" maxlength="9" required data-mask="postal" />
              </div>

              <div class="form-group">
                <label class="form-label">Endereço *</label>
                <input type="text" class="form-control" id="coAddress"
                  placeholder="Rua, avenida, etc" maxlength="100" required />
              </div>

              <div class="checkout-row">
                <div class="form-group">
                  <label class="form-label">Número *</label>
                  <input type="text" class="form-control" id="coAddressNumber"
                    placeholder="123" maxlength="10" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Complemento</label>
                  <input type="text" class="form-control" id="coComplement"
                    placeholder="Apt, sala, etc" maxlength="50" />
                </div>
              </div>

              <div class="checkout-row">
                <div class="form-group">
                  <label class="form-label">Cidade *</label>
                  <input type="text" class="form-control" id="coCity"
                    placeholder="São Paulo" maxlength="50" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Estado *</label>
                  <input type="text" class="form-control" id="coState"
                    placeholder="SP" maxlength="2" required />
                </div>
              </div>
            </div>

            <div class="checkout-section">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;">
                <input type="checkbox" id="coTerms" required />
                <span>Concordo com os <strong>Termos de Serviço</strong> e <strong>Política de Privacidade</strong></span>
              </label>
            </div>
          </form>
        </div>
      </div>

      <!-- DIREITA: PAGAMENTO -->
      <div class="checkout-right">

        <!-- Título do produto -->
        <div class="checkout-product-header">
          <div class="checkout-product-title">
            <i class="fa-solid fa-graduation-cap"></i>
            <div>
              <div class="checkout-product-name">${Utils.escape(plan.name)}</div>
              <div class="checkout-product-price">${Utils.currency(total)}<span>${isAnual ? '/ano' : '/mês'}</span></div>
            </div>
          </div>
          ${isAnual && plan.price > 0 ? `
            <div class="checkout-saving-badge">💰 Economia de ${Utils.currency(Plans.getAnnualSavings(plan))}/ano</div>
          ` : ''}
        </div>

        <!-- Formulário de Pagamento -->
        <div class="checkout-payment">
          <!-- Tabs: Cartão | PIX -->
          <div class="checkout-payment-tabs">
            <button class="checkout-tab active" onclick="CheckoutPage.switchTab('card')" data-tab="card">
              <i class="fa-solid fa-credit-card"></i> Cartão de Crédito
            </button>
            <button class="checkout-tab" onclick="CheckoutPage.switchTab('pix')" data-tab="pix">
              <i class="fa-brands fa-pix"></i> PIX
            </button>
          </div>

          <!-- TAB: Cartão -->
          <div id="tab-card" class="checkout-tab-content active">

            <!-- Animação do Cartão -->
            <div class="cc-scene">
              <div class="cc-card" id="ccCard">
                <!-- Frente -->
                <div class="cc-front">
                  <div class="cc-front-top">
                    <div class="cc-chip"></div>
                    <div class="cc-brand-logo" id="ccBrandLogo">
                      <i class="fa-solid fa-credit-card" style="font-size:22px;opacity:.6;"></i>
                    </div>
                  </div>
                  <div class="cc-number" id="ccDispNumber">•••• •••• •••• ••••</div>
                  <div class="cc-front-bottom">
                    <div>
                      <div class="cc-label">TITULAR</div>
                      <div class="cc-holder" id="ccDispHolder">NOME DO TITULAR</div>
                    </div>
                    <div>
                      <div class="cc-label">VALIDADE</div>
                      <div class="cc-expiry" id="ccDispExpiry">MM/AA</div>
                    </div>
                  </div>
                </div>
                <!-- Verso -->
                <div class="cc-back">
                  <div class="cc-stripe"></div>
                  <div class="cc-sig-row">
                    <div class="cc-sig"></div>
                    <div class="cc-cvv-box">
                      <div class="cc-label" style="color:#333;font-size:9px;">CVV</div>
                      <div class="cc-cvv-val" id="ccDispCvv">•••</div>
                    </div>
                  </div>
                  <div class="cc-back-logo"><i class="fa-solid fa-graduation-cap" style="color:rgba(255,255,255,.3);font-size:20px;"></i></div>
                </div>
              </div>
            </div>

            <!-- Campos do Cartão (required aplicado via JS conforme aba ativa) -->
            <div class="form-group" style="margin-top:20px;">
              <label class="form-label">Número do cartão *</label>
              <input type="text" class="form-control cc-field" id="coCardNumber"
                placeholder="0000 0000 0000 0000" maxlength="19" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div class="form-group">
                <label class="form-label">Validade *</label>
                <input type="text" class="form-control cc-field" id="coCardExpiry"
                  placeholder="MM/AA" maxlength="5" />
              </div>
              <div class="form-group">
                <label class="form-label">CVV *</label>
                <input type="text" class="form-control cc-field" id="coCardCvv"
                  placeholder="•••" maxlength="4" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Nome do titular *</label>
              <input type="text" class="form-control cc-field" id="coCardHolder"
                placeholder="JOÃO SILVA" maxlength="80" />
            </div>

            <div class="form-group">
              <label class="form-label">CPF do titular *</label>
              <input type="text" class="form-control cc-field" id="coCardCpf"
                placeholder="000.000.000-00" maxlength="14" data-mask="cpf" />
            </div>
          </div>

          <!-- TAB: PIX -->
          <div id="tab-pix" class="checkout-tab-content">
            <div style="text-align:center;padding:32px 24px;">
              <div style="width:80px;height:80px;background:linear-gradient(135deg,#32bcad,#1a9e90);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
                <i class="fa-brands fa-pix" style="font-size:36px;color:#fff;"></i>
              </div>
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#333;">Pague via PIX</p>
              <p style="margin:0;font-size:13px;color:#888;">O QR Code será gerado após confirmar o cadastro. Pagamento confirmado em segundos.</p>
            </div>
          </div>

          <!-- Cupom de Desconto -->
          <div class="checkout-coupon">
            <div style="display:flex;gap:8px;">
              <input type="text" class="form-control" id="coCouponCode"
                placeholder="Código do cupom" maxlength="20" style="flex:1;" />
              <button type="button" class="btn btn-outline btn-sm"
                onclick="CheckoutPage.applyCoupon()" style="white-space:nowrap;">
                <i class="fa-solid fa-tag"></i> Aplicar
              </button>
            </div>
            <div id="coCouponMsg" style="font-size:12px;margin-top:6px;display:none;"></div>
          </div>

          <!-- Resumo do Pedido -->
          <div class="checkout-summary">
            <div class="checkout-summary-row">
              <span>Subtotal</span>
              <span>${Utils.currency(basePrice)}</span>
            </div>
            ${isAnual ? `
              <div class="checkout-summary-row">
                <span>12 meses (2 meses grátis)</span>
                <span style="color:var(--secondary);font-weight:600;">-${Utils.currency(plan.price * 2)}</span>
              </div>
            ` : ''}
            <div id="coCouponDiscount" class="checkout-summary-row" style="display:none;color:var(--secondary);">
              <span>Desconto</span>
              <span id="coCouponDiscountValue">-R$ 0</span>
            </div>
            <div class="checkout-summary-row" style="border-top:1px solid var(--border);padding-top:10px;font-weight:700;font-size:16px;">
              <span>Total</span>
              <span id="coTotalValue">${Utils.currency(total)}</span>
            </div>
          </div>

          <!-- Botão de Compra -->
          <button type="button" class="btn btn-primary w-100" style="font-size:15px;padding:14px;margin-top:8px;"
            id="coSubmitBtn" onclick="CheckoutPage.submit('${planId}')">
            <i class="fa-solid fa-lock"></i> Finalizar Compra — ${Utils.currency(total)}
          </button>

          <div style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:12px;">
            <i class="fa-solid fa-shield"></i> Pagamento seguro · Processado pelo Asaas
          </div>
        </div>
      </div>
    </div><!-- /checkout-container -->

    <!-- ═══ FOOTER ═══ -->
    <footer class="lp-footer">
      <div class="lp-footer-inner">
        <div>
          <div class="lp-footer-brand"><i class="fa-solid fa-graduation-cap"></i> GestEscolar</div>
          <p>Plataforma SaaS de gestão escolar. Simplifique matrículas, financeiro, notas e comunicação da sua instituição.</p>
        </div>
        <div>
          <h4>Plataforma</h4>
          <ul>
            <li><a href="#" onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('features'),300)">Funcionalidades</a></li>
            <li><a href="#" onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('plans'),300)">Planos</a></li>
            <li><a href="#" onclick="Router.go('landing');setTimeout(()=>LandingPage.scrollTo('coming'),300)">Em breve</a></li>
          </ul>
        </div>
        <div>
          <h4>Acesso</h4>
          <ul>
            <li><a href="#" onclick="Router.go('login')">Login</a></li>
            <li><a href="#" onclick="Router.go('landing')">Página inicial</a></li>
          </ul>
        </div>
        <div>
          <h4>Contato</h4>
          <ul>
            <li><a href="mailto:geste.escolar@gmail.com"><i class="fa-solid fa-envelope"></i> geste.escolar@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div class="lp-footer-bottom">
        <span>© 2026 GestEscolar. Todos os direitos reservados. LGPD compliant.</span>
        <div class="lp-footer-social">
          <a href="#" title="Instagram"><i class="fa-brands fa-instagram"></i></a>
          <a href="#" title="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>
          <a href="#" title="YouTube"><i class="fa-brands fa-youtube"></i></a>
        </div>
      </div>
    </footer>

    </div><!-- /checkout-page-wrapper -->
  `;

  // Scroll ao topo (após renderização do DOM)
  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 50);

  // Máscara CNPJ
  document.getElementById('coCnpj')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 14);
    v = v.replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    e.target.value = v;
  });

  // ── Animação do cartão ─────────────────────────────────────
  const brands = {
    visa:       { name:'VISA',       bg:'linear-gradient(135deg,#1a1f71,#2563eb)', logo:'<span style="font-size:20px;font-style:italic;font-weight:900;letter-spacing:-1px;color:#fff;">VISA</span>' },
    mastercard: { name:'Mastercard', bg:'linear-gradient(135deg,#1a1a2e,#eb5757)', logo:'<span style="display:flex;"><span style="width:24px;height:24px;border-radius:50%;background:#e31837;opacity:.9;"></span><span style="width:24px;height:24px;border-radius:50%;background:#f79e1b;margin-left:-10px;opacity:.9;"></span></span>' },
    amex:       { name:'Amex',       bg:'linear-gradient(135deg,#2e5f8a,#6bb0d7)', logo:'<span style="font-size:13px;font-weight:900;color:#fff;letter-spacing:1px;">AMEX</span>' },
    elo:        { name:'Elo',        bg:'linear-gradient(135deg,#000,#333)',        logo:'<span style="font-size:16px;font-weight:900;color:#ffcc00;">elo</span>' },
    default:    { name:'',           bg:'linear-gradient(135deg,#1a73e8,#0d47a1)', logo:'<i class="fa-solid fa-credit-card" style="font-size:22px;opacity:.6;color:#fff;"></i>' },
  };

  function detectBrand(num) {
    if (/^4/.test(num)) return 'visa';
    if (/^5[1-5]|^2[2-7]/.test(num)) return 'mastercard';
    if (/^3[47]/.test(num)) return 'amex';
    if (/^6(?:011|5)/.test(num)) return 'elo';
    return 'default';
  }

  function updateCard() {
    const numRaw  = (document.getElementById('coCardNumber')?.value || '').replace(/\s/g,'');
    const holder  = (document.getElementById('coCardHolder')?.value || '').toUpperCase() || 'NOME DO TITULAR';
    const expiry  = document.getElementById('coCardExpiry')?.value || 'MM/AA';
    const cvv     = document.getElementById('coCardCvv')?.value || '';

    // Número formatado com bullets
    const parts = numRaw.padEnd(16,'•').match(/.{1,4}/g) || [];
    document.getElementById('ccDispNumber').textContent = parts.join(' ');

    // Titular
    document.getElementById('ccDispHolder').textContent = holder.substring(0, 22) || 'NOME DO TITULAR';

    // Validade
    document.getElementById('ccDispExpiry').textContent = expiry || 'MM/AA';

    // CVV
    document.getElementById('ccDispCvv').textContent = cvv ? cvv.replace(/./g,'•') : '•••';

    // Bandeira
    const brand = detectBrand(numRaw);
    const b = brands[brand];
    document.getElementById('ccBrandLogo').innerHTML = b.logo;
    document.querySelector('.cc-front').style.background = b.bg;
  }

  // Cartão: número com espaços
  document.getElementById('coCardNumber')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    updateCard();
  });

  // Cartão: titular
  document.getElementById('coCardHolder')?.addEventListener('input', updateCard);

  // Cartão: validade MM/AA
  document.getElementById('coCardExpiry')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1/$2').substring(0, 5);
    updateCard();
  });

  // CVV: vira o cartão
  document.getElementById('coCardCvv')?.addEventListener('focus', () => {
    document.getElementById('ccCard')?.classList.add('flipped');
  });
  document.getElementById('coCardCvv')?.addEventListener('blur', () => {
    document.getElementById('ccCard')?.classList.remove('flipped');
  });
  document.getElementById('coCardCvv')?.addEventListener('input', updateCard);

  // CPF
  document.getElementById('coCardCpf')?.addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1-$2');
    e.target.value = v;
  });
});

const CheckoutPage = {
  _activeCoupon: null,

  switchTab(tab) {
    // Atualizar botões
    document.querySelectorAll('.checkout-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    // Atualizar conteúdo
    document.querySelectorAll('.checkout-tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `tab-${tab}`);
    });
  },

  async applyCoupon() {
    const code = document.getElementById('coCouponCode')?.value.trim().toUpperCase();
    const msg = document.getElementById('coCouponMsg');
    if (!code) return;

    const { data, error } = await supabaseClient
      .from('platform_settings')
      .select('*')
      .eq('group', 'coupons')
      .eq('key', code)
      .single();

    if (error || !data) {
      if (msg) {
        msg.style.display = 'block';
        msg.style.color = 'var(--danger)';
        msg.textContent = '❌ Cupom inválido ou expirado';
      }
      return;
    }

    this._activeCoupon = { code: data.key, discount: parseFloat(data.value) || 0 };
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = 'var(--secondary)';
      msg.textContent = `✅ Cupom aplicado: ${this._activeCoupon.discount}% de desconto`;
    }

    // Recalcular total
    const planId = (new URL(window.location)).searchParams.get('planId') || localStorage.getItem('selectedPlan');
    const plan = Plans.get(planId);
    const isAnual = localStorage.getItem('billingMode') === 'anual';
    const basePrice = Plans.getPrice(plan);
    const baseTotal = isAnual ? parseFloat((basePrice * 12).toFixed(2)) : basePrice;
    const total = parseFloat((baseTotal * (1 - this._activeCoupon.discount / 100)).toFixed(2));

    document.getElementById('coCouponDiscount').style.display = 'grid';
    document.getElementById('coCouponDiscountValue').textContent = `-${Utils.currency(baseTotal - total)}`;
    document.getElementById('coTotalValue').textContent = Utils.currency(total);
    document.getElementById('coSubmitBtn').textContent = `<i class="fa-solid fa-lock"></i> Finalizar Compra — ${Utils.currency(total)}`;
  },

  // ── Detecta aba ativa (card | pix) ─────────────────────────
  _activeTab() {
    return document.querySelector('.checkout-tab.active')?.dataset.tab || 'card';
  },

  // ── Alterna máscara/label CNPJ ↔ CPF ─────────────────────────
  _togglePersonType() {
    const t = document.querySelector('input[name="coPersonType"]:checked')?.value || 'PJ';
    const lbl = document.getElementById('coCnpjLabel');
    const inp = document.getElementById('coCnpj');
    if (!lbl || !inp) return;
    if (t === 'CPF') {
      lbl.textContent = 'CPF *';
      inp.setAttribute('data-mask', 'cpf');
      inp.setAttribute('maxlength', '14');
      inp.setAttribute('placeholder', '000.000.000-00');
    } else {
      lbl.textContent = 'CNPJ *';
      inp.setAttribute('data-mask', 'cnpj');
      inp.setAttribute('maxlength', '18');
      inp.setAttribute('placeholder', '00.000.000/0000-00');
    }
    inp.value = '';
  },

  // ── Coleta dados do formulário ──────────────────────────────
  _formData() {
    return {
      personType:  document.querySelector('input[name="coPersonType"]:checked')?.value || 'PJ',
      schoolName:  document.getElementById('coSchoolName')?.value.trim(),
      cnpj:        document.getElementById('coCnpj')?.value.replace(/\D/g,''),
      phone:       document.getElementById('coPhone')?.value.replace(/\D/g,''),
      schoolEmail: document.getElementById('coSchoolEmail')?.value.trim(),
      name:        document.getElementById('coName')?.value.trim(),
      email:       document.getElementById('coEmail')?.value.trim().toLowerCase(),
      password:    document.getElementById('coPassword')?.value,
      passwordConfirm: document.getElementById('coPasswordConfirm')?.value,
      postalCode:  document.getElementById('coPostalCode')?.value.replace(/\D/g,''),
      address:     document.getElementById('coAddress')?.value.trim(),
      addressNum:  document.getElementById('coAddressNumber')?.value.trim(),
      complement:  document.getElementById('coComplement')?.value.trim(),
      city:        document.getElementById('coCity')?.value.trim(),
      state:       document.getElementById('coState')?.value.trim(),
    };
  },

  // ── Registra escola (cadastro sem pagamento) ─────────────────
  async _registerSchool(d, planId) {
    // SIGNUP + BOOTSTRAP no backend (service key, email auto-confirmado, bypass RLS)
    console.log('[Checkout] Chamando signupAndBootstrap...');
    const rawRes = await fetch('/api/asaas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signupAndBootstrap',
        data: {
          email: d.email, password: d.password,
          school: {
            name: d.schoolName, cnpj: d.cnpj, phone: d.phone, email: d.schoolEmail,
            planId: planId || 'free', postalCode: d.postalCode, address: d.address,
            addressNumber: d.addressNum, complement: d.complement, city: d.city, state: d.state,
            asaasPersonType: d.personType || 'PJ',
            asaasDocumentsStatus: 'pending', // Aguardando upload de docs pelo gestor
          },
          gestor: { name: d.name, email: d.email, phone: d.phone || '' },
        },
      }),
    });
    const rawText = await rawRes.text();
    console.log('[Checkout] signupAndBootstrap HTTP', rawRes.status, rawText);
    let bootRes;
    try { bootRes = JSON.parse(rawText); } catch (_) { bootRes = { error: 'Resposta inválida do servidor' }; }
    if (!rawRes.ok || bootRes.error || !bootRes.schoolId) {
      throw new Error(`[HTTP ${rawRes.status}] ${bootRes.error || rawText.slice(0, 300) || 'Falha ao criar conta'}`);
    }
    const authId = bootRes.authId;
    const schoolId = bootRes.schoolId;
    const gestorId = bootRes.userId;

    // Agora faz login para obter session token (necessário para /api/asaas das ações autenticadas)
    if (supabaseClient) {
      const { error: siErr } = await supabaseClient.auth.signInWithPassword({ email: d.email, password: d.password });
      if (siErr) {
        console.error('[Checkout] signIn pós-bootstrap falhou:', siErr);
        throw new Error('Conta criada mas não foi possível logar: ' + siErr.message);
      }
      console.log('[Checkout] Login OK após bootstrap');
    }

    // Espelhar no cache local para o resto do fluxo funcionar
    const school = {
      id: schoolId, name: d.schoolName, cnpj: d.cnpj, phone: d.phone, email: d.schoolEmail,
      planId: planId || 'free', ownerId: gestorId,
      postalCode: d.postalCode, address: d.address, addressNumber: d.addressNum,
      complement: d.complement, city: d.city, state: d.state,
      status: 'trial', createdAt: new Date().toISOString(),
      asaasPersonType: d.personType || 'PJ',
      asaasDocumentsStatus: 'pending', // Gestor envia docs depois do login
    };
    if (Array.isArray(DB._cache?.schools)) DB._cache.schools.push(school);
    DB.initSchool(school.id);
    DB.setTenant(school.id);

    const gestor = {
      id: gestorId, authId, schoolId: school.id,
      name: d.name, email: d.email, role: 'gestor',
      phone: '', cpf: '', active: true,
      createdAt: new Date().toISOString(),
    };
    DB._cache.users.push(gestor);
    DB.saveSchoolConfig({ name: d.schoolName, cnpj: d.cnpj, phone: d.phone, logo: '', address: d.address });
    DB.addAuditLog('school_created', `Escola ${d.schoolName} criada via checkout`);

    // Subconta Asaas será criada quando o gestor enviar os documentos KYC
    // (rota admin-asaas-documents). Não criamos aqui para evitar contas pendentes
    // sem documentos no Asaas.

    const session = { id: gestorId, name: d.name, email: d.email, role: 'gestor', schoolId: school.id, schoolName: d.schoolName, planId: planId || 'free' };
    Auth._save(session);

    return { school, session };
  },

  // ── Cria customer Asaas e cobra no cartão ───────────────────
  async _payCard(school, session, planId, d) {
    const plan  = Plans.get(planId);
    const price = Plans.getPrice(plan);
    const isAnual = localStorage.getItem('billingMode') === 'anual';
    const baseTotal = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const coupon = this._activeCoupon;
    const total  = coupon ? Math.max(0.01, parseFloat((baseTotal * (1 - coupon.discount / 100)).toFixed(2))) : baseTotal;

    const holder  = document.getElementById('coCardHolder')?.value.trim();
    const cpf     = document.getElementById('coCardCpf')?.value.replace(/\D/g,'');
    const number  = document.getElementById('coCardNumber')?.value.replace(/\s/g,'');
    const expiry  = document.getElementById('coCardExpiry')?.value.trim();
    const cvv     = document.getElementById('coCardCvv')?.value.trim();
    const [expM, expYShort] = (expiry || '/').split('/');

    const custRes = await Plans._apiCall('createPlanCustomer', {
      name: school.name || d.name, cpfCnpj: school.cnpj || cpf,
      email: school.email || d.email, phone: school.phone,
      externalReference: school.id,
    });
    if (custRes.error) throw new Error(custRes.error);

    const payMethod = isAnual ? 'createPlanCardPayment' : 'createPlanSubscription';
    const payRes = await Plans._apiCall(payMethod, {
      customerId: custRes.id,
      value: total,
      dueDate: new Date().toISOString().slice(0,10),
      description: `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
      externalReference: `${school.id}|${planId}|${isAnual ? 'anual' : 'mensal'}`,
      card: { holderName: holder, number, expiryMonth: expM, expiryYear: '20'+expYShort, ccv: cvv },
      holderEmail: school.email || d.email,
      holderCpf: cpf,
      holderPostalCode: d.postalCode,
      holderAddressNumber: d.addressNum,
      holderPhone: school.phone,
    });
    if (payRes.error) throw new Error(payRes.error);

    await Plans._activatePlan(planId, isAnual ? 'anual' : 'mensal', isAnual ? payRes.id : null, !isAnual ? payRes.id : null);
  },

  // ── Cria cobrança PIX e exibe QR code ──────────────────────
  async _payPix(school, session, planId, d) {
    const plan  = Plans.get(planId);
    const price = Plans.getPrice(plan);
    const isAnual = localStorage.getItem('billingMode') === 'anual';
    const baseTotal = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const coupon = this._activeCoupon;
    const total  = coupon ? Math.max(0.01, parseFloat((baseTotal * (1 - coupon.discount / 100)).toFixed(2))) : baseTotal;

    console.log('[PIX] Iniciando geração de PIX. Total:', total, 'Plan:', planId);

    // VERIFICAR SESSÃO ANTES DE CHAMAR API
    const { data: sess } = await supabaseClient.auth.getSession();
    if (!sess?.session?.access_token) {
      console.error('[PIX] SEM SESSÃO SUPABASE — não é possível gerar PIX');
      throw new Error('Sessão não estabelecida. Verifique se a confirmação de email está desativada no Supabase ou aguarde alguns segundos e tente novamente.');
    }
    console.log('[PIX] Sessão OK, token presente');

    // Pequeno buffer para garantir session token propagado
    await new Promise(r => setTimeout(r, 300));

    // Exibir estado de carregamento imediatamente no painel PIX
    this._showPixLoading(plan.name, total);

    // 1. Criar customer Asaas
    console.log('[PIX] Criando customer Asaas...');
    const custRes = await Plans._apiCall('createPlanCustomer', {
      name: school.name || d.name,
      cpfCnpj: school.cnpj || d.cnpj || '00000000000',
      email: school.email || d.schoolEmail || d.email,
      phone: school.phone || d.phone,
      externalReference: school.id,
    });
    console.log('[PIX] Customer response:', custRes);
    if (custRes.error) throw new Error('Customer: ' + custRes.error);
    if (!custRes.id)  throw new Error('Customer Asaas não criado (id ausente).');

    // 2. Criar cobrança PIX via Asaas (mesma rota usada pelo Plans)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    console.log('[PIX] Criando cobrança PIX...');
    const payRes = await Plans._apiCall('createPlanPixPayment', {
      customerId:        custRes.id,
      value:             total,
      dueDate:           dueDate.toISOString().slice(0, 10),
      description:       `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
      externalReference: `${school.id}|${planId}|${isAnual ? 'anual' : 'mensal'}`,
    });
    console.log('[PIX] Payment response:', payRes);
    if (payRes.error) throw new Error('Pagamento: ' + payRes.error);
    if (!payRes.id)  throw new Error('Cobrança PIX não criada (id ausente).');

    // 3. Buscar QR code
    console.log('[PIX] Buscando QR Code...');
    const qr = await Plans._apiCall('getPixQrCode', { paymentId: payRes.id, plan: true });
    console.log('[PIX] QR response:', qr);
    if (qr.error) throw new Error('QR Code: ' + qr.error);
    if (!qr.encodedImage && !qr.payload) throw new Error('QR Code vazio — resposta inesperada do Asaas.');

    // 4. Exibir QR code no tab-pix
    this._showPixQr({ qr, total, planId, school, charge: payRes });

    // 5. Rolar para o QR
    document.getElementById('tab-pix')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 6. Polling: verificar confirmação a cada 5s por 10 min
    this._pollPix(payRes.id, planId);
  },

  // ── Loading do PIX enquanto API processa ─────────────────────
  _showPixLoading(planName, total) {
    const pixArea = document.getElementById('tab-pix');
    if (!pixArea) return;
    pixArea.innerHTML = `
      <div style="text-align:center;padding:32px 16px;">
        <div style="width:60px;height:60px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,#32bcad,#1a9e90);display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#fff;"></i>
        </div>
        <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:4px;">Gerando QR Code PIX...</div>
        <div style="font-size:12px;color:#888;">${Utils.currency(total)} · ${planName}</div>
        <div style="margin-top:16px;font-size:11px;color:#bbb;">Conectando ao Asaas · Aguarde alguns segundos</div>
      </div>`;
  },

  // ── Renderiza QR Code PIX ───────────────────────────────────
  _showPixQr({ qr, total, planId, school, charge }) {
    const pixArea = document.getElementById('tab-pix');
    if (!pixArea) return;
    const plan = Plans.get(planId);
    const qrImg = qr.encodedImage
      ? `<img src="data:image/png;base64,${qr.encodedImage}" style="width:180px;height:180px;border-radius:12px;" />`
      : `<div style="width:180px;height:180px;background:#f0f0f0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#888;">QR Code indisponível</div>`;

    pixArea.innerHTML = `
      <div style="text-align:center;padding:16px 8px;">
        <div style="font-size:13px;font-weight:700;color:#333;margin-bottom:4px;">Escaneie o QR Code para pagar</div>
        <div style="font-size:12px;color:#888;margin-bottom:16px;">${Utils.currency(total)} · ${plan.name}</div>
        <div style="display:flex;justify-content:center;margin-bottom:16px;">
          <div style="padding:12px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.1);border:2px solid #e0e0e0;">
            ${qrImg}
          </div>
        </div>
        ${qr.payload ? `
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;color:#888;margin-bottom:6px;">Ou copie o código PIX:</div>
            <div style="display:flex;gap:6px;align-items:center;">
              <input type="text" readonly value="${qr.payload}" id="pixCopiaECola"
                style="flex:1;font-size:10px;padding:8px;border:1.5px solid #e0e0e0;border-radius:8px;background:#f8f9fa;min-width:0;" />
              <button onclick="navigator.clipboard.writeText(document.getElementById('pixCopiaECola').value);this.innerHTML='<i class=\'fa-solid fa-check\'></i>';this.style.background='#e8f5e9';this.style.color='#2e7d32';"
                style="padding:8px 12px;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
          </div>
        ` : ''}
        <div id="pixStatus" style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:#888;background:#f8f9fa;padding:10px;border-radius:8px;">
          <i class="fa-solid fa-spinner fa-spin" style="color:var(--primary);"></i>
          Aguardando pagamento...
        </div>
        <div style="font-size:11px;color:#bbb;margin-top:8px;">Válido por 24 horas · Código: ${charge.id?.slice(-6) || '—'}</div>
      </div>`;
  },

  // ── Polling de confirmação PIX ─────────────────────────────
  _pollPix(chargeId, planId) {
    const maxAttempts = 120; // 10 min
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) { clearInterval(interval); return; }
      try {
        const payment = await Plans._apiCall('getPayment', { paymentId: chargeId, plan: true });
        if (payment?.status === 'RECEIVED' || payment?.status === 'CONFIRMED') {
          clearInterval(interval);
          const isAnual = localStorage.getItem('billingMode') === 'anual';
          await Plans._activatePlan(planId, isAnual ? 'anual' : 'mensal', chargeId, null);

          const statusEl = document.getElementById('pixStatus');
          if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4caf50;font-size:18px;"></i> <strong style="color:#2e7d32;">Pagamento confirmado!</strong>';
            statusEl.style.background = '#e8f5e9';
            statusEl.style.border = '1.5px solid #a5d6a7';
          }
          Utils.toast('✅ Pagamento PIX confirmado! Plano ativado.', 'success');
          setTimeout(() => Router.go('admin-dashboard'), 2500);
        }
      } catch(e) { /* silencioso */ }
    }, 5000);
    this._pixInterval = interval;
  },

  // ── Pagar PIX e DEPOIS criar conta (novo fluxo) ─────────────────
  async _payPixWithAccountCreation(planId, d) {
    const plan = Plans.get(planId);
    const price = Plans.getPrice(plan);
    const isAnual = localStorage.getItem('billingMode') === 'anual';
    const baseTotal = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const coupon = this._activeCoupon;
    const total = coupon ? Math.max(0.01, parseFloat((baseTotal * (1 - coupon.discount / 100)).toFixed(2))) : baseTotal;

    console.log('[PIX] Iniciando pagamento (ANTES de criar conta). Total:', total);
    this._showPixLoading(plan.name, total);

    // 1. Criar customer Asaas
    const custRes = await Plans._apiCall('createPlanCustomer', {
      name: d.schoolName,
      cpfCnpj: d.cnpj || '00000000000',
      email: d.schoolEmail || d.email,
      phone: d.phone,
      externalReference: 'temp-' + Date.now(), // temp ref, será atualizado após criar school
    });
    if (custRes.error) throw new Error('Customer: ' + custRes.error);

    // 2. Criar cobrança PIX
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const payRes = await Plans._apiCall('createPlanPixPayment', {
      customerId: custRes.id,
      value: total,
      dueDate: dueDate.toISOString().slice(0, 10),
      description: `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
      externalReference: 'pending-' + Date.now(), // será atualizado
    });
    if (payRes.error) throw new Error('Pagamento: ' + payRes.error);

    // 3. Exibir QR Code
    const qrRes = await Plans._apiCall('getPixQrCode', { paymentId: payRes.id, plan: true });
    if (qrRes.error) throw new Error('QR Code: ' + qrRes.error);
    this._showPixQr({ qr: qrRes, total, planId, school: { name: d.schoolName }, charge: payRes });

    document.getElementById('tab-pix')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 4. Polling: aguarda pagamento E DEPOIS cria a conta
    this._pixPollingWithAccountCreation(payRes.id, planId, d);
  },

  async _pixPollingWithAccountCreation(chargeId, planId, d) {
    const maxAttempts = 120;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        Utils.toast('⏱️ Tempo expirado. Tente novamente.', 'warning');
        return;
      }
      try {
        const payment = await Plans._apiCall('getPayment', { paymentId: chargeId, plan: true });
        if (payment?.status === 'RECEIVED' || payment?.status === 'CONFIRMED') {
          clearInterval(interval);

          // ✅ PAGAMENTO CONFIRMADO — agora criar a conta
          console.log('[PIX] Pagamento confirmado! Criando conta...');
          const statusEl = document.getElementById('pixStatus');
          if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--primary);"></i> Criando sua conta...';
          }

          // Criar school + user
          const { school, session } = await this._registerSchool(d, planId);
          await this._sendAccessEmail(d, d.password, school);

          if (statusEl) {
            statusEl.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4caf50;font-size:18px;"></i> <strong style="color:#2e7d32;">Conta criada! Redirecionando...</strong>';
            statusEl.style.background = '#e8f5e9';
            statusEl.style.border = '1.5px solid #a5d6a7';
          }
          Utils.toast('✅ Conta criada com sucesso!', 'success');
          setTimeout(() => Router.go('admin-dashboard'), 2500);
        }
      } catch(e) {
        console.error('[PIX Polling] erro:', e);
      }
    }, 5000);
  },

  // ── Pagar cartão e DEPOIS criar conta (novo fluxo) ─────────────────
  async _payCardWithAccountCreation(planId, d) {
    const plan = Plans.get(planId);
    const price = Plans.getPrice(plan);
    const isAnual = localStorage.getItem('billingMode') === 'anual';
    const baseTotal = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const coupon = this._activeCoupon;
    const total = coupon ? Math.max(0.01, parseFloat((baseTotal * (1 - coupon.discount / 100)).toFixed(2))) : baseTotal;

    const holder = document.getElementById('coCardHolder')?.value.trim();
    const cpf = document.getElementById('coCardCpf')?.value.replace(/\D/g,'');
    const number = document.getElementById('coCardNumber')?.value.replace(/\s/g,'');
    const expiry = document.getElementById('coCardExpiry')?.value.trim();
    const cvv = document.getElementById('coCardCvv')?.value.trim();
    const [expM, expYShort] = (expiry || '/').split('/');

    // 1. Criar customer
    const custRes = await Plans._apiCall('createPlanCustomer', {
      name: d.schoolName || d.name,
      cpfCnpj: d.cnpj || cpf,
      email: d.schoolEmail || d.email,
      phone: d.phone,
      externalReference: 'temp-' + Date.now(),
    });
    if (custRes.error) throw new Error(custRes.error);

    // 2. Processar pagamento
    const payMethod = isAnual ? 'createPlanCardPayment' : 'createPlanSubscription';
    const payRes = await Plans._apiCall(payMethod, {
      customerId: custRes.id,
      value: total,
      dueDate: new Date().toISOString().slice(0,10),
      description: `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
      externalReference: 'pending-' + Date.now(),
      card: { holderName: holder, number, expiryMonth: expM, expiryYear: '20'+expYShort, ccv: cvv },
      holderEmail: d.schoolEmail || d.email,
      holderCpf: cpf,
      holderPostalCode: d.postalCode,
      holderAddressNumber: d.addressNum,
      holderPhone: d.phone,
    });
    if (payRes.error) throw new Error(payRes.error);

    // ✅ PAGAMENTO APROVADO — criar a conta
    console.log('[Card] Pagamento aprovado! Criando conta...');
    const { school } = await this._registerSchool(d, planId);
    await this._sendAccessEmail(d, d.password, school);
    await Plans._activatePlan(planId, isAnual ? 'anual' : 'mensal', isAnual ? payRes.id : null, !isAnual ? payRes.id : null);
  },

  // ── Enviar email com credenciais de acesso via Resend ────────────
  async _sendAccessEmail(d, password, school) {
    try {
      console.log('[Email] Enviando credenciais para', d.email);
      const emailRes = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendAccessEmail',
          data: {
            email: d.email,
            password: password,
            schoolName: d.schoolName,
            gestorName: d.name,
          },
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.warn('[Email] Erro ao enviar:', emailData.error);
        return; // não bloqueia o fluxo
      }
      console.log('[Email] Enviado com sucesso! ID:', emailData.messageId);
    } catch(e) {
      console.warn('[Email] Erro:', e.message);
      // não bloqueia o fluxo
    }
  },

  async submit(planId) {
    const alertEl = document.getElementById('checkout-alert');
    const btn     = document.getElementById('coSubmitBtn');
    const tab     = this._activeTab();

    const showErr = (msg) => {
      alertEl.innerHTML = `<div class="alert alert-danger" style="background:#ffebee;border:1.5px solid #ef5350;color:#c62828;padding:12px;border-radius:10px;font-weight:600;margin-bottom:16px;">
        <i class="fa-solid fa-circle-exclamation"></i> ${msg}
      </div>`;
      alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // Validar formulário de cadastro
    const form = document.getElementById('checkoutForm');
    if (form && !form.checkValidity()) {
      form.reportValidity();
      showErr('Preencha todos os campos obrigatórios do cadastro (lado esquerdo).');
      return;
    }

    const d = this._formData();
    if (!d.schoolName || !d.email || !d.password) {
      showErr('Preencha os dados da escola e do gestor.');
      return;
    }
    if (d.password !== d.passwordConfirm) {
      showErr('As senhas não conferem.');
      return;
    }
    if (d.password.length < 6) {
      showErr('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    // Para cartão, validar campos do cartão
    if (tab === 'card') {
      const num = document.getElementById('coCardNumber')?.value.replace(/\s/g,'');
      if (!num || num.length < 13) { showErr('Número do cartão inválido.'); return; }
      if (!document.getElementById('coCardExpiry')?.value) { showErr('Preencha a validade do cartão.'); return; }
      if (!document.getElementById('coCardCvv')?.value)    { showErr('Preencha o CVV do cartão.'); return; }
      if (!document.getElementById('coCardHolder')?.value) { showErr('Preencha o nome do titular.'); return; }
      if (!document.getElementById('coCardCpf')?.value)    { showErr('Preencha o CPF do titular.'); return; }
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando sua conta...';
    alertEl.innerHTML = '';

    try {
      const plan = Plans.get(planId);

      // 1. Se for plano gratuito (free trial), cria conta diretamente sem pagamento
      if (plan.price === 0) {
        console.log('[Checkout] Plano gratuito - criando conta com trial...');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando sua conta...';
        const { school, session } = await this._registerSchool(d, planId);
        alertEl.innerHTML = '<div class="alert alert-success" style="background:#e8f5e9;border:1.5px solid #66bb6a;color:#2e7d32;padding:12px;border-radius:10px;font-weight:600;"><i class="fa-solid fa-check-circle"></i> ✅ Conta criada! Redirecionando...</div>';
        await this._sendAccessEmail(d, d.password, school);
        setTimeout(() => Router.go('admin-dashboard'), 2000);
        return;
      }

      // 2. Planos pagos: processar pagamento PRIMEIRO
      if (tab === 'pix') {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando QR Code PIX...';
        this.switchTab('pix');
        // Passar formData para _payPix, que criará a conta após pagamento confirmado
        await this._payPixWithAccountCreation(planId, d);

      } else {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando pagamento...';
        // Passar formData para _payCard, que criará a conta após pagamento
        await this._payCardWithAccountCreation(planId, d);
        alertEl.innerHTML = '<div class="alert alert-success" style="background:#e8f5e9;border:1.5px solid #66bb6a;color:#2e7d32;padding:12px;border-radius:10px;font-weight:600;"><i class="fa-solid fa-check-circle"></i> ✅ Pagamento aprovado! Conta criada e ativada.</div>';
        setTimeout(() => Router.go('admin-dashboard'), 2500);
      }

    } catch (err) {
      console.error('[Checkout] ERRO:', err);
      showErr(err.message || 'Erro desconhecido ao processar compra.');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Tentar Novamente';
      btn.style.background = '';
      btn.style.color = '';
    }
  },
};
