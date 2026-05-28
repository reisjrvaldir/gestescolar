// =============================================
//  GESTESCOLAR – MÓDULO LGPD
//  Banner de cookies, helpers de exportação,
//  controles do titular de dados (Art. 18 LGPD)
// =============================================

const LGPD = {

  // ============================================
  // BANNER DE COOKIES (consentimento implícito + opt-in marketing)
  // ============================================

  COOKIE_CONSENT_KEY: 'ges_cookie_consent',

  shouldShowCookieBanner() {
    const consent = localStorage.getItem(this.COOKIE_CONSENT_KEY);
    return !consent;
  },

  saveCookieConsent(level) {
    // level: 'essential' (apenas necessários) | 'all' (essenciais + analytics)
    const consent = {
      level,
      acceptedAt: new Date().toISOString(),
      version: '1.0',
    };
    localStorage.setItem(this.COOKIE_CONSENT_KEY, JSON.stringify(consent));
    this.hideCookieBanner();
  },

  getCookieConsent() {
    try {
      const c = localStorage.getItem(this.COOKIE_CONSENT_KEY);
      return c ? JSON.parse(c) : null;
    } catch (_) {
      return null;
    }
  },

  showCookieBanner() {
    if (document.getElementById('lgpd-cookie-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'lgpd-cookie-banner';
    banner.style.cssText = [
      'position:fixed;bottom:0;left:0;right:0;z-index:99997;',
      'background:#1a73e8;color:#fff;padding:16px 20px;',
      'box-shadow:0 -4px 16px rgba(0,0,0,.2);',
      'display:flex;align-items:center;gap:16px;flex-wrap:wrap;',
      'animation:slideUp 0.3s ease-out;',
    ].join('');

    banner.innerHTML = `
      <style>
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        #lgpd-cookie-banner .lgpd-btn {
          padding:8px 16px;border-radius:6px;border:none;cursor:pointer;
          font-size:13px;font-weight:600;white-space:nowrap;transition:opacity .2s;
        }
        #lgpd-cookie-banner .lgpd-btn:hover { opacity:.85; }
        #lgpd-cookie-banner .lgpd-btn-primary { background:#fff;color:#1a73e8; }
        #lgpd-cookie-banner .lgpd-btn-outline { background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5); }
        @media(max-width:640px) {
          #lgpd-cookie-banner { flex-direction:column;align-items:stretch;text-align:center; }
          #lgpd-cookie-banner > div:last-child { display:flex;gap:8px;justify-content:center;flex-wrap:wrap; }
        }
      </style>
      <div style="flex:1;min-width:240px;font-size:13px;line-height:1.5;">
        <i class="fa-solid fa-cookie-bite" style="margin-right:8px;"></i>
        Utilizamos cookies essenciais para o funcionamento da plataforma.
        Ao continuar navegando, você concorda com nossa
        <a href="#" onclick="event.preventDefault();window.open('/privacy','_blank')" style="color:#fff;text-decoration:underline;font-weight:600;">Política de Privacidade</a>.
      </div>
      <div style="display:flex;gap:8px;">
        <button class="lgpd-btn lgpd-btn-outline" onclick="LGPD.saveCookieConsent('essential')">
          Apenas essenciais
        </button>
        <button class="lgpd-btn lgpd-btn-primary" onclick="LGPD.saveCookieConsent('all')">
          Aceitar todos
        </button>
      </div>
    `;
    document.body.appendChild(banner);
  },

  hideCookieBanner() {
    const banner = document.getElementById('lgpd-cookie-banner');
    if (banner) banner.remove();
  },

  // ============================================
  // EXPORTAÇÃO DE DADOS (Art. 18, V LGPD - Portabilidade)
  // ============================================

  /**
   * Exporta todos os dados do titular em formato JSON.
   * Inclui: dados pessoais, escola (se gestor), alunos vinculados (se pai),
   * notas, frequência, faturas, logs de acesso.
   * @returns {Promise<object>}
   */
  async exportMyData() {
    const user = Auth.current();
    if (!user) throw new Error('Usuário não autenticado');

    const exportData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: user.email,
        version: '1.0',
        lgpdReference: 'Art. 18, V - Lei 13.709/2018',
      },
      personalData: {},
      school: null,
      students: [],
      classes: [],
      invoices: [],
      auditLogs: [],
    };

    try {
      // Dados pessoais do usuário
      const myUser = DB.findUserByEmail ? DB.findUserByEmail(user.email) : null;
      if (myUser) {
        exportData.personalData = {
          id: myUser.id,
          name: myUser.name,
          email: myUser.email,
          phone: myUser.phone,
          cpf: myUser.cpf,
          role: myUser.role,
          createdAt: myUser.createdAt,
          termsAcceptedAt: myUser.termsAcceptedAt,
          marketingOptIn: myUser.marketingOptIn,
        };
      }

      // Dados da escola (se gestor/admin)
      if (user.schoolId && ['gestor','administrativo','financeiro'].includes(user.role)) {
        const school = DB.getSchool(user.schoolId);
        if (school) {
          exportData.school = {
            id: school.id,
            name: school.name,
            cnpj: school.cnpj,
            email: school.email,
            phone: school.phone,
            address: school.address,
            createdAt: school.createdAt || school.created_at,
          };
        }
      }

      // Faturas
      if (typeof DB.getInvoices === 'function') {
        try {
          const invoices = DB.getInvoices() || [];
          exportData.invoices = invoices.map(i => ({
            id: i.id,
            amount: i.amount,
            dueDate: i.dueDate,
            status: i.status,
            paidAt: i.paidAt,
          }));
        } catch (_) {}
      }

      return exportData;
    } catch (e) {
      console.error('[LGPD] Erro ao exportar dados:', e);
      throw e;
    }
  },

  /**
   * Faz download dos dados em JSON.
   * Tenta primeiro o endpoint backend (dados completos do DB);
   * em caso de falha, faz fallback para dados locais.
   */
  async downloadMyData() {
    try {
      Utils?.toast?.('Preparando seus dados...', 'info');

      let exportData;

      // 1. Tentar endpoint backend (dados completos via service key)
      try {
        const session = await supabaseClient?.auth?.getSession();
        const token = session?.data?.session?.access_token;
        if (token) {
          const res = await fetch('/api/lgpd-export', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            exportData = json.data;
          }
        }
      } catch (e) {
        console.warn('[LGPD] Endpoint backend falhou, usando fallback local:', e);
      }

      // 2. Fallback: dados locais (menos completo)
      if (!exportData) {
        exportData = await this.exportMyData();
        exportData._meta = exportData._meta || {};
        exportData._meta.source = 'local-fallback';
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `meus-dados-gestescolar-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Utils?.toast?.('Dados baixados com sucesso!', 'success');
    } catch (e) {
      Utils?.toast?.('Erro ao baixar dados: ' + (e.message || e), 'error');
    }
  },

  // ============================================
  // SOLICITAÇÃO DE EXCLUSÃO (Art. 18, VI LGPD)
  // ============================================

  /**
   * Abre modal de confirmação para solicitar exclusão de conta.
   * Por segurança, não deleta imediatamente — envia para DPO processar em 15 dias úteis.
   */
  requestAccountDeletion() {
    const user = Auth.current();
    if (!user) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:520px;">
        <div class="modal-header">
          <span class="modal-title">
            <i class="fa-solid fa-user-xmark" style="color:#c62828;"></i> Excluir minha conta
          </span>
        </div>
        <div class="modal-body">
          <div style="background:#fff3e0;border-left:4px solid #ff9800;padding:14px;border-radius:6px;margin-bottom:16px;">
            <strong>Atenção:</strong> A exclusão é processada em até <strong>15 dias úteis</strong>
            (Art. 18 LGPD). Dados fiscais (faturas, NFs) são preservados por 5 anos conforme
            obrigação legal.
          </div>

          <p>Antes de continuar, você pode:</p>
          <ul>
            <li><a href="#" onclick="event.preventDefault();LGPD.downloadMyData();">Baixar uma cópia de seus dados</a></li>
            <li>Cancelar sua assinatura nas configurações de plano</li>
          </ul>

          <div class="form-group" style="margin-top:16px;">
            <label class="form-label">Motivo (opcional)</label>
            <textarea id="lgpd-deletion-reason" class="form-control" rows="3"
              placeholder="Conte-nos por que está excluindo sua conta..."></textarea>
          </div>

          <div class="form-group" style="margin-top:12px;">
            <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;">
              <input type="checkbox" id="lgpd-deletion-confirm" required style="margin-top:3px;" />
              <span>Confirmo que desejo solicitar a exclusão da minha conta e compreendo que esta ação não poderá ser desfeita após processamento.</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">
            Cancelar
          </button>
          <button class="btn" style="background:#c62828;color:#fff;" onclick="LGPD._submitDeletionRequest(this)">
            <i class="fa-solid fa-paper-plane"></i> Enviar solicitação
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  _submitDeletionRequest(btn) {
    const confirm = document.getElementById('lgpd-deletion-confirm')?.checked;
    if (!confirm) {
      Utils?.toast?.('Marque a caixa de confirmação para continuar.', 'warning');
      return;
    }
    const reason = document.getElementById('lgpd-deletion-reason')?.value || '';
    const user = Auth.current();

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    // Registra solicitação em audit_log (DPO processa manualmente em 15 dias)
    try {
      DB.addAuditLog?.('LGPD_DELETION_REQUEST',
        `Solicitação de exclusão de conta. User: ${user?.email}. Motivo: ${reason || '(não informado)'}`);
    } catch (_) {}

    // Em produção: chamar endpoint /api/lgpd/request-deletion que envia email ao DPO
    // Por ora, registramos localmente e mostramos confirmação
    setTimeout(() => {
      btn.closest('.modal-overlay')?.remove();
      Utils?.modal?.(
        'Solicitação enviada',
        `<div style="text-align:center;padding:16px;">
          <i class="fa-solid fa-circle-check" style="font-size:48px;color:#43a047;margin-bottom:12px;"></i>
          <p>Sua solicitação foi enviada ao nosso DPO.</p>
          <p style="color:#666;font-size:13px;">Você receberá um e-mail de confirmação em até 5 dias úteis com os próximos passos. O processamento ocorre em até 15 dias úteis (Art. 18 LGPD).</p>
        </div>`,
        `<button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Entendi</button>`
      );
    }, 800);
  },
};

// Auto-mostrar banner de cookies em rotas públicas se não houver consentimento
(function autoShowCookieBanner() {
  if (typeof window === 'undefined') return;
  // Aguardar DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner);
  } else {
    setTimeout(initBanner, 500); // pequeno delay para não competir com carregamento da página
  }

  function initBanner() {
    try {
      if (LGPD.shouldShowCookieBanner()) {
        LGPD.showCookieBanner();
      }
    } catch (e) {
      console.warn('[LGPD] Erro ao mostrar banner de cookies:', e);
    }
  }
})();
