// =============================================
//  GESTESCOLAR SaaS – LOGIN + CADASTRO DE ESCOLA
// =============================================

// Extrair parâmetros do URL fragment (seguro, não enviado ao servidor)
function getHashParams() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return { resetToken: params.get('reset_token'), resetEmail: params.get('reset_email') };
}

Router.register('login', () => {
  const app = document.getElementById('app');

  // Verificar se há parâmetros de reset no URL fragment
  const { resetToken, resetEmail } = getHashParams();

  if (resetToken && resetEmail) {
    console.log('[Login] Parâmetros de reset detectados em URL fragment - mostrando formulário de reset');
    LoginPage._showResetPasswordForm(resetToken, resetEmail);
    return;
  }

  app.innerHTML = `
    <div class="login-wrap">
      <div class="login-side-image">
        <i class="fa-solid fa-school side-icon"></i>
        <h2>GestEscolar</h2>
        <p>A plataforma completa para gest\u00e3o da sua institui\u00e7\u00e3o de ensino.<br/>
        Controle alunos, turmas, mensalidades e muito mais em um s\u00f3 lugar.</p>
      </div>
      <div class="login-card">
        <button type="button" onclick="Router.go('landing')"
          style="position:absolute;top:16px;left:16px;background:none;border:none;cursor:pointer;
                 color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:6px;padding:4px 8px;">
          <i class="fa-solid fa-arrow-left"></i> Voltar
        </button>
        <div class="login-logo">
          <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
          <h1>GestEscolar</h1>
          <p>Plataforma SaaS de Gest\u00e3o Escolar</p>
        </div>

        <div id="login-alert"></div>

        <form id="loginForm" onsubmit="LoginPage.submit(event)">
          <div class="form-group">
            <label class="form-label">E-mail ou matrícula</label>
            <input type="text" class="form-control" id="loginEmail"
                   placeholder="seu@email.com ou matrícula do aluno" required autocomplete="username" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <div style="position:relative;">
              <input type="password" class="form-control" id="loginPassword"
                     placeholder="******" required autocomplete="current-password"
                     style="padding-right:42px;" />
              <button type="button" onclick="LoginPage.togglePassword('loginPassword', this)"
                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                       background:none;border:none;cursor:pointer;color:var(--text-muted);
                       font-size:15px;padding:4px;line-height:1;">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-100" style="margin-top:8px;">
            <i class="fa-solid fa-right-to-bracket"></i> Entrar
          </button>
        </form>

        <div style="display:flex;align-items:center;gap:12px;margin:24px 0 16px;">
          <div style="flex:1;height:1px;background:var(--border);"></div>
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Novo na plataforma?</span>
          <div style="flex:1;height:1px;background:var(--border);"></div>
        </div>

        <button class="btn w-100" onclick="Router.go('school-register')"
          style="text-align:center;justify-content:center;
                 background:linear-gradient(135deg,#ff6d00,#ff9100);color:#fff;
                 font-weight:700;border:none;padding:12px;
                 box-shadow:0 4px 12px rgba(255,109,0,.3);
                 transition:transform .15s, box-shadow .2s;"
          onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 16px rgba(255,109,0,.4)';"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(255,109,0,.3)';">
          <i class="fa-solid fa-school"></i> Cadastrar Institui\u00e7\u00e3o de Ensino
        </button>

        <p class="text-center mt-16">
          <a href="#" onclick="LoginPage.openRecovery(event)"
             style="font-size:13px;color:var(--text-muted);text-decoration:none;">
            <i class="fa-solid fa-key"></i> Esqueceu sua senha?
          </a>
        </p>

        <p class="text-center" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
          <a href="#" onclick="LoginPage.openAdminLogin(event)"
             style="font-size:11px;color:var(--border);text-decoration:none;letter-spacing:0.5px;"
             onmouseover="this.style.color='var(--text-muted)'" onmouseout="this.style.color='var(--border)'">
            &#9679;&#9679;&#9679;
          </a>
        </p>
      </div>
    </div>

    <!-- Modal login admin global -->
    <div id="admin-login-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;">
      <div style="background:#fff;border-radius:12px;padding:32px;width:100%;max-width:360px;box-shadow:0 8px 32px rgba(0,0,0,.18);position:relative;">
        <button onclick="LoginPage.closeAdminLogin()"
          style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;">&#x2715;</button>
        <div style="text-align:center;margin-bottom:20px;">
          <i class="fa-solid fa-shield-halved" style="font-size:28px;color:var(--primary);"></i>
          <div style="font-size:15px;font-weight:700;margin-top:8px;">Acesso Administrativo</div>
        </div>
        <div id="admin-login-alert"></div>
        <form onsubmit="LoginPage.submitAdminLogin(event)">
          <div class="form-group">
            <label class="form-label">E-mail</label>
            <input type="email" class="form-control" id="adminLoginEmail" required autocomplete="off" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <div style="position:relative;">
              <input type="password" class="form-control" id="adminLoginPassword" required autocomplete="off"
                     style="padding-right:42px;" />
              <button type="button" onclick="LoginPage.togglePassword('adminLoginPassword', this)"
                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                       background:none;border:none;cursor:pointer;color:var(--text-muted);
                       font-size:15px;padding:4px;line-height:1;">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-100" style="margin-top:8px;">
            <i class="fa-solid fa-right-to-bracket"></i> Entrar
          </button>
        </form>
      </div>
    </div>
  `;
  LoginPage._injectModals();
});

