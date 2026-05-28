// =============================================
//  GESTESCOLAR – PORTAL DO TITULAR (LGPD)
//  Página onde o usuário exerce seus direitos
//  Art. 18 da Lei 13.709/2018
// =============================================

Router.register('lgpd-portal', () => {
  const user = Auth.current();
  if (!user) { Router.go('login'); return; }

  const content = `
    <div class="card" style="max-width:780px;margin:0 auto;">
      <div class="card-header">
        <span class="card-title">
          <i class="fa-solid fa-shield-halved" style="color:#1a73e8;"></i> Meus Dados (LGPD)
        </span>
      </div>
      <div class="card-body">

        <div style="background:#e3f2fd;border-left:4px solid #1a73e8;padding:14px 16px;border-radius:6px;margin-bottom:24px;">
          <strong>Seus direitos como titular de dados</strong> (Art. 18 da Lei 13.709/2018):
          aqui você pode acessar, exportar e solicitar a exclusão dos seus dados pessoais.
          Para dúvidas, contate nosso DPO: <a href="mailto:dpo@gestescolar.com" style="color:#1a73e8;font-weight:600;">dpo@gestescolar.com</a>.
        </div>

        <!-- Cards de ações -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;">

          <!-- 1. Exportar dados -->
          <div style="border:1px solid #e0e0e0;border-radius:10px;padding:18px;background:#fff;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:8px;background:#e3f2fd;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-download" style="color:#1a73e8;font-size:18px;"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;">Baixar meus dados</div>
                <div style="font-size:11px;color:#888;">Portabilidade (Art. 18, V)</div>
              </div>
            </div>
            <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 12px;">
              Receba uma cópia em JSON com todos os seus dados, escola, faturas e logs.
            </p>
            <button class="btn btn-primary w-100" onclick="LGPD.downloadMyData()">
              <i class="fa-solid fa-cloud-arrow-down"></i> Baixar JSON
            </button>
          </div>

          <!-- 2. Política de Privacidade -->
          <div style="border:1px solid #e0e0e0;border-radius:10px;padding:18px;background:#fff;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:8px;background:#f3e5f5;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-file-shield" style="color:#7b1fa2;font-size:18px;"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;">Política de Privacidade</div>
                <div style="font-size:11px;color:#888;">Como tratamos seus dados</div>
              </div>
            </div>
            <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 12px;">
              Documento completo com bases legais, retenção e direitos.
            </p>
            <button class="btn btn-outline w-100" onclick="window.open('/privacy','_blank')">
              <i class="fa-solid fa-up-right-from-square"></i> Ver Política
            </button>
          </div>

          <!-- 3. Termos de Uso -->
          <div style="border:1px solid #e0e0e0;border-radius:10px;padding:18px;background:#fff;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:8px;background:#fff3e0;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-file-contract" style="color:#e65100;font-size:18px;"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;">Termos de Uso</div>
                <div style="font-size:11px;color:#888;">Condições contratuais</div>
              </div>
            </div>
            <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 12px;">
              Regras de uso, planos, cobrança e cancelamento.
            </p>
            <button class="btn btn-outline w-100" onclick="window.open('/terms','_blank')">
              <i class="fa-solid fa-up-right-from-square"></i> Ver Termos
            </button>
          </div>

          <!-- 4. Excluir conta -->
          <div style="border:1px solid #ffcdd2;border-radius:10px;padding:18px;background:#fff;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;border-radius:8px;background:#ffebee;display:flex;align-items:center;justify-content:center;">
                <i class="fa-solid fa-user-xmark" style="color:#c62828;font-size:18px;"></i>
              </div>
              <div>
                <div style="font-weight:700;font-size:15px;">Excluir minha conta</div>
                <div style="font-size:11px;color:#888;">Direito ao esquecimento (Art. 18, VI)</div>
              </div>
            </div>
            <p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 12px;">
              Solicite a remoção dos seus dados pessoais. Processado em até 15 dias úteis.
            </p>
            <button class="btn btn-outline w-100" style="color:#c62828;border-color:#c62828;"
              onclick="LGPD.requestAccountDeletion()">
              <i class="fa-solid fa-trash"></i> Solicitar Exclusão
            </button>
          </div>
        </div>

        <!-- Informações adicionais -->
        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e0e0e0;">
          <h3 style="font-size:15px;margin:0 0 12px;color:#333;">
            <i class="fa-solid fa-circle-info" style="color:#1a73e8;"></i> Outras informações
          </h3>
          <div style="font-size:13px;color:#555;line-height:1.7;">
            <p style="margin:0 0 8px;">
              <strong>Retenção:</strong> Dados de conta ativa são mantidos enquanto você for cliente.
              Faturas e dados fiscais são preservados por 5 anos (obrigação legal).
            </p>
            <p style="margin:0 0 8px;">
              <strong>Correção de dados:</strong> Você pode editar suas informações pessoais
              diretamente no menu Configurações.
            </p>
            <p style="margin:0 0 8px;">
              <strong>Reclamações:</strong> Em caso de descontentamento, você pode reportar à
              <a href="https://www.gov.br/anpd" target="_blank" style="color:#1a73e8;">ANPD (Autoridade Nacional de Proteção de Dados)</a>.
            </p>
            <p style="margin:0;">
              <strong>Encarregado de Dados (DPO):</strong>
              <a href="mailto:dpo@gestescolar.com" style="color:#1a73e8;">dpo@gestescolar.com</a>
              — resposta em até 15 dias úteis.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  Router.renderLayout(user, 'lgpd-portal', content);
});
