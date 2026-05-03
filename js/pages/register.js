// =============================================
//  GESTESCOLAR – CADASTRO DE FUNCIONÁRIOS
// =============================================

Router.register('register', (params = {}) => {
  const user = Auth.current();
  const fromPanel = user && ['administrativo','gestor'].includes(user.role);

  const app = document.getElementById('app');

  const formHTML = `
    <div class="${fromPanel ? '' : 'register-wrap'}">
      <div class="${fromPanel ? 'card' : 'register-card'}">
        <div class="${fromPanel ? 'card-header' : 'register-header'}">
          ${fromPanel ? `
            <span class="card-title"><i class="fa-solid fa-user-plus"></i> Cadastro de Funcionário</span>
            <button class="btn btn-outline btn-sm" onclick="Router.go('admin-staff')">
              <i class="fa-solid fa-arrow-left"></i> Voltar
            </button>
          ` : `
            <h2><i class="fa-solid fa-graduation-cap"></i> GestEscolar</h2>
            <p>Cadastro de Funcionário / Acesso</p>
          `}
        </div>
        <div class="${fromPanel ? '' : 'register-body'}">
          <div id="reg-alert"></div>

          <!-- Seletor de Função (múltipla seleção) -->
          <div class="form-section-title">Selecione a(s) função(ões)
            <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:6px;">Você pode combinar perfis</span>
          </div>
          <div class="role-selector" id="roleSelector" style="flex-wrap:wrap;">
            <div class="role-option" data-role="administrativo" onclick="RegisterPage.toggleRole(this)">
              <div class="role-icon">🏫</div>
              <div class="role-name">Administrativo</div>
              <div class="role-desc">Gestão de alunos, turmas e pessoal</div>
              <div class="role-check" style="margin-top:6px;font-size:18px;display:none;">✔</div>
            </div>
            <div class="role-option" data-role="financeiro" onclick="RegisterPage.toggleRole(this)">
              <div class="role-icon">💰</div>
              <div class="role-name">Financeiro</div>
              <div class="role-desc">CRM, boletos e contas a pagar</div>
              <div class="role-check" style="margin-top:6px;font-size:18px;display:none;">✔</div>
            </div>
            <div class="role-option" data-role="professor" onclick="RegisterPage.toggleRole(this)">
              <div class="role-icon">📚</div>
              <div class="role-name">Professor(a)</div>
              <div class="role-desc">Chamadas, notas e mensagens</div>
              <div class="role-check" style="margin-top:6px;font-size:18px;display:none;">✔</div>
            </div>
            <div class="role-option" data-role="gestor" onclick="RegisterPage.toggleRole(this)">
              <div class="role-icon">💼</div>
              <div class="role-name">Gestor</div>
              <div class="role-desc">Acesso total exceto responsáveis</div>
              <div class="role-check" style="margin-top:6px;font-size:18px;display:none;">✔</div>
            </div>
          </div>
          <div id="roles-selected-label" style="font-size:12px;color:var(--text-muted);margin-top:4px;min-height:18px;"></div>

          <form id="registerForm" onsubmit="RegisterPage.submit(event)">
            <!-- Dados Pessoais -->
            <div class="form-section-title">Dados pessoais</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nome completo *</label>
                <input type="text" class="form-control" id="regName" placeholder="Ex: Maria Silva" required data-mask="name" maxlength="80" />
              </div>
              <div class="form-group">
                <label class="form-label">E-mail *</label>
                <input type="email" class="form-control" id="regEmail" placeholder="Ex: maria@escola.com" required />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">CPF *</label>
                <input type="text" class="form-control" id="regCpf" placeholder="000.000.000-00" maxlength="14" required />
              </div>
              <div class="form-group">
                <label class="form-label">Telefone *</label>
                <input type="text" class="form-control" id="regPhone" placeholder="(00) 00000-0000" maxlength="15" required data-mask="phone" inputmode="numeric" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Data de nascimento</label>
                <input type="date" class="form-control" id="regDob" />
              </div>
              <div class="form-group">
                <label class="form-label">Gênero</label>
                <select class="form-control" id="regGender">
                  <option value="">Selecione</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro / Prefiro não informar</option>
                </select>
              </div>
            </div>

            <!-- Dados de Acesso -->
            <div id="passwordSection">
              <div class="form-section-title">Dados de acesso</div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Senha *</label>
                  <input type="password" class="form-control" id="regPassword" placeholder="Mínimo 6 caracteres" minlength="6" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmar senha *</label>
                  <input type="password" class="form-control" id="regPasswordConfirm" placeholder="Repita a senha" required />
                </div>
              </div>
            </div>

            <!-- Campos por função -->
            <div id="roleSpecificFields"></div>

            <input type="hidden" id="regRole" value="" />

            <div style="display:flex;gap:12px;margin-top:8px;">
              ${fromPanel ? `<button type="button" class="btn btn-outline" onclick="Router.go('admin-staff')">Cancelar</button>` : `<button type="button" class="btn btn-outline" onclick="Router.go('login')">Voltar ao login</button>`}
              <button type="submit" class="btn btn-primary" style="flex:1;">
                <i class="fa-solid fa-floppy-disk"></i> Salvar Cadastro
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  if (fromPanel) {
    Router.renderLayout(user, 'register', formHTML);
  } else {
    app.innerHTML = formHTML;
  }

  // Para usuário demo: remove obrigatoriedade de todos os campos
  if (Auth.isDemo()) {
    const form = document.getElementById('registerForm');
    if (form) {
      form.setAttribute('novalidate', 'true');
      form.querySelectorAll('[required]').forEach(el => el.removeAttribute('required'));
      form.querySelectorAll('[minlength]').forEach(el => el.removeAttribute('minlength'));
    }
  }

  // Máscara CPF (Telefone agora usa data-mask="phone" global em utils.js)
  document.getElementById('regCpf').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d)/, '$1.$2')
         .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    e.target.value = v;
  });

  // Se veio com preRole (ex: "professor"), pré-selecionar automaticamente
  if (params.preRole) {
    const el = document.querySelector(`[data-role="${params.preRole}"]`);
    if (el) RegisterPage.toggleRole(el);
  }
});

const RegisterPage = {
  _roles: [],

  // Gera senha aleatória usando crypto.getRandomValues (sem caracteres ambíguos: 0/O, 1/l/I)
  _gerarSenhaAleatoria(tamanho = 10) {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const buf = new Uint32Array(tamanho);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    let out = '';
    for (let i = 0; i < tamanho; i++) out += alfabeto[buf[i] % alfabeto.length];
    return out;
  },

  toggleRole(el) {
    const role = el.dataset.role;
    const idx  = this._roles.indexOf(role);
    if (idx >= 0) {
      this._roles.splice(idx, 1);
      el.classList.remove('selected');
      el.querySelector('.role-check').style.display = 'none';
    } else {
      this._roles.push(role);
      el.classList.add('selected');
      el.querySelector('.role-check').style.display = 'block';
    }

    const labelMap = { administrativo:'Administrativo', financeiro:'Financeiro', professor:'Professor(a)', gestor:'Gestor' };
    const lbl = document.getElementById('roles-selected-label');
    lbl.textContent = this._roles.length
      ? '✔ Selecionado(s): ' + this._roles.map(r => labelMap[r]).join(' + ')
      : '';
    document.getElementById('regRole').value = this._roles[0] || '';
    this.renderRoleFields(this._roles);

    // Esconder/mostrar campos de senha conforme role
    const isProfSel = this._roles.includes('professor');
    const pwSection = document.getElementById('passwordSection');
    if (pwSection) {
      pwSection.style.display = isProfSel ? 'none' : '';
      const pwInputs = pwSection.querySelectorAll('input');
      pwInputs.forEach(inp => {
        if (isProfSel) { inp.removeAttribute('required'); inp.removeAttribute('minlength'); }
        else { inp.setAttribute('required', ''); if (inp.id === 'regPassword') inp.setAttribute('minlength', '6'); }
      });
    }
  },

  renderRoleFields(roles) {
    const container = document.getElementById('roleSpecificFields');
    const role = Array.isArray(roles) ? (roles.includes('professor') ? 'professor' : roles[0]) : roles;
    if (role === 'professor') {
      const classes = DB.getClasses();
      container.innerHTML = `
        <div class="form-section-title">Dados do Professor</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Disciplina principal *</label>
            <input type="text" class="form-control" id="regSubject" placeholder="Ex: Matemática" />
          </div>
          <div class="form-group">
            <label class="form-label">Turma responsável</label>
            <select class="form-control" id="regClassId">
              <option value="">Nenhuma</option>
              ${classes.map(c => `<option value="${c.id}">${Utils.escape(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Formação acadêmica</label>
          <input type="text" class="form-control" id="regEducation" placeholder="Ex: Licenciatura em Matemática – USP" />
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  },

  async submit(e) {
    e.preventDefault();
    const alertEl = document.getElementById('reg-alert');
    const demo    = Auth.isDemo();

    const role = document.getElementById('regRole').value;
    if (!role || this._roles.length === 0) {
      alertEl.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> Selecione ao menos uma função antes de prosseguir.</div>`;
      return;
    }

    const cpfRaw = document.getElementById('regCpf').value;
    const cpfDigits = (cpfRaw || '').replace(/\D/g, '');
    const isProfessor = this._roles.includes('professor');

    // Professor: senha automática aleatória (10 chars: letras + dígitos)
    let password;
    if (isProfessor) {
      password = this._gerarSenhaAleatoria(10);
    } else {
      password = document.getElementById('regPassword').value;
      const confirm = document.getElementById('regPasswordConfirm').value;
      if (!demo && password !== confirm) {
        alertEl.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> As senhas não coincidem.</div>`;
        return;
      }
    }

    const email = document.getElementById('regEmail').value.trim().toLowerCase();
    if (!demo && DB.findUserByEmail(email)) {
      alertEl.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> Este e-mail já está cadastrado.</div>`;
      return;
    }

    const userData = {
      name:     document.getElementById('regName').value.trim(),
      email,
      password,
      cpf:      cpfRaw,
      phone:    document.getElementById('regPhone').value,
      dob:      document.getElementById('regDob').value,
      gender:   document.getElementById('regGender').value,
      role,
      roles:    this._roles.length > 1 ? [...this._roles] : undefined,
      active:   true,
    };

    // Professor: gerar matricula global unica (mesma sequencia dos alunos)
    if (isProfessor) {
      userData.matricula = await DB.nextMatricula();
    }

    // Campos específicos
    if (role === 'professor') {
      userData.subject   = document.getElementById('regSubject')?.value || '';
      userData.classId   = document.getElementById('regClassId')?.value || '';
      userData.education = document.getElementById('regEducation')?.value || '';
    }

    // Verificar limites do plano
    if (role === 'professor') {
      const limCheck = Auth.checkLimit('teachers');
      if (!limCheck.ok) { Plans.showUpgradeModal(limCheck.msg); return; }
    } else if (role === 'gestor' || role === 'administrativo') {
      const limCheck = Auth.checkLimit('gestors');
      if (!limCheck.ok) { Plans.showUpgradeModal(limCheck.msg); return; }
    }

    const saved = await DB.addUser(userData);
    if (!saved) {
      alertEl.innerHTML = `<div class="alert alert-danger"><i class="fa-solid fa-circle-exclamation"></i> Erro ao salvar no banco de dados. Tente novamente.</div>`;
      return;
    }

    if (isProfessor) {
      // Modal bloqueante exibe a senha — gestor precisa confirmar manualmente que anotou
      const senhaEsc      = Utils.escape(password);
      const matriculaEsc  = Utils.escape(userData.matricula || '');
      const emailEsc      = Utils.escape(userData.email);
      const nomeEsc       = Utils.escape(userData.name);
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999;';
      overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:28px;max-width:480px;width:92%;box-shadow:0 12px 40px rgba(0,0,0,.3);">
          <h3 style="margin:0 0 12px;color:#2e7d32;"><i class="fa-solid fa-circle-check"></i> Professor cadastrado</h3>
          <p style="margin:0 0 14px;font-size:14px;color:#333;">Anote a senha provisória abaixo e repasse a <strong>${nomeEsc}</strong> de forma segura. Ela <u>não será exibida novamente</u>.</p>
          <div style="background:#f7f7f9;border:1px solid #e0e0e0;border-radius:8px;padding:14px;font-size:14px;line-height:1.7;">
            <div><strong>Matrícula:</strong> ${matriculaEsc}</div>
            <div><strong>Login (e-mail):</strong> ${emailEsc}</div>
            <div><strong>Senha provisória:</strong> <code style="background:#fff;padding:3px 8px;border:1px solid #ccc;border-radius:4px;font-size:15px;font-weight:bold;letter-spacing:1px;">${senhaEsc}</code>
              <button type="button" id="copySenhaBtn" style="margin-left:8px;padding:3px 10px;border:1px solid #2196F3;background:#fff;color:#2196F3;border-radius:4px;cursor:pointer;font-size:12px;"><i class="fa-solid fa-copy"></i> Copiar</button>
            </div>
          </div>
          <div style="background:#fff3cd;border-left:3px solid #ff9800;padding:8px 12px;margin-top:14px;font-size:12px;color:#7a4f00;">
            <i class="fa-solid fa-triangle-exclamation"></i> Após fechar este aviso, a senha não pode ser recuperada — apenas redefinida.
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
            <button type="button" id="confirmSenhaBtn" class="btn btn-primary"><i class="fa-solid fa-check"></i> Já anotei, continuar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#copySenhaBtn').onclick = async () => {
        try { await navigator.clipboard.writeText(password); Utils.toast('Senha copiada para a área de transferência.', 'success'); }
        catch { Utils.toast('Falha ao copiar — selecione e copie manualmente.', 'warning'); }
      };
      overlay.querySelector('#confirmSenhaBtn').onclick = () => {
        overlay.remove();
        const cur = Auth.current();
        if (cur && ['administrativo','gestor'].includes(cur.role)) Router.go('admin-staff');
      };
    } else {
      alertEl.innerHTML = `<div class="alert alert-success"><i class="fa-solid fa-check-circle"></i> Funcionário cadastrado com sucesso!</div>`;
    }
    Utils.toast(`${userData.name} cadastrado(a) com sucesso!`, 'success');
    document.getElementById('registerForm').reset();
    document.querySelectorAll('.role-option').forEach(e => {
      e.classList.remove('selected');
      const chk = e.querySelector('.role-check');
      if (chk) chk.style.display = 'none';
    });
    document.getElementById('roleSpecificFields').innerHTML = '';
    document.getElementById('roles-selected-label').textContent = '';
    this._roles = [];
    document.getElementById('regRole').value = '';

    // Para não-professor: redireciona após breve toast
    if (!isProfessor) {
      setTimeout(() => {
        const cur = Auth.current();
        if (cur && ['administrativo','gestor'].includes(cur.role)) Router.go('admin-staff');
      }, 1500);
    }
  }
};