// ── Cadastro de Escola (primeiro acesso) ─────────────────────────────────
Router.register('school-register', () => {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-wrap login-wrap-centered">
      <div class="login-card login-card-centered" style="max-width:560px;position:relative;">
        <!-- Botão voltar -->
        <button type="button" onclick="Router.go('landing')"
          style="position:absolute;top:16px;left:16px;background:none;border:none;cursor:pointer;
                 color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:6px;padding:4px 8px;">
          <i class="fa-solid fa-arrow-left"></i> Voltar
        </button>

        <div class="login-logo">
          <div class="logo-icon"><i class="fa-solid fa-school"></i></div>
          <h1>Cadastro da Escola</h1>
          <p>Crie sua conta e comece a usar gratuitamente</p>
        </div>

        <div id="reg-alert"></div>

        <form onsubmit="LoginPage.registerSchool(event)">
          <div style="font-size:13px;font-weight:700;color:var(--primary);margin-bottom:12px;">
            <i class="fa-solid fa-school"></i> Dados da Institui\u00e7\u00e3o
          </div>
          <div class="form-group">
            <label class="form-label">Nome da Institui\u00e7\u00e3o *</label>
            <input class="form-control" id="regSchoolName" required placeholder="Ex: Col\u00e9gio Nova Era" maxlength="100" />
          </div>
          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">CNPJ *</label>
              <input class="form-control" id="regCnpj" placeholder="00.000.000/0000-00" data-mask="cnpj" maxlength="18" required />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Telefone *</label>
              <input class="form-control" id="regPhone" placeholder="(00) 00000-0000" data-mask="phone" maxlength="15" inputmode="numeric" required />
            </div>
          </div>

          <div style="font-size:12px;color:var(--text-muted);background:#f0f7ff;padding:8px 12px;border-radius:6px;margin:12px 0;">
            <i class="fa-solid fa-info-circle"></i> Os campos abaixo são necessários para ativar pagamentos PIX
          </div>

          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">CEP *</label>
              <input class="form-control" id="regPostalCode" placeholder="00000-000" data-mask="cep" maxlength="9" required
                oninput="LoginPage.debouncedBuscarCep(this.value)" />
            </div>
            <div class="form-group" style="flex:2;">
              <label class="form-label">Endereço *</label>
              <input class="form-control" id="regAddress" placeholder="Rua, Av, Pça..." maxlength="100" required />
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Número *</label>
              <input class="form-control" id="regAddressNumber" placeholder="123" maxlength="10" required />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Complemento</label>
              <input class="form-control" id="regComplement" placeholder="Apto, Sala..." maxlength="50" />
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Bairro *</label>
              <input class="form-control" id="regProvince" placeholder="Ex: Centro" maxlength="50" required />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Cidade *</label>
              <input class="form-control" id="regCity" placeholder="Ex: São Paulo" maxlength="50" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Estado *</label>
            <select class="form-control" id="regState" required>
              <option value="">Selecione o estado</option>
              <option value="AC">Acre</option>
              <option value="AL">Alagoas</option>
              <option value="AP">Amapá</option>
              <option value="AM">Amazonas</option>
              <option value="BA">Bahia</option>
              <option value="CE">Ceará</option>
              <option value="DF">Distrito Federal</option>
              <option value="ES">Espírito Santo</option>
              <option value="GO">Goiás</option>
              <option value="MA">Maranhão</option>
              <option value="MT">Mato Grosso</option>
              <option value="MS">Mato Grosso do Sul</option>
              <option value="MG">Minas Gerais</option>
              <option value="PA">Pará</option>
              <option value="PB">Paraíba</option>
              <option value="PR">Paraná</option>
              <option value="PE">Pernambuco</option>
              <option value="PI">Piauí</option>
              <option value="RJ">Rio de Janeiro</option>
              <option value="RN">Rio Grande do Norte</option>
              <option value="RS">Rio Grande do Sul</option>
              <option value="RO">Rondônia</option>
              <option value="RR">Roraima</option>
              <option value="SC">Santa Catarina</option>
              <option value="SP">São Paulo</option>
              <option value="SE">Sergipe</option>
              <option value="TO">Tocantins</option>
            </select>
          </div>

          <div style="font-size:13px;font-weight:700;color:var(--primary);margin:16px 0 12px;">
            <i class="fa-solid fa-user-tie"></i> Dados do Gestor
          </div>
          <div class="form-group">
            <label class="form-label">Nome completo *</label>
            <input class="form-control" id="regName" required placeholder="Seu nome completo" data-mask="name" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label">E-mail *</label>
            <input type="email" class="form-control" id="regEmail" required placeholder="gestor@escola.com" />
          </div>
          <div style="display:flex;gap:8px;">
            <div class="form-group" style="flex:1;">
              <label class="form-label">Senha *</label>
              <input type="password" class="form-control" id="regPass" required placeholder="M\u00ednimo 6 caracteres" />
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label">Confirmar Senha *</label>
              <input type="password" class="form-control" id="regPassConfirm" required placeholder="Repita a senha" />
            </div>
          </div>

          <div class="alert alert-info" style="font-size:12px;margin-top:12px;line-height:1.7;display:block;column-count:1;">
            <span style="display:block;">
              <i class="fa-solid fa-info-circle" style="margin-right:6px;"></i>
              <strong>Você será o Gestor</strong> da escola. Após o cadastro, poderá criar perfis de professores, administrativos, alunos, criação de turmas e muito mais. Ativação de cobrança via PIX somente após ativação de plano.
            </span>
          </div>

          <button type="submit" class="btn btn-primary w-100" style="margin-top:12px;">
            <i class="fa-solid fa-rocket"></i> Criar Conta e Come\u00e7ar
          </button>
        </form>

        <p class="text-center mt-16">
          <a href="#" onclick="Router.go('login')" style="font-size:13px;color:var(--text-muted);text-decoration:none;">
            <i class="fa-solid fa-arrow-left"></i> J\u00e1 tenho conta, voltar ao login
          </a>
        </p>
      </div>
    </div>
  `;
});

// ── Tela de Planos ───────────────────────────────────────────────────────
Router.register('school-plans', () => {
  const user = Auth.require(); if (!user) return;
  const school = DB.getSchool(user.schoolId);
  const planId = school?.planId || user.planId || 'free';

  Router.renderLayout(user, 'school-plans', `
    <div style="margin-bottom:20px;">
      <h2 style="margin:0;"><i class="fa-solid fa-rocket" style="color:var(--primary);margin-right:8px;"></i>Planos e Assinatura</h2>
      <p style="color:var(--text-muted);font-size:13px;">Escolha o plano ideal para sua escola.</p>
    </div>
    ${Plans.renderCards(planId)}
  `);
});

const LoginPage = {
  _pendingUser: null,
  _cepTimeout: null,

  debouncedBuscarCep(cep) {
    const input = document.getElementById('regPostalCode');
    const digits = cep.replace(/\D/g, '');
    clearTimeout(this._cepTimeout);
    if (digits.length === 8) {
      input.style.borderColor = '#2196F3';
      this._cepTimeout = setTimeout(() => this._buscarCep(digits), 500);
    } else {
      input.style.borderColor = '';
    }
  },

  async _buscarCep(digits) {
    const input = document.getElementById('regPostalCode');
    try {
      input.style.opacity = '0.6';
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await res.json();
      if (d.erro) {
        input.style.borderColor = '#f44336';
        input.style.opacity = '1';
        Utils.toast('CEP não encontrado', 'error');
        return;
      }
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      set('regAddress', d.logradouro);
      set('regProvince', d.bairro);
      set('regCity', d.localidade);
      // Estado: select — seleciona pelo value (UF)
      const stateEl = document.getElementById('regState');
      if (stateEl && d.uf) stateEl.value = d.uf;
      input.style.borderColor = '#4caf50';
      input.style.opacity = '1';
      Utils.toast('Endereço preenchido com sucesso', 'success');
    } catch (e) {
      input.style.borderColor = '#f44336';
      input.style.opacity = '1';
      Utils.toast('Erro ao buscar CEP. Tente novamente.', 'error');
    }
  },

  _injectModals() {
    // Remove modais antigos se existirem
    document.getElementById('recovery-overlay')?.remove();
    document.getElementById('newpass-overlay')?.remove();

    // Modal recupera\u00e7\u00e3o de senha
    const rec = document.createElement('div');
    rec.id = 'recovery-overlay';
    Object.assign(rec.style, { display:'none', position:'fixed', inset:'0',
      background:'rgba(0,0,0,.55)', zIndex:'1000', alignItems:'center', justifyContent:'center' });
    rec.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;width:100%;max-width:380px;
                  box-shadow:0 8px 32px rgba(0,0,0,.2);margin:16px;">
        <h3 style="margin:0 0 6px;font-size:17px;"><i class="fa-solid fa-key"></i> Recuperar Senha</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;">
          Informe seu e-mail cadastrado. Enviaremos um link para redefinir sua senha.
        </p>
        <div id="recovery-alert"></div>
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" class="form-control" id="recoveryEmail" placeholder="seu@email.com" />
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-outline" style="flex:1;" onclick="LoginPage.closeRecovery()">Cancelar</button>
          <button class="btn btn-primary" style="flex:1;" onclick="LoginPage.sendRecovery()">
            <i class="fa-solid fa-paper-plane"></i> Enviar
          </button>
        </div>
      </div>`;
    document.body.appendChild(rec);

    // Modal troca de senha obrigat\u00f3ria
    const np = document.createElement('div');
    np.id = 'newpass-overlay';
    Object.assign(np.style, { display:'none', position:'fixed', inset:'0',
      background:'rgba(0,0,0,.6)', zIndex:'1000', alignItems:'center', justifyContent:'center' });
    np.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:28px;width:100%;max-width:380px;
                  box-shadow:0 8px 32px rgba(0,0,0,.2);margin:16px;">
        <div style="text-align:center;margin-bottom:12px;">
          <i class="fa-solid fa-lock" style="font-size:32px;color:var(--primary);"></i>
        </div>
        <h3 style="margin:0 0 6px;font-size:17px;text-align:center;">Crie uma nova senha</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;text-align:center;">
          Por seguran\u00e7a, defina uma senha pessoal antes de continuar.
        </p>
        <div id="newpass-alert"></div>
        <div class="form-group">
          <label class="form-label">Nova senha *</label>
          <input type="password" class="form-control" id="newPassword" placeholder="M\u00edn. 8 caracteres, mai\u00fasc., n\u00famero e s\u00edmbolo" oninput="LoginPage.attachPasswordStrength('newPassword','newPasswordMeter')" />
          <div id="newPasswordMeter"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Confirmar nova senha *</label>
          <input type="password" class="form-control" id="newPasswordConfirm" placeholder="Repita a senha" />
        </div>
        <button class="btn btn-primary w-100" style="margin-top:8px;" onclick="LoginPage.saveNewPassword()">
          <i class="fa-solid fa-floppy-disk"></i> Salvar e Entrar
        </button>
      </div>`;
    document.body.appendChild(np);
  },

  async submit(e) {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const alertEl  = document.getElementById('login-alert');
    const btn = e.target?.querySelector('button[type="submit"]') || document.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...'; }
    alertEl.innerHTML = '';

    let result;
    try {
      result = await Promise.race([
        Auth.login(email, password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
      ]);
    } catch (err) {
      const isTimeout = err.message === 'timeout';
      result = {
        ok: false,
        msg: isTimeout
          ? 'Tempo esgotado. Verifique sua conexão e tente novamente.'
          : 'Erro de conexão. Verifique sua internet e tente novamente.',
      };
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar'; }

    if (!result.ok) {
      alertEl.innerHTML =
        `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> ${result.msg}</div>`;
      return;
    }
    if (result.user.needsPasswordChange) {
      this._pendingUser = result.user;
      document.getElementById('newpass-overlay').style.display = 'flex';
      return;
    }
    this.redirect(result.user.role, result.user.roles);
  },

  redirect(role, roles) {
    const primary = (roles && roles[0]) || role;
    const map = {
      administrativo: 'admin-dashboard',
      financeiro:     'fin-dashboard',
      professor:      'teacher-dashboard',
      pai:            'parent-dashboard',
      gestor:         'admin-dashboard',
      superadmin:     'superadmin-dashboard',
    };
    Router.go(map[primary] || 'admin-dashboard');

    // Gate de assinatura: se a escola est\u00e1 bloqueada (trial expirado ou plano vencido),
    // redireciona para school-plans e abre modal bloqueante.
    if (typeof Plans !== 'undefined' && (primary === 'gestor' || primary === 'administrativo')) {
      setTimeout(() => {
        const session = Auth.current();
        const school  = DB.getSchool(session?.schoolId);
        if (school && Plans.isSchoolBlocked(school)) {
          Router.go('school-plans');
          setTimeout(() => Plans.showBlockedModal(school), 200);
        }
      }, 300);
    }
  },

  togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show
      ? '<i class="fa-solid fa-eye-slash"></i>'
      : '<i class="fa-solid fa-eye"></i>';
    btn.title = show ? 'Ocultar senha' : 'Mostrar senha';
  },





  async registerSchool(e) {
    e.preventDefault();
    const alertEl = document.getElementById('reg-alert');
    const schoolName = document.getElementById('regSchoolName').value.trim();
    const cnpj       = document.getElementById('regCnpj').value.trim();
    const phone      = document.getElementById('regPhone').value.trim();
    const postalCode = document.getElementById('regPostalCode').value.trim();
    const address    = document.getElementById('regAddress').value.trim();
    const addressNum = document.getElementById('regAddressNumber').value.trim();
    const complement = document.getElementById('regComplement').value.trim();
    const province   = document.getElementById('regProvince').value.trim();
    const city       = document.getElementById('regCity').value.trim();
    const state      = document.getElementById('regState').value.trim();
    const name       = document.getElementById('regName').value.trim();
    const email      = document.getElementById('regEmail').value.trim().toLowerCase();
    const pass       = document.getElementById('regPass').value;
    const passConf   = document.getElementById('regPassConfirm').value;

    // Validar campos obrigat\u00f3rios
    if (!schoolName || !cnpj || !phone || !postalCode || !address || !addressNum || !province || !city || !state) {
      alertEl.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> Preencha todos os dados da institui\u00e7\u00e3o (obrigat\u00f3rios para ativar pagamentos).</div>';
      return;
    }
    if (!name || !email || !pass) {
      alertEl.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> Preencha todos os dados do gestor.</div>';
      return;
    }
    if (pass.length < 6) {
      alertEl.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> A senha deve ter no m\u00ednimo 6 caracteres.</div>';
      return;
    }
    if (pass !== passConf) {
      alertEl.innerHTML = '<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> As senhas n\u00e3o coincidem.</div>';
      return;
    }

    // Verificar email duplicado em todas as escolas
    const schools = DB.getSchools();
    for (const s of schools) {
      DB.setTenant(s.id);
      if (DB.findUserByEmail(email)) {
        alertEl.innerHTML = '<div class="alert alert-danger">Este e-mail j\u00e1 est\u00e1 em uso.</div>';
        DB.setTenant(null);
        return;
      }
    }
    if (DB.findSuperUser(email)) {
      alertEl.innerHTML = '<div class="alert alert-danger">Este e-mail j\u00e1 est\u00e1 em uso.</div>';
      return;
    }

    const btn = e.target?.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...'; }

    try {
      // PASSO 1: Criar conta no Supabase Auth PRIMEIRO
      // Sem sess\u00e3o Auth ativa, auth.uid() \u00e9 null e as pol\u00edticas RLS bloqueiam
      // todos os INSERTs subsequentes (escola, gestor, alunos, etc.)
      let authId = null;
      if (supabaseClient) {
        const { data: authData, error: authErr } = await supabaseClient.auth.signUp({
          email, password: pass,
          options: { data: { name, role: 'gestor' } },
        });

        if (authErr) {
          if (authErr.message.toLowerCase().includes('already registered')) {
            // Conta j\u00e1 existe no Auth — autenticar diretamente
            const { data: signinData, error: signinErr } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
            if (signinErr) {
              alertEl.innerHTML = '<div class="alert alert-danger">Este e-mail j\u00e1 possui uma conta. <a href="#" onclick="Router.go(\'login\')">Fa\u00e7a login</a>.</div>';
              return;
            }
            authId = signinData?.user?.id || null;
          } else {
            alertEl.innerHTML = `<div class="alert alert-danger">Erro ao criar conta: ${authErr.message}</div>`;
            return;
          }
        } else {
          authId = authData?.user?.id || null;
        }
        // Agora auth.uid() IS NOT NULL — RLS de INSERT funcionar\u00e1
      }

      // PASSO 2: Criar escola (agora com sess\u00e3o Auth ativa)
      const school = DB.addSchool({
        name: schoolName, cnpj, phone, email, planId: 'free',
        postalCode, address, addressNumber: addressNum, complement, province, city, state,
      });
      DB.initSchool(school.id);
      DB.setTenant(school.id);

      // PASSO 3: Inserir gestor com authId j\u00e1 conhecido (sem _createAuthUser duplicado)
      const gestorId = crypto.randomUUID();
      const gestorObj = {
        id:        gestorId,
        authId,
        schoolId:  school.id,
        name,
        email,
        role:      'gestor',
        phone:     '',
        cpf:       '',
        active:    true,
        createdAt: new Date().toISOString(),
      };
      DB._cache.users.push(gestorObj);
      await DB._insert('users', gestorObj);

      // PASSO 4: Vincular owner e salvar config
      DB.updateSchool(school.id, { ownerId: gestorId });
      DB.saveSchoolConfig({ name: schoolName, cnpj, phone, logo: '', address });
      DB.addAuditLog('school_created', `Escola ${schoolName} criada por ${name}`);

      // PASSO 5: Criar subconta Asaas automaticamente
      try {
        const asaasResult = await AsaasClient.createSubaccount({
          name: schoolName, cpfCnpj: cnpj, email, phone,
          postalCode, address, addressNumber: addressNum, complement, province, city, state,
        });
        if (asaasResult && (asaasResult.id || asaasResult.walletId)) {
          DB.updateSchool(school.id, {
            asaasAccountId: asaasResult.id || '',
            asaasWalletId: asaasResult.walletId || '',
          });
          DB.addAuditLog('asaas_subaccount_created', `Subconta Asaas criada: ${asaasResult.id}`);
        }
      } catch (err) {
        console.warn('[Asaas] Erro ao criar subconta durante registro:', err.message);
        // N\u00e3o bloqueia o registro mesmo se Asaas falhar
      }

      // PASSO 6: Montar sess\u00e3o e redirecionar
      const session = {
        id: gestorId, name, email, role: 'gestor',
        schoolId: school.id, schoolName, planId: 'free',
      };
      Auth._save(session);

      // Se plano pago foi selecionado, vai para pagamento obrigatório
      const selectedPlan = localStorage.getItem('selectedPlan') || 'free';
      if (selectedPlan !== 'free') {
        Utils.toast('Escola cadastrada! Agora finalize o pagamento.', 'success');
        setTimeout(() => {
          Router.go('school-plans');
          setTimeout(() => Plans._requestPaymentModal(selectedPlan, schoolName, email), 300);
        }, 300);
      } else {
        Utils.toast('Escola cadastrada com sucesso! Comece seu teste de 7 dias.', 'success');
        Router.go('admin-dashboard');
      }
      localStorage.removeItem('selectedPlan');

    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Criar Conta e Come\u00e7ar'; }
    }
  },

  openRecovery(e) {
    e.preventDefault();
    document.getElementById('recovery-alert').innerHTML = '';
    document.getElementById('recoveryEmail').value = '';
    document.getElementById('recovery-overlay').style.display = 'flex';
  },

  closeRecovery() {
    document.getElementById('recovery-overlay').style.display = 'none';
  },

  async sendRecovery() {
    const email   = document.getElementById('recoveryEmail').value.trim().toLowerCase();
    const alertEl = document.getElementById('recovery-alert');
    const btn     = document.querySelector('#recovery-overlay .btn-primary');
    if (!email) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">Informe o e-mail.</div>';
      return;
    }
    // Valida\u00e7\u00e3o de formato de e-mail
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">E-mail em formato inv\u00e1lido.</div>';
      return;
    }
    // Rate-limit front: 60s entre envios por e-mail
    const key = 'pwdRecovery:' + email;
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    const now = Date.now();
    if (last && (now - last) < 60000) {
      const wait = Math.ceil((60000 - (now - last)) / 1000);
      alertEl.innerHTML = `<div class="alert alert-warning" style="font-size:13px;">Aguarde ${wait}s antes de solicitar novamente.</div>`;
      return;
    }

    if (!supabaseClient) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">Servi\u00e7o indispon\u00edvel.</div>';
      return;
    }

    // Enviar email de recuperacao via Resend (acao publica no backend)
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }
    try {
      const recoveryRes = await fetch('/api/asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendPasswordRecovery',
          data: { email, redirectTo: window.location.origin + '/login' },
        }),
      });
      const recoveryData = await recoveryRes.json();
      if (!recoveryRes.ok || !recoveryData.success) {
        console.warn('[Recovery] API error:', recoveryData.error || recoveryData.message);
        alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;">
          <i class="fa-solid fa-circle-exclamation"></i>
          <div style="flex:1;min-width:0;">Erro ao enviar</div>
        </div>`;
        if (btn) { btn.disabled = false; btn.innerHTML = 'Enviar'; }
        return;
      }
      localStorage.setItem(key, String(now));
      alertEl.innerHTML = `<div class="alert alert-success" style="font-size:13px;">
        <i class="fa-solid fa-check-circle"></i>
        <div style="flex:1;min-width:0;">Se este e-mail estiver cadastrado no sistema, voc\u00ea receber\u00e1 as instru\u00e7\u00f5es de recupera\u00e7\u00e3o. Verifique sua caixa de entrada (e spam). <strong>O link expira em 1 hora.</strong></div>
      </div>`;
      setTimeout(() => this.closeRecovery(), 8000);
    } catch (e) {
      console.error('[Recovery]', e);
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">Erro ao enviar e-mail. Tente novamente.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar'; }
    }
  },

  openAdminLogin(e) {
    e.preventDefault();
    document.getElementById('admin-login-alert').innerHTML = '';
    document.getElementById('adminLoginEmail').value = '';
    document.getElementById('adminLoginPassword').value = '';
    document.getElementById('admin-login-modal').style.display = 'flex';
  },

  closeAdminLogin() {
    document.getElementById('admin-login-modal').style.display = 'none';
  },

  async submitAdminLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('adminLoginEmail').value.trim().toLowerCase();
    const password = document.getElementById('adminLoginPassword').value;
    const alertEl  = document.getElementById('admin-login-alert');
    const btn      = e.target?.querySelector('button[type="submit"]');

    if (!email || !password) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> Preencha e-mail e senha.</div>';
      return;
    }

    if (!supabaseClient) {
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> Supabase n\u00e3o dispon\u00edvel.</div>';
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...'; }
    try {
      // Passo 1: Autenticar no Supabase Auth PRIMEIRO
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> Credenciais inv\u00e1lidas.</div>';
        return;
      }

      // Passo 2: Verificar superadmin via API admin (bypassa RLS com service role)
      const token = data.session?.access_token;
      const verifyRes = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'verifySuperAdmin', data: { email, authUid: data.user?.id } }),
      });
      const verifyBody = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok || !verifyBody.user) {
        await supabaseClient.auth.signOut();
        alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> Este e-mail n\u00e3o possui acesso administrativo.</div>';
        return;
      }

      // Passo 3: Montar sess\u00e3o do super admin
      const suUser = verifyBody.user;
      const suData = DB._toCamel ? DB._toCamel(suUser) : suUser;
      const name = suData.name || suData.displayName || email;

      // Recarregar dados agora que auth_id est\u00e1 vinculado (RLS funciona)
      await DB.init();

      const session = { id: suData.id, name, email: suData.email || email, role: 'superadmin', schoolId: null, planId: null };
      Auth._save(session);
      Router.go('superadmin-dashboard');

    } catch (err) {
      console.error('[SuperAdmin]', err);
      alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> Erro: ${err.message || 'Falha na autentica\u00e7\u00e3o.'}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar'; }
    }
  },

  // Verifica se URL contém token de reset de senha (vindo do email)
  async checkPasswordResetToken() {
    // 1. Verificar query params (?reset_token=...&email=...)
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset_token');
    const resetEmail = params.get('email');

    if (resetToken && resetEmail) {
      console.log('[Login] Reset token encontrado na URL:', resetToken.slice(0, 8) + '...');
      this._showResetPasswordForm(resetToken, resetEmail);
      return true;
    }

    // 2. Verificar hash (Supabase recovery links)
    const hash = window.location.hash;
    if (!hash.includes('type=recovery') && !hash.includes('access_token')) return false;

    if (!supabaseClient) return false;

    // Aguardar o Supabase JS processar os tokens da hash
    for (let i = 0; i < 3; i++) {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session) {
        this._showResetPasswordForm();
        return true;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  },

  _showResetPasswordForm(resetToken, resetEmail) {
    // Armazenar token e email em URL fragment apenas (não em sessionStorage para evitar XSS)
    // O URL fragment (#) não é enviado ao servidor, protegendo contra logs
    if (resetToken && resetEmail) {
      window.history.replaceState({}, '', `#reset_token=${encodeURIComponent(resetToken)}&reset_email=${encodeURIComponent(resetEmail)}`);
    }

    const app = document.getElementById('app');
    const emailDisplay = resetEmail ? `<p style="text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:16px;">E-mail: <strong>${resetEmail}</strong></p>` : '';

    app.innerHTML = `
      <div class="login-wrap">
        <div class="login-card" style="max-width:400px;">
          <div class="login-logo">
            <div class="logo-icon"><i class="fa-solid fa-lock-open"></i></div>
            <h1>Nova Senha</h1>
            <p>Defina sua nova senha de acesso</p>
          </div>
          ${emailDisplay}
          <div id="reset-alert"></div>
          <div class="form-group">
            <label class="form-label">Nova senha *</label>
            <div style="position:relative;">
              <input type="password" class="form-control" id="resetNewPass" placeholder="M\u00edn. 8 caracteres, mai\u00fasc., n\u00famero e s\u00edmbolo" oninput="LoginPage.attachPasswordStrength('resetNewPass','resetPassMeter')" style="padding-right:42px;" />
              <button type="button" onclick="LoginPage.togglePassword('resetNewPass', this)"
                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                       background:none;border:none;cursor:pointer;color:var(--text-muted);
                       font-size:15px;padding:4px;line-height:1;">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
            <div id="resetPassMeter"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirmar nova senha *</label>
            <div style="position:relative;">
              <input type="password" class="form-control" id="resetNewPassConfirm" placeholder="Repita a senha" style="padding-right:42px;" />
              <button type="button" onclick="LoginPage.togglePassword('resetNewPassConfirm', this)"
                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                       background:none;border:none;cursor:pointer;color:var(--text-muted);
                       font-size:15px;padding:4px;line-height:1;">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
          </div>
          <button class="btn btn-primary w-100" style="margin-top:12px;" onclick="LoginPage.submitResetPassword()">
            <i class="fa-solid fa-floppy-disk"></i> Salvar Nova Senha
          </button>
        </div>
      </div>`;
  },

  async submitResetPassword() {
    const alertEl = document.getElementById('reset-alert');
    const pass    = document.getElementById('resetNewPass').value;
    const confirm = document.getElementById('resetNewPassConfirm').value;
    const btn = document.querySelector('.btn-primary[onclick*="submitResetPassword"]');

    const v = this._validatePassword(pass, confirm);
    if (!v.ok) {
      alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;">${v.msg}</div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    try {
      // Buscar token do URL fragment (seguro contra XSS e logging)
      const { resetToken, resetEmail } = getHashParams();

      // Se temos um token customizado (vindo do email), usar o backend para validar
      if (resetToken && resetEmail) {
        console.log('[Reset Password] Enviando request ao backend com token');
        const apiRes = await fetch('/api/asaas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resetPasswordWithToken',
            data: {
              email: resetEmail,
              resetToken: resetToken,
              newPassword: pass,
            },
          }),
        });

        const apiData = await apiRes.json();
        if (!apiRes.ok) {
          console.error('[Reset Password] Erro do backend:', apiData);
          alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;"><i class="fa-solid fa-circle-exclamation"></i> ${apiData.error || 'Erro ao resetar senha.'}</div>`;
          return;
        }

        // Limpar URL fragment (remove parâmetros de reset)
        window.history.replaceState({}, '', window.location.pathname + window.location.search);

        // Fazer signOut global do Supabase para invalidar qualquer JWT em cache
        try {
          if (supabaseClient) {
            await supabaseClient.auth.signOut({ scope: 'global' });
          }
        } catch (_) {}

        // Limpar sess\u00e3o local tamb\u00e9m
        try { localStorage.removeItem('ges_session'); } catch (_) {}
        try { sessionStorage.removeItem('ges_session'); } catch (_) {}

        // Limpar tokens do Supabase no localStorage (chaves come\u00e7am com sb-)
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
        } catch (_) {}

        alertEl.innerHTML = `<div class="alert alert-success" style="font-size:13px;">
          <i class="fa-solid fa-check-circle"></i> Senha alterada com sucesso! Redirecionando para login...
        </div>`;
        // Reload completo para reinicializar DB e sess\u00e3o limpa
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        // Fluxo padr\u00e3o Supabase (hash recovery)
        console.log('[Reset Password] Usando fluxo Supabase padr\u00e3o');
        const { error } = await supabaseClient.auth.updateUser({ password: pass });
        if (error) {
          alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;">${error.message}</div>`;
          return;
        }
        alertEl.innerHTML = `<div class="alert alert-success" style="font-size:13px;">
          <i class="fa-solid fa-check-circle"></i> Senha alterada com sucesso! Por seguran\u00e7a, todas as sess\u00f5es foram encerradas. Fa\u00e7a login novamente...
        </div>`;
        try { await supabaseClient.auth.signOut({ scope: 'global' }); } catch (_) {}
        window.location.hash = '';
        setTimeout(() => Router.go('login'), 2500);
      }
    } catch (e) {
      console.error('[Reset Password] Erro:', e);
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">Erro ao salvar senha. Tente novamente.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Nova Senha'; }
    }
  },

  // ---------- Validação de força de senha (compartilhada) ----------
  _validatePassword(pass, confirm) {
    if (!pass || pass.length < 8) {
      return { ok: false, msg: 'A senha deve ter no m\u00ednimo 8 caracteres.' };
    }
    if (!/[A-Z]/.test(pass)) return { ok: false, msg: 'A senha deve conter ao menos uma letra mai\u00fascula.' };
    if (!/[a-z]/.test(pass)) return { ok: false, msg: 'A senha deve conter ao menos uma letra min\u00fascula.' };
    if (!/[0-9]/.test(pass)) return { ok: false, msg: 'A senha deve conter ao menos um n\u00famero.' };
    if (!/[^A-Za-z0-9]/.test(pass)) return { ok: false, msg: 'A senha deve conter ao menos um s\u00edmbolo (!@#$...).' };
    const weak = ['12345678','senha123','password','qwerty123','abc12345','gestescolar'];
    if (weak.includes(pass.toLowerCase())) return { ok: false, msg: 'Esta senha \u00e9 muito comum. Escolha outra.' };
    if (confirm !== undefined && pass !== confirm) {
      return { ok: false, msg: 'As senhas n\u00e3o coincidem.' };
    }
    return { ok: true };
  },

  _passwordScore(pass) {
    let s = 0;
    if (!pass) return 0;
    if (pass.length >= 8) s++;
    if (pass.length >= 12) s++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) s++;
    if (/[0-9]/.test(pass)) s++;
    if (/[^A-Za-z0-9]/.test(pass)) s++;
    return Math.min(s, 4);
  },

  attachPasswordStrength(inputId, meterId) {
    const input = document.getElementById(inputId);
    const meter = document.getElementById(meterId);
    if (!input || !meter) return;
    const render = () => {
      const score = this._passwordScore(input.value);
      const colors = ['#e0e0e0', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#2e7d32'];
      const labels = ['', 'Muito fraca', 'Fraca', 'Razo\u00e1vel', 'Forte', 'Muito forte'];
      const pct = (score / 4) * 100;
      meter.innerHTML = `
        <div style="height:6px;background:#eee;border-radius:4px;overflow:hidden;margin-top:4px;">
          <div style="height:100%;width:${pct}%;background:${colors[score+1]||colors[0]};transition:all .25s;"></div>
        </div>
        <div style="font-size:11px;color:${colors[score+1]||'#888'};margin-top:2px;">${labels[score+1]||''}</div>`;
    };
    input.addEventListener('input', render);
    render();
  },

  async saveNewPassword() {
    const alertEl = document.getElementById('newpass-alert');
    const pass    = document.getElementById('newPassword').value;
    const confirm = document.getElementById('newPasswordConfirm').value;
    const btn     = document.querySelector('#newpass-overlay .btn-primary');

    const v = this._validatePassword(pass, confirm);
    if (!v.ok) {
      alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;">${v.msg}</div>`;
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
    try {
      // Usa Supabase Auth (sess\u00e3o j\u00e1 est\u00e1 ativa ap\u00f3s login bem-sucedido)
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.updateUser({ password: pass });
        if (error) {
          alertEl.innerHTML = `<div class="alert alert-danger" style="font-size:13px;">Erro ao salvar senha: ${error.message}</div>`;
          return;
        }
      }
      // Marca flag no banco (sem armazenar a senha em texto)
      await DB.updateUser(this._pendingUser.id, { needsPasswordChange: false });
      document.getElementById('newpass-overlay').style.display = 'none';
      this.redirect(this._pendingUser.role, this._pendingUser.roles);
    } catch (e) {
      console.error('[saveNewPassword]', e);
      alertEl.innerHTML = '<div class="alert alert-danger" style="font-size:13px;">Erro ao salvar senha. Tente novamente.</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar e Entrar'; }
    }
  }
};
