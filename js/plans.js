// =============================================
//  GESTESCOLAR SaaS – SISTEMA DE PLANOS
// =============================================

const Plans = {
  _billing: 'mensal', // 'mensal' ou 'anual'

  defs: {
    free: {
      id: 'free', name: 'Plano Grátis', price: 0, order: 0,
      desc: 'Ideal para testes de funcionalidades',
      limits: { students: 5, teachers: 1, gestors: 1 },
      features: ['Cadastro de alunos', 'Cadastro automático de responsáveis'],
      newFeatures: ['Cadastro de alunos', 'Cadastro automático de responsáveis'],
      highlight: false,
    },
    gestao_100: {
      id: 'gestao_100', name: 'Plano 100 Alunos', price: 149.90, order: 1,
      desc: 'A Solução que sua Escola Precisa',
      limits: { students: 100, teachers: Infinity, gestors: Infinity },
      features: [
        'Chat interno', 'Documentos', 'Sistema financeiro',
        'Recebimento de mensalidades via PIX', 'Declarações',
        'Notificações', 'Vídeo aulas', 'Suporte via ticket'
      ],
      newFeatures: [
        'Chat interno', 'Documentos', 'Sistema financeiro',
        'Recebimento de mensalidades via PIX', 'Declarações',
        'Notificações', 'Vídeo aulas', 'Suporte via ticket'
      ],
      highlight: false,
    },
    gestao_250: {
      id: 'gestao_250', name: 'Plano 101 a 250 Alunos', price: 249.90, order: 2,
      desc: 'Ideal para escolas de médio porte com controle avançado',
      limits: { students: 250, teachers: Infinity, gestors: Infinity },
      features: [
        'Chat interno', 'Documentos', 'Sistema financeiro',
        'Recebimento de mensalidades via PIX', 'Declarações',
        'Notificações', 'Vídeo aulas', 'Suporte via WhatsApp e Chat'
      ],
      newFeatures: [
        'Suporte via WhatsApp e Chat'
      ],
      highlight: true, // PLANO MAIS ASSINADO
    },
    gestao_unlimited: {
      id: 'gestao_unlimited', name: 'Plano 251+ Alunos', price: 0, order: 3,
      desc: 'Ideal para redes escolares e instituições de grande porte',
      limits: { students: Infinity, teachers: Infinity, gestors: Infinity },
      features: [
        'Chat interno', 'Documentos', 'Sistema financeiro',
        'Recebimento de mensalidades via PIX', 'Declarações',
        'Notificações', 'Vídeo aulas', 'Suporte via WhatsApp e Chat',
        'Relatórios avançados', 'Fichas dos alunos',
        'Transferências', 'Histórico escolar',
        'Upload de documentos', 'API para integrações',
        'Prioridade em novidades', 'Transferência entre escolas'
      ],
      newFeatures: [
        'Relatórios avançados', 'Fichas dos alunos',
        'Transferências', 'Histórico escolar',
        'Upload de documentos', 'API para integrações',
        'Prioridade em novidades', 'Transferência entre escolas'
      ],
      highlight: false,
    }
  },

  get(id)  { return this.defs[id] || this.defs.free; },
  getAll() { return Object.values(this.defs).sort((a,b) => a.order - b.order); },

  hasFeature(planId, feat) {
    const p = this.get(planId);
    return p.features.includes(feat);
  },

  checkLimit(planId, type, count) {
    const plan = this.get(planId);
    const lim  = plan.limits[type];
    if (lim === Infinity || count < lim) return { ok: true, limit: lim, current: count, plan: plan.name };
    const labels = { students: 'alunos', teachers: 'professores', gestors: 'gestores' };
    return {
      ok: false,
      msg: `Você atingiu o limite do plano ${plan.name}. Limite de ${lim} ${labels[type] || type}.`,
      limit: lim, current: count, plan: plan.name,
    };
  },

  showUpgradeModal(msg) {
    Utils.modal(
      'Limite do Plano Atingido',
      `<div style="text-align:center;padding:20px 0;">
        <i class="fa-solid fa-lock" style="font-size:48px;color:var(--primary);margin-bottom:16px;display:block;"></i>
        <p style="font-size:16px;margin-bottom:12px;">${Utils.escape(msg)}</p>
        <p style="color:var(--text-muted);">Faça upgrade para continuar utilizando o sistema.</p>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
       <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove();Router.go('school-plans');">
         <i class="fa-solid fa-rocket"></i> Ver Planos e Fazer Upgrade
       </button>`
    );
  },

  showBlocked(feat) {
    this.showUpgradeModal(`O recurso "${feat}" não está disponível no seu plano atual.`);
  },

  toggleBilling(mode) {
    this._billing = mode;
    const user = Auth.current();
    const school = DB.getSchool(user?.schoolId);
    const planId = school?.planId || user?.planId || 'free';
    const container = document.getElementById('plans-cards-container');
    if (container) container.innerHTML = this._renderAllCards(planId);
    // Update toggle buttons style
    document.querySelectorAll('.billing-toggle-btn').forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.style.background = isActive ? '#1a73e8' : '#fff';
      btn.style.color = isActive ? '#fff' : '#666';
      btn.style.border = isActive ? '2px solid #1a73e8' : '2px solid #ddd';
    });
  },

  getPrice(plan) {
    if (plan.price === 0) return 0;
    if (this._billing === 'anual') return parseFloat((plan.price * 0.85).toFixed(2));
    return plan.price;
  },

  getAnnualSavings(plan) {
    if (plan.price === 0) return 0;
    return parseFloat((plan.price * 12 * 0.15).toFixed(2));
  },

  // Render plan cards HTML
  renderCards(currentPlanId) {
    const isMenusal = this._billing === 'mensal';
    const toggle = `
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:24px;">
        <button class="btn btn-sm billing-toggle-btn" data-mode="mensal"
          onclick="Plans.toggleBilling('mensal')"
          style="padding:8px 20px;border-radius:20px;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;
            background:${isMenusal?'#1a73e8':'#fff'};color:${isMenusal?'#fff':'#666'};border:2px solid ${isMenusal?'#1a73e8':'#ddd'};">
          Mensal
        </button>
        <button class="btn btn-sm billing-toggle-btn" data-mode="anual"
          onclick="Plans.toggleBilling('anual')"
          style="padding:8px 20px;border-radius:20px;font-weight:600;font-size:13px;cursor:pointer;transition:all .2s;
            background:${!isMenusal?'#1a73e8':'#fff'};color:${!isMenusal?'#fff':'#666'};border:2px solid ${!isMenusal?'#1a73e8':'#ddd'};">
          Anual <span style="background:#e8f5e9;color:#2e7d32;font-size:10px;padding:2px 6px;border-radius:8px;margin-left:4px;font-weight:700;">-15%</span>
        </button>
      </div>`;
    return toggle + `<div id="plans-cards-container" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;align-items:stretch;">${this._renderAllCards(currentPlanId)}</div>`;
  },

  _renderAllCards(currentPlanId) {
    const allPlans = this.getAll();
    return allPlans.map((p, idx) => {
      const isCurrent   = p.id === currentPlanId;
      const isUnlimited = p.id === 'gestao_unlimited';
      const isHighlight = p.highlight === true;
      const price       = this.getPrice(p);
      const prevPlan    = idx > 0 ? allPlans[idx - 1] : null;
      const savings     = this.getAnnualSavings(p);

      // Border color: highlight = orange, current = primary, default = border
      const borderColor = isHighlight ? '#ff6d00' : (isCurrent ? 'var(--primary)' : 'var(--border)');

      // Price display
      let priceHtml;
      if (p.price === 0 && p.id === 'free') {
        priceHtml = '<div style="font-size:28px;font-weight:900;color:var(--primary);">Grátis</div>';
      } else if (isUnlimited) {
        priceHtml = '<div style="font-size:22px;font-weight:900;color:var(--primary);">Sob Consulta</div>';
      } else {
        const original = p.price;
        priceHtml = `
          ${this._billing === 'anual' ? `<div style="font-size:13px;color:var(--text-muted);text-decoration:line-through;">De ${Utils.currency(original)}/mês</div>` : ''}
          <div style="font-size:28px;font-weight:900;color:var(--primary);">${Utils.currency(price)}<span style="font-size:13px;font-weight:400;color:var(--text-muted);">/mês</span></div>
          ${this._billing === 'anual' ? `<div style="font-size:12px;color:#2e7d32;font-weight:700;margin-top:4px;background:#e8f5e9;display:inline-block;padding:2px 10px;border-radius:12px;">Economia de ${Utils.currency(savings)}/ano</div>` : ''}`;
      }

      // Savings line for free plan when annual selected
      if (p.id === 'free' && this._billing === 'anual') {
        priceHtml += ''; // Free has no savings
      }

      // Features
      let featHtml = '';
      if (prevPlan && p.id !== 'free') {
        featHtml += `<div style="font-size:12px;margin-bottom:8px;padding:6px 10px;background:#e8f0fe;border-radius:6px;color:#1a73e8;font-weight:600;">
          <i class="fa-solid fa-arrow-up" style="margin-right:4px;"></i>Todos os recursos do ${Utils.escape(prevPlan.name)}
        </div>`;
        p.newFeatures.forEach(f => {
          featHtml += `<div style="font-size:12px;margin-bottom:3px;"><i class="fa-solid fa-check" style="color:var(--secondary);margin-right:4px;"></i>${f}</div>`;
        });
      } else {
        p.features.forEach(f => {
          featHtml += `<div style="font-size:12px;margin-bottom:3px;"><i class="fa-solid fa-check" style="color:var(--secondary);margin-right:4px;"></i>${f}</div>`;
        });
      }

      // Verifica se escola está bloqueada/vencida — nesse caso,
      // o plano atual deve ser pagável (pra renovar) em vez de disabled.
      const _sess = typeof Auth !== 'undefined' ? Auth.current() : null;
      const _school = _sess ? DB.getSchool(_sess.schoolId) : null;
      const _needsRenewal = _school && (this.isSchoolBlocked(_school) || this.isPlanExpired(_school));

      // Button
      let btnHtml;
      if (isCurrent && _needsRenewal) {
        btnHtml = `<button class="btn w-100" style="background:#c62828;color:#fff;font-weight:700;" onclick="Plans.requestUpgrade('${p.id}')">
          <i class="fa-solid fa-credit-card"></i> Renovar Plano Atual
        </button>`;
      } else if (isCurrent) {
        btnHtml = '<button class="btn btn-outline w-100" disabled style="opacity:.6;">Plano Atual</button>';
      } else if (isUnlimited) {
        btnHtml = `<button class="btn btn-primary w-100" onclick="Plans.contactSupport()" style="background:#1a73e8;">
          <i class="fa-solid fa-headset"></i> Entrar em Contato com o Suporte
        </button>`;
      } else if (p.id === 'free') {
        btnHtml = '';
      } else {
        btnHtml = `<button class="btn btn-primary w-100" onclick="Plans.requestUpgrade('${p.id}')">Fazer Upgrade</button>`;
      }

      return `<div class="card" style="display:flex;flex-direction:column;border:2.5px solid ${borderColor};position:relative;height:100%;${isHighlight?'box-shadow:0 4px 20px rgba(255,109,0,.2);':''}">
        ${isCurrent ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;padding:2px 16px;border-radius:12px;font-size:12px;font-weight:700;">PLANO ATUAL</div>' : ''}
        ${isHighlight ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#ff6d00,#ff9100);color:#fff;padding:3px 18px;border-radius:12px;font-size:11px;font-weight:800;letter-spacing:.5px;white-space:nowrap;">⭐ PLANO MAIS ASSINADO</div>' : ''}
        <div style="padding:20px;text-align:center;border-bottom:1px solid var(--border);">
          <h3 style="margin:0 0 4px;text-align:center;">${Utils.escape(p.name)}</h3>
          ${priceHtml}
          <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">${Utils.escape(p.desc)}</p>
        </div>
        <div style="padding:16px;flex:1;">
          <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Limites</div>
          <div style="font-size:13px;margin-bottom:12px;">
            ${p.limits.students===Infinity?'Alunos <strong>ILIMITADOS</strong>':`Até <strong>${p.limits.students}</strong> alunos`}<br>
            ${p.limits.teachers===Infinity?'Professores <strong>ILIMITADOS</strong>':`Até <strong>${p.limits.teachers}</strong> professor(es)`}<br>
            ${p.limits.gestors===Infinity?'Gestores <strong>ILIMITADOS</strong>':`Até <strong>${p.limits.gestors}</strong> gestor(es)`}
          </div>
          <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Recursos inclusos</div>
          ${featHtml}
          <div style="font-size:11px;color:var(--text-muted);margin-top:12px;padding:8px;background:#f8f9fa;border-radius:6px;">
            <i class="fa-solid fa-info-circle" style="margin-right:4px;"></i>Taxa de serviço: 3% sobre cada pagamento recebido.
          </div>
        </div>
        <div style="padding:0 16px 16px;margin-top:auto;">
          ${btnHtml}
        </div>
      </div>`;
    }).join('');
  },

  contactSupport() {
    Utils.modal('Entrar em Contato',
      `<div style="text-align:center;padding:16px;">
        <i class="fa-solid fa-headset" style="font-size:48px;color:var(--primary);margin-bottom:16px;display:block;"></i>
        <p style="font-size:16px;margin-bottom:8px;">Plano <strong>Gestão 251+ Alunos</strong></p>
        <p style="color:var(--text-muted);margin-bottom:20px;">Entre em contato com nosso suporte para receber uma proposta personalizada para sua instituição.</p>
        <div style="background:#f8f9fa;padding:14px;border-radius:8px;margin-bottom:16px;">
          <div style="font-size:13px;margin-bottom:6px;"><i class="fa-solid fa-envelope" style="color:var(--primary);margin-right:6px;"></i>suporte@gestescolar.com.br</div>
          <div style="font-size:13px;"><i class="fa-brands fa-whatsapp" style="color:#25d366;margin-right:6px;"></i>(00) 00000-0000</div>
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>`
    );
  },

  // Abre modal direto no formulário de cartão com botão PIX no topo
  requestUpgrade(planId) {
    this._showCardForm(planId);
  },

  // Abre modal de pagamento obrigatório após cadastro de escola
  _requestPaymentModal(planId, schoolName, email) {
    const plan = this.get(planId);
    if (plan.price === 0) {
      Router.go('admin-dashboard');
      return;
    }
    this._showCardForm(planId, { mandatory: true, schoolName, email });
  },

  // Formulário de cartão com preview visual + botão PIX no topo
  _showCardForm(planId) {
    const plan    = this.get(planId);
    const price   = this.getPrice(plan);
    const isAnual = this._billing === 'anual';
    const total   = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    document.querySelector('.modal-overlay')?.remove();

    Utils.modal(`Assinar ${plan.name}`,
      `<div style="padding:8px 10px 4px;">
        <style>
          @media(max-width:480px){
            #cc-two-col-1,#cc-two-col-2{grid-template-columns:1fr !important;}
          }
        </style>

        <!-- Botão PIX no topo -->
        <button id="pix-top-btn" onclick="Plans._inlinePixForm('${planId}')"
          style="width:100%;padding:11px;border:2px solid #32bcad;border-radius:10px;background:#f0faf9;
                 color:#1a9e8e;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:18px;
                 display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s;">
          <svg width="20" height="20" viewBox="0 0 512 512" fill="#32bcad">
            <path d="M112.57 391.19c20.056 0 38.928-7.808 53.12-22l97.35-97.35c5.734-5.735 15.942-5.735 21.676 0l97.695 97.695c14.193 14.149 33.065 21.957 53.12 21.957h19.134l-122.83 122.83c-41.662 41.662-109.167 41.662-150.83 0L58.856 391.19h53.713zm287.085-271.402c-20.055 0-38.927 7.81-53.12 22.001l-97.695 97.695c-5.995 5.995-15.68 5.995-21.676 0l-97.35-97.35c-14.192-14.192-33.064-22-53.12-22H58.856L181.686 97.313c41.662-41.662 109.167-41.662 150.83 0l122.83 122.83-55.662-.343z"/>
          </svg>
          Pagar com PIX — <strong>${Utils.currency(total)}</strong>
        </button>

        <!-- Divisor -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
          <div style="flex:1;height:1px;background:var(--border);"></div>
          <span style="font-size:12px;color:var(--text-muted);font-weight:600;">ou pague com cartão</span>
          <div style="flex:1;height:1px;background:var(--border);"></div>
        </div>

        <!-- Preview do cartão — proporção real ISO 7810 (1.586:1) -->
        <div style="max-width:360px;margin:0 auto 22px;perspective:1000px;">
          <div id="cc-card-preview" style="
            position:relative;width:100%;aspect-ratio:1.586/1;
            background:linear-gradient(135deg,var(--primary) 0%,#0d47a1 100%);
            border-radius:14px;color:#fff;
            box-shadow:0 10px 30px rgba(26,115,232,.35);
            font-family:'Courier New',monospace;overflow:hidden;">
            <!-- Decorações -->
            <div style="position:absolute;top:-30%;right:-20%;width:60%;aspect-ratio:1;
              border-radius:50%;background:rgba(255,255,255,.08);"></div>
            <div style="position:absolute;bottom:-40%;left:-10%;width:55%;aspect-ratio:1;
              border-radius:50%;background:rgba(255,255,255,.05);"></div>
            <!-- Conteúdo -->
            <div style="position:absolute;inset:0;padding:6% 7%;
              display:flex;flex-direction:column;justify-content:space-between;">
              <!-- Topo: logo + bandeira -->
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:15px;font-weight:700;font-family:sans-serif;letter-spacing:.5px;">GestEscolar</span>
                <span id="cc-brand-label" style="font-size:14px;font-weight:900;letter-spacing:1px;opacity:.9;font-family:sans-serif;"></span>
              </div>
              <!-- Chip -->
              <div style="width:36px;height:26px;border-radius:5px;background:linear-gradient(135deg,#f9d423,#e65c00);"></div>
              <!-- Número: 16 dígitos em uma única linha -->
              <div id="cc-preview-number" style="
                font-size:clamp(13px,4.2vw,17px);
                letter-spacing:2px;font-weight:700;
                white-space:nowrap;text-align:center;
                text-shadow:0 1px 3px rgba(0,0,0,.3);">
                •••• •••• •••• ••••
              </div>
              <!-- Rodapé -->
              <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-size:8px;opacity:.7;margin-bottom:2px;letter-spacing:1px;font-family:sans-serif;">TITULAR</div>
                  <div id="cc-preview-name" style="font-size:12px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">NOME DO TITULAR</div>
                </div>
                <div style="text-align:right;flex-shrink:0;">
                  <div style="font-size:8px;opacity:.7;margin-bottom:2px;letter-spacing:1px;font-family:sans-serif;">VALIDADE</div>
                  <div id="cc-preview-expiry" style="font-size:12px;font-weight:700;">MM/AA</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Campos do formulário -->
        <div style="display:grid;gap:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Número do cartão *</label>
            <input id="cc-number" class="form-control" placeholder="0000 0000 0000 0000" maxlength="19"
              style="font-family:'Courier New',monospace;font-size:15px;letter-spacing:2px;" />
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Nome no cartão *</label>
            <input id="cc-holder" class="form-control" placeholder="Como impresso no cartão" />
          </div>
          <div id="cc-two-col-1" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">Validade *</label>
              <input id="cc-expiry" class="form-control" placeholder="MM/AA" maxlength="5" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">CVV *</label>
              <input id="cc-cvv" class="form-control" placeholder="•••" maxlength="4" type="password" />
            </div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">CPF do titular *</label>
            <input id="cc-cpf" class="form-control" placeholder="000.000.000-00" maxlength="14" />
          </div>
          <div id="cc-two-col-2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">CEP *</label>
              <input id="cc-postal" class="form-control" placeholder="00000-000" maxlength="9" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">Nº do endereço *</label>
              <input id="cc-addr-num" class="form-control" placeholder="Ex: 123" />
            </div>
          </div>
        </div>

          <!-- Cupom de desconto -->
          <div class="form-group" style="margin:0;">
            <label class="form-label">Cupom de desconto <span style="color:var(--text-muted);font-weight:400;">(opcional)</span></label>
            <div style="display:flex;gap:8px;">
              <input id="cc-coupon" class="form-control" placeholder="Ex: DESCONTO99" style="text-transform:uppercase;flex:1;"
                oninput="this.value=this.value.toUpperCase()" />
              <button type="button" class="btn btn-outline" onclick="Plans._applyCoupon('${planId}')" style="white-space:nowrap;">
                <i class="fa-solid fa-tag"></i> Aplicar
              </button>
            </div>
            <div id="cc-coupon-msg" style="font-size:12px;margin-top:4px;display:none;"></div>
          </div>
        </div>

        <div id="cc-error" style="color:var(--danger);font-size:12px;margin-top:10px;display:none;"></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:14px;text-align:center;">
          <i class="fa-solid fa-lock"></i> Pagamento processado com segurança pelo Asaas
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Cancelar</button>
       <button class="btn btn-primary" id="cc-submit-btn" onclick="Plans._submitCard('${planId}')"
         style="background:linear-gradient(135deg,var(--primary),#0d47a1);">
         <i class="fa-solid fa-credit-card"></i> ${isAnual ? 'Pagar ' + Utils.currency(total) : 'Assinar ' + Utils.currency(price) + '/mês'}
       </button>`
    );

    // ── Preview: número do cartão ──
    document.getElementById('cc-number')?.addEventListener('input', e => {
      const raw = e.target.value.replace(/\D/g,'');
      e.target.value = raw.replace(/(.{4})/g,'$1 ').trim().substring(0,19);
      // Monta grupos de 4 com bullet para dígitos não preenchidos
      const padded = raw.substring(0,16).padEnd(16,'•');
      const groups = [padded.slice(0,4), padded.slice(4,8), padded.slice(8,12), padded.slice(12,16)];
      const el = document.getElementById('cc-preview-number');
      if (el) el.textContent = groups.join('  ');
      // Detectar bandeira
      const brand = document.getElementById('cc-brand-label');
      if (brand) {
        if (/^4/.test(raw)) brand.textContent = 'VISA';
        else if (/^5[1-5]|^2[2-7]/.test(raw)) brand.textContent = 'MASTERCARD';
        else if (/^3[47]/.test(raw)) brand.textContent = 'AMEX';
        else if (/^6(?:011|5)/.test(raw)) brand.textContent = 'ELO';
        else brand.textContent = '';
      }
    });
    // ── Preview: nome ──
    document.getElementById('cc-holder')?.addEventListener('input', e => {
      const el = document.getElementById('cc-preview-name');
      if (el) el.textContent = e.target.value.toUpperCase() || 'NOME DO TITULAR';
    });
    // ── Preview: validade ──
    document.getElementById('cc-expiry')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1/$2').substring(0,5);
      const el = document.getElementById('cc-preview-expiry');
      if (el) el.textContent = e.target.value || 'MM/AA';
    });
    // ── Máscaras CPF e CEP ──
    document.getElementById('cc-cpf')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4').substring(0,14);
    });
    document.getElementById('cc-postal')?.addEventListener('input', e => {
      e.target.value = e.target.value.replace(/\D/g,'').replace(/^(\d{5})(\d)/,'$1-$2').substring(0,9);
    });
  },

  // Gera PIX inline substituindo o conteúdo do modal
  async _inlinePixForm(planId) {
    const plan    = this.get(planId);
    const price   = this.getPrice(plan);
    const isAnual = this._billing === 'anual';
    const total   = isAnual ? parseFloat((price * 12).toFixed(2)) : price;

    // Substitui o conteúdo do modal pelo painel PIX
    const body = document.querySelector('.modal-overlay .modal-body');
    const footer = document.querySelector('.modal-overlay .modal-footer');
    const title = document.querySelector('.modal-overlay .modal-title');
    if (title) title.textContent = `PIX – ${plan.name}`;
    if (footer) footer.innerHTML = `<button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Fechar</button>`;
    if (body) body.innerHTML = `
      <div style="text-align:center;padding:16px 0;">
        <div style="font-size:26px;font-weight:900;color:var(--primary);margin-bottom:4px;">${Utils.currency(total)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px;">
          ${isAnual ? 'Cobrança única — plano ativo por 12 meses' : 'Pagamento mensal'}
        </div>
        <div id="pix-plan-area">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:36px;color:var(--primary);"></i>
          <p style="color:var(--text-muted);margin-top:10px;">Gerando código PIX...</p>
        </div>
      </div>`;

    const session = Auth.current();
    const school  = DB.getSchool(session?.schoolId);
    try {
      const custRes = await this._apiCall('createPlanCustomer', {
        name:              school?.name || session.name,
        cpfCnpj:          school?.cnpj || '00000000000',
        email:             school?.email || session.email,
        phone:             school?.phone,
        externalReference: session.schoolId,
      });
      if (custRes.error) throw new Error(custRes.error);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const payRes = await this._apiCall('createPlanPixPayment', {
        customerId:        custRes.id,
        value:             total,
        dueDate:           dueDate.toISOString().slice(0,10),
        description:       `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
        externalReference: `${session.schoolId}|${planId}|${isAnual ? 'anual' : 'mensal'}`,
      });
      if (payRes.error) throw new Error(payRes.error);

      const qrRes  = await this._apiCall('getPixQrCode', { paymentId: payRes.id, plan: true });
      if (qrRes?.error) throw new Error(qrRes.error);
      const area   = document.getElementById('pix-plan-area');
      if (!area) return;

      const pixCode = qrRes?.payload || '';
      const pixId   = 'plan-pix-code';
      area.innerHTML = `
        ${qrRes?.encodedImage
          ? `<img src="data:image/png;base64,${qrRes.encodedImage}"
               style="width:180px;height:180px;border-radius:12px;margin-bottom:14px;border:4px solid var(--border);">`
          : ''}
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">PIX Copia e Cola</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:16px;">
          <input id="${pixId}" class="form-control" value="${Utils.escape(pixCode)}" readonly
            style="font-size:10px;font-family:monospace;flex:1;" />
          <button class="btn btn-outline btn-sm"
            onclick="Utils.copyText(document.getElementById('${pixId}').value);Utils.toast('Código copiado!','success');">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <div class="alert alert-info" style="font-size:12px;text-align:left;">
          <i class="fa-solid fa-info-circle"></i>
          Após o pagamento, seu plano será ativado automaticamente em até 5 minutos.
        </div>`;

      this._pollPlanPix(payRes.id, planId, isAnual ? 'anual' : 'mensal');
    } catch(e) {
      const area = document.getElementById('pix-plan-area');
      if (area) area.innerHTML = `<div style="color:var(--danger);">${e.message || 'Erro ao gerar PIX.'}</div>`;
    }
  },

  _activeCoupon: null, // { code, discount } — preenchido por _applyCoupon

  async _applyCoupon(planId) {
    const code = document.getElementById('cc-coupon')?.value.trim().toUpperCase();
    const msg  = document.getElementById('cc-coupon-msg');
    if (!code) return;

    // Busca cupom ativo no Supabase (platform_settings group=coupons)
    const { data, error } = await supabaseClient
      .from('platform_settings')
      .select('value')
      .eq('group', 'coupons')
      .eq('key', code)
      .single();

    if (error || !data) {
      msg.style.color = 'var(--danger)';
      msg.textContent = '❌ Cupom inválido ou expirado.';
      msg.style.display = 'block';
      this._activeCoupon = null;
      return;
    }

    const cfg = JSON.parse(data.value);
    if (!cfg.active) {
      msg.style.color = 'var(--danger)';
      msg.textContent = '❌ Cupom desativado.';
      msg.style.display = 'block';
      this._activeCoupon = null;
      return;
    }

    this._activeCoupon = { code, discount: cfg.discount };

    const plan  = this.get(planId);
    const price = this.getPrice(plan);
    const isAnual = this._billing === 'anual';
    const total = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const finalValue = Math.max(0.01, parseFloat((total * (1 - cfg.discount / 100)).toFixed(2)));

    msg.style.color = '#2e7d32';
    msg.textContent = `✅ Cupom aplicado! ${cfg.discount}% de desconto — valor: ${Utils.currency(finalValue)}`;
    msg.style.display = 'block';

    // Atualiza label do botão
    const btn = document.getElementById('cc-submit-btn');
    if (btn) btn.innerHTML = `<i class="fa-solid fa-credit-card"></i> ${isAnual ? 'Pagar' : 'Assinar'} ${Utils.currency(finalValue)}`;
  },

  async _submitCard(planId) {
    const holder    = document.getElementById('cc-holder')?.value.trim();
    const cpf       = document.getElementById('cc-cpf')?.value.trim();
    const number    = document.getElementById('cc-number')?.value.replace(/\s/g,'');
    const expiry    = document.getElementById('cc-expiry')?.value.trim();
    const cvv       = document.getElementById('cc-cvv')?.value.trim();
    const postal    = document.getElementById('cc-postal')?.value.trim();
    const addrNum   = document.getElementById('cc-addr-num')?.value.trim();
    const errEl     = document.getElementById('cc-error');
    const btn       = document.getElementById('cc-submit-btn');

    const showErr = msg => { if(errEl){errEl.textContent=msg;errEl.style.display='block';} };

    if (!holder || !cpf || !number || !expiry || !cvv || !postal || !addrNum) {
      return showErr('Preencha todos os campos obrigatórios.');
    }
    if (number.length < 13) return showErr('Número do cartão inválido.');
    const [expM, expY] = expiry.split('/');
    if (!expM || !expY || expM < 1 || expM > 12) return showErr('Validade inválida.');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';

    const session = Auth.current();
    const school  = DB.getSchool(session?.schoolId);
    const plan    = this.get(planId);
    const price   = this.getPrice(plan);
    const isAnual = this._billing === 'anual';
    const baseTotal = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    const coupon  = this._activeCoupon;
    const total   = coupon
      ? Math.max(0.01, parseFloat((baseTotal * (1 - coupon.discount / 100)).toFixed(2)))
      : baseTotal;

    try {
      // 1. Criar/obter customer Asaas
      const custRes = await this._apiCall('createPlanCustomer', {
        name:              school?.name || session.name,
        cpfCnpj:          school?.cnpj || cpf,
        email:             school?.email || session.email,
        phone:             school?.phone,
        externalReference: session.schoolId,
      });
      if (custRes.error) throw new Error(custRes.error);

      const customerId = custRes.id;

      if (isAnual) {
        // Plano anual: cobrança única no cartão (/payments, não /subscriptions)
        const payRes = await this._apiCall('createPlanCardPayment', {
          customerId,
          value:             total,
          dueDate:           new Date().toISOString().slice(0,10),
          description:       `GestEscolar – ${plan.name} (Anual)`,
          externalReference: `${session.schoolId}|${planId}|anual`,
          card: { holderName: holder, number, expiryMonth: expM, expiryYear: '20'+expY, ccv: cvv },
          holderEmail:       school?.email || session.email,
          holderCpf:         cpf,
          holderPostalCode:  postal,
          holderAddressNumber: addrNum,
          holderPhone:       school?.phone,
        });
        if (payRes.error) throw new Error(payRes.error);
        await this._activatePlan(planId, 'anual', payRes.id, null);

      } else {
        // Plano mensal: assinatura recorrente
        const subRes = await this._apiCall('createPlanSubscription', {
          customerId,
          value:             price,
          nextDueDate:       new Date().toISOString().slice(0,10),
          description:       `GestEscolar – ${plan.name} (Mensal)`,
          externalReference: `${session.schoolId}|${planId}|mensal`,
          card: { holderName: holder, number, expiryMonth: expM, expiryYear: '20'+expY, ccv: cvv },
          holderEmail:       school?.email || session.email,
          holderCpf:         cpf,
          holderPostalCode:  postal,
          holderAddressNumber: addrNum,
          holderPhone:       school?.phone,
        });
        if (subRes.error) throw new Error(subRes.error);
        await this._activatePlan(planId, 'mensal', null, subRes.id);
      }

      document.querySelector('.modal-overlay')?.remove();
      Utils.toast('Pagamento aprovado! Plano ativado com sucesso.', 'success');
      Router.go('admin-dashboard');

    } catch(e) {
      const errMsg = e.message || 'Erro ao processar pagamento. Verifique os dados e tente novamente.';
      showErr(errMsg);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-credit-card"></i> Tentar Novamente`;

      // Enviar email notificando erro de pagamento
      try {
        const session = Auth.current();
        const school = DB.getSchool(session?.schoolId);
        await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await Auth.getSession())?.access_token || ''}`,
          },
          body: JSON.stringify({
            to: school?.email || session.email,
            subject: `GestEscolar - Erro no Pagamento do Plano ${plan.name}`,
            template: 'payment_error',
            data: {
              schoolName: school?.name || session.name,
              planName: plan.name,
              error: errMsg,
              timestamp: new Date().toLocaleString('pt-BR'),
            },
          }),
        });
      } catch (emailErr) {
        console.warn('[Email] Erro ao enviar notificação de erro:', emailErr.message);
      }
    }
  },

  // Formulário PIX
  async _showPixForm(planId) {
    const plan    = this.get(planId);
    const price   = this.getPrice(plan);
    const isAnual = this._billing === 'anual';
    const total   = isAnual ? parseFloat((price * 12).toFixed(2)) : price;
    document.querySelector('.modal-overlay')?.remove();

    Utils.modal(`PIX – ${plan.name}`,
      `<div style="text-align:center;padding:16px 0;">
        <div style="font-size:24px;font-weight:900;color:var(--primary);margin-bottom:4px;">
          ${Utils.currency(total)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">
          ${isAnual ? 'Cobrança única — plano ativo por 12 meses' : 'Pagamento mensal'}
        </div>
        <div id="pix-plan-area">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:32px;color:var(--primary);"></i>
          <p style="color:var(--text-muted);margin-top:8px;">Gerando código PIX...</p>
        </div>
      </div>`,
      `<button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Fechar</button>`
    );

    const session = Auth.current();
    const school  = DB.getSchool(session?.schoolId);

    try {
      const custRes = await this._apiCall('createPlanCustomer', {
        name:              school?.name || session.name,
        cpfCnpj:          school?.cnpj || '00000000000',
        email:             school?.email || session.email,
        phone:             school?.phone,
        externalReference: session.schoolId,
      });
      if (custRes.error) throw new Error(custRes.error);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const payRes = await this._apiCall('createPlanPixPayment', {
        customerId:        custRes.id,
        value:             total,
        dueDate:           dueDate.toISOString().slice(0,10),
        description:       `GestEscolar – ${plan.name} (${isAnual ? 'Anual' : 'Mensal'})`,
        externalReference: `${session.schoolId}|${planId}|${isAnual ? 'anual' : 'mensal'}`,
      });
      if (payRes.error) throw new Error(payRes.error);

      const qrRes = await this._apiCall('getPixQrCode', { paymentId: payRes.id, plan: true });
      if (qrRes?.error) throw new Error(qrRes.error);

      const area = document.getElementById('pix-plan-area');
      if (!area) return;

      const pixCode = qrRes?.payload || '';
      const pixId   = 'plan-pix-code';
      area.innerHTML = `
        ${qrRes?.encodedImage
          ? `<img src="data:image/png;base64,${qrRes.encodedImage}" style="width:160px;height:160px;border-radius:12px;margin-bottom:12px;">`
          : ''}
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">PIX Copia e Cola</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:16px;">
          <input id="${pixId}" class="form-control" value="${Utils.escape(pixCode)}" readonly
            style="font-size:10px;font-family:monospace;flex:1;" />
          <button class="btn btn-outline btn-sm" onclick="Utils.copyText(document.getElementById('${pixId}').value);Utils.toast('Código copiado!','success');">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <div class="alert alert-info" style="font-size:12px;text-align:left;">
          <i class="fa-solid fa-info-circle"></i>
          Após o pagamento, seu plano será ativado automaticamente em até 5 minutos.
        </div>`;

      // Polling para confirmar pagamento
      this._pollPlanPix(payRes.id, planId, isAnual ? 'anual' : 'mensal');

    } catch(e) {
      const area = document.getElementById('pix-plan-area');
      if (area) area.innerHTML = `<div style="color:var(--danger);">${e.message || 'Erro ao gerar PIX.'}</div>`;
    }
  },

  _pollPlanPix(paymentId, planId, billing) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      if (tries > 72 || !document.querySelector('.modal-overlay')) {
        clearInterval(timer); return;
      }
      try {
        const r = await this._apiCall('getPayment', { paymentId, plan: true });
        if (r.status === 'RECEIVED' || r.status === 'CONFIRMED') {
          clearInterval(timer);
          await this._activatePlan(planId, billing, paymentId, null);
          document.querySelector('.modal-overlay')?.remove();
          Utils.toast('Pagamento PIX confirmado! Plano ativado.', 'success');
          Router.go('admin-dashboard');
        }
      } catch(e) { /* silencioso */ }
    }, 5000);
  },

  // Ativa o plano no banco após pagamento confirmado
  async _activatePlan(planId, billing, paymentId, subscriptionId) {
    const session = Auth.current();
    const now     = new Date();
    let expiresAt;
    if (billing === 'anual') {
      expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
    } else if (subscriptionId) {
      // Cartão mensal com assinatura recorrente Asaas: sem data de expiração local
      expiresAt = null;
    } else {
      // PIX mensal: cobra uma vez e precisa renovar em 30 dias
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    await DB.updateSchool(session.schoolId, {
      planId,
      billing,
      upgradedAt:          now.toISOString(),
      planExpiresAt:       expiresAt,
      planPaymentId:       paymentId || null,
      planSubscriptionId:  subscriptionId || null,
      schoolStatus:        'active',
    });

    // Atualiza sessão local
    session.planId = planId;
    Auth._save(session);
    DB.addAuditLog('upgrade', `Plano ativado: ${planId} (${billing})`);
  },

  // Chama o proxy Asaas com token de autenticação
  async _apiCall(action, data = {}) {
    const session = Auth.current();
    let token = null;
    if (typeof supabaseClient !== 'undefined') {
      const { data: sd } = await supabaseClient.auth.getSession();
      token = sd?.session?.access_token;
    }
    const res = await fetch('/api/asaas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, data }),
    });
    return res.json();
  },

  // Helper: lê campo aceitando tanto camelCase quanto snake_case
  _f(school, camel, snake) {
    if (!school) return null;
    return school[camel] !== undefined ? school[camel] : school[snake];
  },

  // ── SISTEMA DE TESTE: Verifica se está em período de 7 dias de teste ──
  isOnTrial(school) {
    if (!school) return false;
    const status = this._f(school, 'schoolStatus', 'school_status');
    if (status === 'trial') {
      const started = this._f(school, 'createdAt', 'created_at')
                   || this._f(school, 'trialStartedAt', 'trial_started_at');
      const trialStart = new Date(started);
      const trialEnd   = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return new Date() < trialEnd;
    }
    return false;
  },

  // Retorna quantos dias faltam no teste
  getTrialDaysRemaining(school) {
    if (!this.isOnTrial(school)) return 0;
    const started = this._f(school, 'createdAt', 'created_at')
                 || this._f(school, 'trialStartedAt', 'trial_started_at');
    const trialStart = new Date(started);
    const trialEnd   = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft);
  },

  // Verifica se pode gerar pagamento (bloqueado durante teste)
  canGeneratePayment(school) {
    // Bloqueia se está em teste, com plano expirado ou escola bloqueada
    if (this.isOnTrial(school)) return false;
    if (this.isPlanExpired(school)) return false;
    if (this.isSchoolBlocked(school)) return false;
    return true;
  },

  // ───────────────────────────────────────────────────────────
  // BLOQUEIO DE ESCOLA — trial expirado sem plano OU plano vencido
  // ───────────────────────────────────────────────────────────
  isSchoolBlocked(school) {
    if (!school) return false;

    // 1. Trial expirado (>7 dias) sem ter ativado plano
    if (this._f(school, 'schoolStatus', 'school_status') === 'trial') {
      const started = this._f(school, 'createdAt', 'created_at')
                   || this._f(school, 'trialStartedAt', 'trial_started_at');
      const trialStart = new Date(started);
      const trialEnd   = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() >= trialEnd) return true;
    }

    // 2. Plano anual/mensal vencido (planExpiresAt no passado)
    const exp = this._f(school, 'planExpiresAt', 'plan_expires_at');
    const subId = this._f(school, 'planSubscriptionId', 'plan_subscription_id');
    if (exp && new Date(exp) < new Date() && !subId) return true;

    return false;
  },

  // Modal bloqueante para escolas em estado de bloqueio
  showBlockedModal(school) {
    const isTrialExpired = this._f(school, 'schoolStatus', 'school_status') === 'trial';
    const title = isTrialExpired ? 'Per\u00edodo de teste encerrado' : 'Assinatura vencida';
    const msg = isTrialExpired
      ? 'Seu per\u00edodo de 7 dias de teste terminou. Para continuar usando o GestEscolar, escolha e ative um plano.'
      : 'Sua assinatura venceu. Renove agora para reativar o acesso ao sistema.';
    const btnLabel = isTrialExpired ? 'Escolher Plano' : 'Renovar Agora';

    // Remove modais existentes e cria um NOVO overlay sem X e sem fechar no click-fora
    document.querySelectorAll('.modal-overlay, #blocked-overlay').forEach(m => m.remove());

    const overlay = document.createElement('div');
    overlay.id = 'blocked-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <span class="modal-title"><i class="fa-solid fa-lock" style="color:#c62828;"></i> ${title}</span>
        </div>
        <div class="modal-body">
          <div style="text-align:center;padding:16px 0;">
            <i class="fa-solid fa-circle-exclamation" style="font-size:56px;color:#c62828;margin-bottom:14px;display:block;"></i>
            <p style="font-size:16px;font-weight:700;margin-bottom:8px;">Acesso bloqueado</p>
            <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">${msg}</p>
            <div style="background:#ffebee;border-radius:8px;padding:10px;font-size:12px;color:#c62828;">
              <i class="fa-solid fa-shield-halved"></i> Seus dados est\u00e3o preservados e nada ser\u00e1 perdido.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="blocked-action" class="btn" style="background:#c62828;color:#fff;width:100%;">
            <i class="fa-solid fa-credit-card"></i> ${btnLabel}
          </button>
        </div>
      </div>`;
    // NÃO adiciona listener pra fechar ao clicar fora — modal é 100% bloqueante
    document.body.appendChild(overlay);

    document.getElementById('blocked-action').onclick = () => {
      overlay.remove();
      // Vai direto para a página de planos e abre o fluxo de pagamento
      Router.go('school-plans');
      setTimeout(() => Plans.openRenewalModal(true), 200);
    };
  },

  // Retorna HTML da notificação de teste fixa
  getTrialNotificationHTML(school) {
    if (!this.isOnTrial(school)) return '';
    const daysLeft = this.getTrialDaysRemaining(school);
    return `
      <div id="trial-notification" style="
        position:fixed;top:0;right:0;width:50%;z-index:9000;
        background:linear-gradient(135deg,#1a73e8,#0d47a1);
        color:#fff;padding:12px 20px;text-align:center;
        display:flex;align-items:center;justify-content:center;gap:16px;
        box-shadow:0 2px 8px rgba(0,0,0,.15);
        border-bottom-left-radius:8px;
        font-size:14px;font-weight:600;">
        <i class="fa-solid fa-hourglass-end" style="font-size:16px;"></i>
        <span>Período de teste: <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong> restante${daysLeft !== 1 ? 's' : ''}.
        <a href="#" onclick="Router.go('school-plans'); return false;"
          style="color:#fff;text-decoration:underline;font-weight:700;cursor:pointer;">
          Escolha um plano →
        </a></span>
      </div>
    `;
  },

  // Mostra modal bloqueando a funcionalidade
  showPaymentBlockedOnTrial() {
    this.showUpgradeModal(
      'Funcionalidade indisponível no período de teste. ' +
      'Escolha um plano para começar a gerar cobranças PIX para seus alunos.'
    );
  },

  // ───────────────────────────────────────────────────────────
  // SISTEMA DE RENOVAÇÃO — Plano PIX mensal
  // ───────────────────────────────────────────────────────────

  // Dias restantes até o plano expirar. null = sem expiração (assinatura recorrente).
  getPlanDaysRemaining(school) {
    const exp = this._f(school, 'planExpiresAt', 'plan_expires_at');
    if (!exp) return null;
    const expDate = new Date(exp);
    const now = new Date();
    return Math.ceil((expDate - now) / (24 * 60 * 60 * 1000));
  },

  // Escola PIX mensal com vencimento em ≤10 dias → mostrar botão de renovação
  shouldShowRenewalWarning(school) {
    if (!school) return false;
    if (this._f(school, 'schoolStatus', 'school_status') !== 'active') return false;
    if (school.billing !== 'mensal') return false;
    if (this._f(school, 'planSubscriptionId', 'plan_subscription_id')) return false;
    const days = this.getPlanDaysRemaining(school);
    return days !== null && days <= 10 && days >= 0;
  },

  // Escola PIX mensal com plano já vencido → bloquear acesso
  isPlanExpired(school) {
    if (!school) return false;
    if (this.isOnTrial(school)) return false;
    if (this._f(school, 'schoolStatus', 'school_status') !== 'active') return false;
    if (this._f(school, 'planSubscriptionId', 'plan_subscription_id')) return false;
    if (!this._f(school, 'planExpiresAt', 'plan_expires_at')) return false;
    const days = this.getPlanDaysRemaining(school);
    return days !== null && days < 0;
  },

  // Banner de aviso de renovação (≤10 dias)
  getRenewalNotificationHTML(school) {
    if (!this.shouldShowRenewalWarning(school)) return '';
    const days = this.getPlanDaysRemaining(school);
    const urgent = days <= 3;
    return `
      <div id="renewal-notification" style="
        position:fixed;top:0;right:0;width:50%;z-index:9000;
        background:linear-gradient(135deg,${urgent ? '#c62828,#8e0000' : '#f57c00,#e65100'});
        color:#fff;padding:12px 20px;text-align:center;
        display:flex;align-items:center;justify-content:center;gap:16px;
        box-shadow:0 2px 8px rgba(0,0,0,.15);
        border-bottom-left-radius:8px;
        font-size:14px;font-weight:600;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:16px;"></i>
        <span>Sua assinatura vence em <strong>${days} dia${days !== 1 ? 's' : ''}</strong>.
        Pague agora para garantir continuidade do serviço.</span>
        <button onclick="Plans.openRenewalModal()" class="btn btn-sm" style="
          background:#fff;color:${urgent ? '#c62828' : '#e65100'};
          font-weight:800;padding:6px 14px;border-radius:6px;border:none;cursor:pointer;">
          <i class="fa-solid fa-qrcode"></i> Gerar PIX de renovação
        </button>
      </div>
    `;
  },

  // Modal bloqueante: plano expirado
  showExpiredModal(school) {
    Utils.modal(
      '<i class="fa-solid fa-lock" style="color:#c62828;"></i> Assinatura vencida',
      `<div style="text-align:center;padding:16px 0;">
        <i class="fa-solid fa-circle-exclamation" style="font-size:56px;color:#c62828;margin-bottom:14px;display:block;"></i>
        <p style="font-size:16px;font-weight:700;margin-bottom:8px;">Pagamento pendente</p>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
          Sua assinatura mensal do GestEscolar venceu. Para voltar a usar o sistema,
          efetue o pagamento via PIX. O acesso será liberado automaticamente em até 5 minutos após a confirmação.
        </p>
        <div style="background:#ffebee;border-radius:8px;padding:10px;font-size:12px;color:#c62828;">
          <i class="fa-solid fa-shield-halved"></i> Seus dados estão preservados e nada será perdido.
        </div>
      </div>`,
      `<button class="btn" style="background:#c62828;color:#fff;width:100%;" onclick="Plans.openRenewalModal(true)">
        <i class="fa-solid fa-qrcode"></i> Pagar agora via PIX
       </button>`
    );
  },

  // Gera PIX de renovação (1 mês adicional)
  async openRenewalModal(blocking = false) {
    const session = Auth.current();
    const school  = DB.getSchool(session?.schoolId);
    if (!school || !school.plan_id) { Router.go('school-plans'); return; }
    const plan    = this.get(school.plan_id);
    const price   = plan.price;

    // Fecha modais anteriores
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    Utils.modal(
      `<i class="fa-solid fa-qrcode" style="color:var(--primary);"></i> Renovar assinatura — ${plan.name}`,
      `<div style="text-align:center;padding:16px 0;">
        <div style="font-size:26px;font-weight:900;color:var(--primary);margin-bottom:4px;">${Utils.currency(price)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:24px;">
          Renovação mensal — 30 dias adicionais
        </div>
        <div id="renewal-pix-area">
          <i class="fa-solid fa-spinner fa-spin" style="font-size:36px;color:var(--primary);"></i>
          <p style="color:var(--text-muted);margin-top:10px;">Gerando código PIX...</p>
        </div>
      </div>`,
      blocking
        ? ''
        : `<button class="btn btn-outline" onclick="document.querySelector('.modal-overlay')?.remove()">Fechar</button>`
    );

    try {
      const custRes = await this._apiCall('createPlanCustomer', {
        name:              school.name || session.name,
        cpfCnpj:           school.cnpj || '00000000000',
        email:             school.email || session.email,
        phone:             school.phone,
        externalReference: session.schoolId,
      });
      if (custRes.error) throw new Error(custRes.error);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const payRes = await this._apiCall('createPlanPixPayment', {
        customerId:        custRes.id,
        value:             price,
        dueDate:           dueDate.toISOString().slice(0, 10),
        description:       `GestEscolar – ${plan.name} (Renovação mensal)`,
        externalReference: `${session.schoolId}|${plan.id}|renewal`,
      });
      if (payRes.error) throw new Error(payRes.error);

      const qrRes = await this._apiCall('getPixQrCode', { paymentId: payRes.id });
      const area  = document.getElementById('renewal-pix-area');
      if (!area) return;

      const pixCode = qrRes?.payload || '';
      area.innerHTML = `
        ${qrRes?.encodedImage
          ? `<img src="data:image/png;base64,${qrRes.encodedImage}"
             style="width:180px;height:180px;border-radius:12px;margin-bottom:14px;border:4px solid var(--border);">`
          : ''}
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">PIX Copia e Cola</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:16px;">
          <input id="renewal-pix-code" class="form-control" value="${Utils.escape(pixCode)}" readonly
            style="font-size:10px;font-family:monospace;flex:1;" />
          <button class="btn btn-outline btn-sm"
            onclick="Utils.copyText(document.getElementById('renewal-pix-code').value);Utils.toast('Código copiado!','success');">
            <i class="fa-solid fa-copy"></i>
          </button>
        </div>
        <div class="alert alert-info" style="font-size:12px;text-align:left;">
          <i class="fa-solid fa-info-circle"></i>
          <div style="flex:1;min-width:0;">Após o pagamento, sua assinatura será renovada automaticamente em até 5 minutos.</div>
        </div>`;

      this._pollRenewalPix(payRes.id, school.plan_id);
    } catch (e) {
      const area = document.getElementById('renewal-pix-area');
      if (area) area.innerHTML = `<div style="color:var(--danger);">${e.message || 'Erro ao gerar PIX.'}</div>`;
    }
  },

  // Polling do pagamento de renovação
  _pollRenewalPix(paymentId, planId) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      if (tries > 72 || !document.querySelector('.modal-overlay')) {
        clearInterval(timer); return;
      }
      try {
        const r = await this._apiCall('getPayment', { paymentId, plan: true });
        if (r.status === 'RECEIVED' || r.status === 'CONFIRMED') {
          clearInterval(timer);
          await this._extendMonthlyPlan(planId, paymentId);
          document.querySelector('.modal-overlay')?.remove();
          document.getElementById('renewal-notification')?.remove();
          Utils.toast('Renovação confirmada! Acesso liberado por mais 30 dias.', 'success');
          Router.go('admin-dashboard');
        }
      } catch (e) { /* silencioso */ }
    }, 5000);
  },

  // Estende o plano mensal por +30 dias a partir da data atual de expiração
  async _extendMonthlyPlan(planId, paymentId) {
    const session = Auth.current();
    const school  = DB.getSchool(session.schoolId);
    const curExp  = this._f(school, 'planExpiresAt', 'plan_expires_at');
    const currentExp = curExp ? new Date(curExp) : new Date();
    const base       = currentExp > new Date() ? currentExp : new Date();
    const newExp     = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await DB.updateSchool(session.schoolId, {
      planExpiresAt: newExp,
      planPaymentId: paymentId,
      schoolStatus:  'active',
    });
    DB.addAuditLog('renewal', `Plano renovado: +30 dias (pagamento ${paymentId})`);
  },
};
