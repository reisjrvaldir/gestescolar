// =============================================
//  GESTESCOLAR – DOCUMENTOS ASAAS (KYC)
//  Página onde o gestor envia documentos para
//  ativação da subconta Asaas (verificação KYC)
// =============================================

Router.register('admin-asaas-documents', () => {
  const user = Auth.require();
  if (!user) return;
  if (user.role !== 'admin' && user.role !== 'gestor') {
    Utils.toast('Acesso restrito ao gestor da escola.', 'error');
    Router.go('admin');
    return;
  }

  const school = DB.getSchool(user.schoolId);
  if (!school) {
    Utils.toast('Escola não encontrada.', 'error');
    return;
  }

  const personType = school.asaasPersonType || 'PJ';
  const status     = school.asaasDocumentsStatus || 'pending';
  const docs       = school.asaasDocuments || {};
  const message    = school.asaasVerificationMessage || '';

  // Status visual
  const statusBadges = {
    'not_required':         { color: '#9E9E9E', icon: 'fa-circle-info',           text: 'Não solicitado' },
    'pending':              { color: '#FF9800', icon: 'fa-hourglass-half',        text: 'Aguardando envio'},
    'pending_verification': { color: '#2196F3', icon: 'fa-rotate',                text: 'Em análise pelo Asaas' },
    'verified':             { color: '#4CAF50', icon: 'fa-circle-check',          text: 'Verificada e ativa' },
    'rejected':             { color: '#F44336', icon: 'fa-circle-exclamation',    text: 'Reprovada — reenvie' },
  };
  const badge = statusBadges[status] || statusBadges.pending;

  // Documentos exigidos por tipo de pessoa
  const requiredDocs = AdminAsaasDocs._getRequiredDocs(personType);

  // Bloquear edição se já está em verificação ou aprovado
  const lockedForEdit = (status === 'pending_verification' || status === 'verified');

  Router.renderLayout(user, 'admin-asaas-documents', `
    <div style="max-width:780px;margin:0 auto;">
      <h2 style="margin-bottom:8px;">
        <i class="fa-solid fa-id-card" style="color:var(--primary);"></i>
        Documentos Asaas (KYC)
      </h2>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">
        Envie os documentos abaixo para criar e ativar a subconta de pagamentos da sua escola.
        Sem essa verificação, não é possível receber via PIX, fazer saques ou emitir cobranças.
      </p>

      <!-- STATUS GERAL -->
      <div class="card" style="margin-bottom:20px;">
        <div style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-left:4px solid ${badge.color};">
          <i class="fa-solid ${badge.icon}" style="color:${badge.color};font-size:24px;"></i>
          <div style="flex:1;">
            <div style="font-weight:700;font-size:15px;color:${badge.color};">${badge.text}</div>
            ${message ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${Utils.escape(message)}</div>` : ''}
            ${school.asaasDocumentsSubmittedAt ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Enviado em ${Utils.date(school.asaasDocumentsSubmittedAt)}</div>` : ''}
          </div>
          <div>
            <span class="badge" style="background:${badge.color};color:white;padding:5px 12px;border-radius:12px;font-size:11px;font-weight:700;">
              ${(personType || 'PJ').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <!-- INFO DA ESCOLA -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title">Dados Cadastrais</span></div>
        <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          <div><strong>Nome:</strong> ${Utils.escape(school.name || '--')}</div>
          <div><strong>${personType === 'CPF' ? 'CPF' : 'CNPJ'}:</strong> ${Utils.escape(school.cnpj || '--')}</div>
          <div><strong>E-mail:</strong> ${Utils.escape(school.email || '--')}</div>
          <div><strong>Telefone:</strong> ${Utils.escape(school.phone || '--')}</div>
          <div style="grid-column:1/-1;"><strong>Endereço:</strong>
            ${Utils.escape([school.address, school.addressNumber, school.complement, school.province, school.city, school.state, school.postalCode].filter(Boolean).join(', ') || '--')}
          </div>
        </div>
        ${lockedForEdit ? '' : `
          <div style="padding:0 20px 16px;font-size:12px;color:var(--text-muted);">
            <i class="fa-solid fa-circle-info"></i>
            Para alterar esses dados, vá em
            <a href="#" onclick="Router.go('admin-settings');return false;" style="color:var(--primary);">Configurações da Escola</a>.
          </div>
        `}
      </div>

      <!-- UPLOAD DE DOCUMENTOS -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-header"><span class="card-title">Documentos Necessários (${personType})</span></div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:18px;">
          ${requiredDocs.map(d => AdminAsaasDocs._renderDocSlot(d, docs[d.key], lockedForEdit)).join('')}
        </div>
      </div>

      <!-- BOTÕES DE AÇÃO -->
      <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
        ${lockedForEdit ? `
          <button class="btn btn-outline" onclick="AdminAsaasDocs.refreshStatus()">
            <i class="fa-solid fa-rotate"></i> Atualizar Status
          </button>
        ` : `
          <button class="btn btn-primary" onclick="AdminAsaasDocs.submitForVerification()">
            <i class="fa-solid fa-paper-plane"></i> Enviar para Verificação
          </button>
        `}
      </div>

      <!-- AVISO LEGAL -->
      <div style="margin-top:24px;padding:14px;background:#f5f5f5;border-radius:8px;font-size:12px;color:var(--text-muted);">
        <i class="fa-solid fa-shield-halved"></i>
        Os documentos são enviados de forma criptografada para o Asaas (gateway de pagamentos)
        para conformidade com normas BACEN/COAF (KYC). O GestEscolar não compartilha esses
        dados com terceiros.
      </div>
    </div>
  `);
});

// =============================================
//  CONTROLLER: AdminAsaasDocs
// =============================================
const AdminAsaasDocs = {

  // Buffer de arquivos pendentes (antes de submit)
  _pendingFiles: {},

  // Documentos exigidos por tipo de pessoa
  _getRequiredDocs(personType) {
    const common = [
      { key: 'identification', label: 'Documento de Identidade (RG ou CNH)', accept: 'image/*,.pdf', hint: 'Frente e verso (PDF) ou imagem nítida.' },
      { key: 'addressProof',   label: 'Comprovante de Endereço',              accept: 'image/*,.pdf', hint: 'Conta de luz/água/telefone dos últimos 90 dias.' },
    ];
    if (personType === 'PJ') {
      return [
        { key: 'cnpjCard',       label: 'Cartão CNPJ',                          accept: 'image/*,.pdf', hint: 'Comprovante de inscrição no CNPJ.' },
        { key: 'socialContract', label: 'Contrato Social ou Última Alteração', accept: '.pdf,image/*', hint: 'Documento que comprove os sócios atuais.' },
        ...common,
      ];
    }
    if (personType === 'MEI') {
      return [
        { key: 'ccmei',     label: 'Certificado MEI (CCMEI)', accept: 'image/*,.pdf', hint: 'Emitido em gov.br/empresas.' },
        ...common,
      ];
    }
    // CPF
    return [
      { key: 'cpfDoc', label: 'Comprovante de CPF', accept: 'image/*,.pdf', hint: 'Apenas se o CPF não estiver no RG/CNH.' },
      ...common,
    ];
  },

  // Renderiza cada slot de upload
  _renderDocSlot(doc, currentMeta, locked) {
    const hasFile = !!currentMeta?.url;
    return `
      <div style="border:1px solid var(--border);border-radius:8px;padding:14px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:600;font-size:14px;margin-bottom:3px;">
              <i class="fa-solid fa-file-lines" style="color:var(--primary);"></i>
              ${Utils.escape(doc.label)}
            </div>
            <div style="font-size:11px;color:var(--text-muted);">${Utils.escape(doc.hint)}</div>
            ${hasFile ? `
              <div style="margin-top:8px;font-size:12px;color:#4CAF50;">
                <i class="fa-solid fa-circle-check"></i>
                ${Utils.escape(currentMeta.fileName || 'Arquivo enviado')}
                ${currentMeta.uploadedAt ? `<span style="color:var(--text-muted);"> - ${Utils.date(currentMeta.uploadedAt)}</span>` : ''}
              </div>
            ` : ''}
            <div id="adoc-status-${doc.key}" style="margin-top:6px;font-size:12px;"></div>
          </div>
          ${locked ? '' : `
            <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
              <input type="file" id="adoc-file-${doc.key}" accept="${doc.accept}"
                     onchange="AdminAsaasDocs._onFileSelected('${doc.key}', this)"
                     style="display:none;" />
              <button class="btn btn-sm btn-outline" type="button"
                      onclick="document.getElementById('adoc-file-${doc.key}').click()">
                <i class="fa-solid fa-upload"></i>
                ${hasFile ? 'Substituir' : 'Selecionar Arquivo'}
              </button>
              ${hasFile ? `
                <a class="btn btn-sm btn-outline" href="${Utils.escape(currentMeta.url || '#')}" target="_blank" rel="noopener">
                  <i class="fa-solid fa-eye"></i> Ver
                </a>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;
  },

  // Quando o usuário seleciona um arquivo
  _onFileSelected(key, input) {
    const file = input.files?.[0];
    const statusEl = document.getElementById(`adoc-status-${key}`);
    if (!file) {
      this._pendingFiles[key] = null;
      if (statusEl) statusEl.textContent = '';
      return;
    }
    // Limite de 5MB
    if (file.size > 5 * 1024 * 1024) {
      Utils.toast('Arquivo muito grande. Máximo 5MB.', 'error');
      input.value = '';
      return;
    }
    // Tipos aceitos: PDF e imagens
    const okType = /^(application\/pdf|image\/(jpeg|png|jpg|webp))$/.test(file.type);
    if (!okType) {
      Utils.toast('Tipo de arquivo não suportado. Use PDF, JPG ou PNG.', 'error');
      input.value = '';
      return;
    }
    this._pendingFiles[key] = file;
    if (statusEl) {
      statusEl.innerHTML = `<i class="fa-solid fa-circle-info" style="color:#2196F3;"></i> Pronto para enviar: <strong>${Utils.escape(file.name)}</strong> (${(file.size / 1024).toFixed(0)} KB)`;
    }
  },

  // Converte File em base64 para envio ao backend
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64  = dataUrl.split(',')[1] || '';
        resolve({ base64, mime: file.type, name: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Envia documentos para verificação
  async submitForVerification() {
    const user = Auth.require();
    if (!user) return;
    const school = DB.getSchool(user.schoolId);
    if (!school) return;

    const personType = school.asaasPersonType || 'PJ';
    const required = this._getRequiredDocs(personType);
    const existing = school.asaasDocuments || {};

    // Verificar quais docs estão faltando
    const missing = required.filter(d => !this._pendingFiles[d.key] && !existing[d.key]?.url);
    if (missing.length > 0) {
      Utils.toast(`Faltam documentos: ${missing.map(d => d.label).join(', ')}`, 'error');
      return;
    }

    // Confirmar (Utils.confirm usa callback, não Promise)
    Utils.confirm(
      'Após enviar, você não poderá editar até o Asaas concluir a análise. Deseja continuar?',
      () => this._doSubmit(school, required)
    );
  },

  // Executa o envio dos documentos para o backend
  async _doSubmit(school, required) {
    Utils.toast('Enviando documentos... Isso pode levar alguns segundos.', 'info');

    try {
      // Converter arquivos pendentes em base64
      const filesPayload = {};
      for (const doc of required) {
        const file = this._pendingFiles[doc.key];
        if (file) {
          filesPayload[doc.key] = await this._fileToBase64(file);
        }
      }

      // Chamar backend
      const result = await AsaasClient._call('uploadAndVerifySchoolDocuments', {
        schoolId: school.id,
        files: filesPayload,
      });

      if (!result) return; // toast já mostrado pelo _call

      // Atualizar local
      DB.updateSchool(school.id, {
        asaasDocuments: result.documents || {},
        asaasDocumentsStatus: 'pending_verification',
        asaasDocumentsSubmittedAt: new Date().toISOString(),
        asaasAccountId: result.accountId || school.asaasAccountId,
        asaasWalletId:  result.walletId  || school.asaasWalletId,
        asaasSubApiKey: result.apiKey    || school.asaasSubApiKey,
      });

      this._pendingFiles = {};
      Utils.toast('Documentos enviados! Aguardando análise do Asaas.', 'success');
      Router.go('admin-asaas-documents');

    } catch (err) {
      console.error('[AdminAsaasDocs] submit error:', err);
      Utils.toast('Erro ao enviar documentos: ' + (err.message || 'desconhecido'), 'error');
    }
  },

  // Atualiza status consultando o Asaas
  async refreshStatus() {
    const user = Auth.require();
    if (!user) return;
    const school = DB.getSchool(user.schoolId);
    if (!school || !school.asaasAccountId) {
      Utils.toast('Subconta Asaas ainda não foi criada.', 'warning');
      return;
    }

    Utils.toast('Consultando status...', 'info');
    try {
      const result = await AsaasClient._call('checkSchoolDocumentsStatus', {
        schoolId: school.id,
      });
      if (!result) return;

      DB.updateSchool(school.id, {
        asaasDocumentsStatus: result.status || school.asaasDocumentsStatus,
        asaasVerificationMessage: result.message || '',
      });

      Utils.toast('Status atualizado.', 'success');
      Router.go('admin-asaas-documents');
    } catch (err) {
      console.error('[AdminAsaasDocs] refresh error:', err);
      Utils.toast('Erro ao atualizar status.', 'error');
    }
  },
};

// Expor globalmente para handlers inline
window.AdminAsaasDocs = AdminAsaasDocs;
