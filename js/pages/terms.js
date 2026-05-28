// =============================================
//  GESTESCOLAR – TERMOS DE USO
// =============================================

Router.register('terms', () => {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="legal-page" style="background:#f5f7fa;min-height:100vh;">

    <!-- Header simples -->
    <nav style="background:#fff;border-bottom:1px solid #e0e0e0;padding:12px 20px;position:sticky;top:0;z-index:100;">
      <div style="max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;">
        <a href="#" onclick="event.preventDefault();Router.go('landing')" style="display:flex;align-items:center;gap:8px;color:#1a73e8;text-decoration:none;font-weight:700;font-size:18px;">
          <i class="fa-solid fa-graduation-cap"></i> GestEscolar
        </a>
        <button class="btn btn-outline" onclick="Router.go('landing')" style="font-size:14px;">
          <i class="fa-solid fa-arrow-left"></i> Voltar
        </button>
      </div>
    </nav>

    <div style="max-width:800px;margin:40px auto;padding:0 20px;">
      <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.05);">

        <h1 style="color:#1a73e8;margin:0 0 8px;font-size:32px;">Termos de Uso</h1>
        <p style="color:#666;margin:0 0 32px;font-size:14px;">
          <i class="fa-solid fa-calendar"></i> Última atualização: ${new Date().toLocaleDateString('pt-BR')}
        </p>

        <div style="background:#e3f2fd;border-left:4px solid #1a73e8;padding:16px;border-radius:6px;margin-bottom:32px;">
          Ao utilizar a Plataforma GestEscolar, você concorda com estes Termos de Uso e com
          nossa <a href="#" onclick="event.preventDefault();Router.go('privacy')" style="color:#1a73e8;font-weight:600;">Política de Privacidade</a>.
          Leia atentamente.
        </div>

        <h2 style="color:#1a73e8;margin-top:32px;">1. Aceitação dos Termos</h2>
        <p>
          O uso da Plataforma GestEscolar ("Serviço") implica na aceitação integral destes
          Termos. Se você não concordar, não utilize o Serviço.
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">2. Descrição do Serviço</h2>
        <p>
          GestEscolar é uma plataforma SaaS (Software as a Service) de gestão escolar que oferece:
        </p>
        <ul>
          <li>Cadastro e gerenciamento de alunos, professores e turmas</li>
          <li>Sistema financeiro com cobranças via PIX e cartão</li>
          <li>Controle de frequência e notas</li>
          <li>Comunicação interna (chat, notificações)</li>
          <li>Documentos e declarações</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">3. Cadastro e Conta</h2>
        <ul>
          <li>É necessário fornecer informações verdadeiras e atualizadas</li>
          <li>Você é responsável pela confidencialidade de sua senha</li>
          <li>Notifique imediatamente em caso de uso não autorizado</li>
          <li>Menores de 18 anos devem ter consentimento dos responsáveis legais</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">4. Planos e Pagamentos</h2>
        <ul>
          <li><strong>Período de teste:</strong> 7 dias gratuitos com todos os recursos</li>
          <li><strong>Cobrança:</strong> mensal ou anual, conforme plano escolhido</li>
          <li><strong>Pagamento:</strong> via PIX ou cartão de crédito (processado pela Asaas)</li>
          <li><strong>Inadimplência:</strong> acesso bloqueado após vencimento (dados preservados)</li>
          <li><strong>Reembolso:</strong> primeiros 7 dias da assinatura, mediante solicitação</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">5. Uso Aceitável</h2>
        <p>É proibido:</p>
        <ul>
          <li>Usar a Plataforma para fins ilegais ou não autorizados</li>
          <li>Tentar acessar contas de outros usuários</li>
          <li>Realizar engenharia reversa, descompilar ou copiar o sistema</li>
          <li>Sobrecarregar intencionalmente a infraestrutura</li>
          <li>Inserir vírus ou códigos maliciosos</li>
          <li>Compartilhar credenciais com terceiros</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">6. Propriedade Intelectual</h2>
        <p>
          O Serviço e seu conteúdo (código, design, marca) são propriedade do GestEscolar.
          Os dados inseridos pela escola permanecem de propriedade da escola, sendo a
          Plataforma apenas operadora destes dados (Art. 5º, VII da LGPD).
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">7. Disponibilidade</h2>
        <p>
          Comprometemo-nos com disponibilidade de <strong>99,5% ao mês</strong>. Manutenções
          programadas serão comunicadas com antecedência mínima de 24 horas.
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">8. Limitação de Responsabilidade</h2>
        <p>
          A Plataforma não se responsabiliza por:
        </p>
        <ul>
          <li>Erros de digitação ou inconsistências causadas por usuários</li>
          <li>Perda de dados decorrente de uso indevido</li>
          <li>Indisponibilidade de serviços de terceiros (Asaas, Supabase, etc.)</li>
          <li>Danos indiretos, lucros cessantes ou perdas comerciais</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">9. Cancelamento e Encerramento</h2>
        <ul>
          <li><strong>Pelo usuário:</strong> a qualquer momento, sem multa</li>
          <li><strong>Pela Plataforma:</strong> em caso de violação destes Termos, com aviso prévio de 7 dias</li>
          <li><strong>Após encerramento:</strong> dados podem ser exportados em até 30 dias</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">10. Foro e Legislação Aplicável</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito
          o foro da comarca do estabelecimento sede do GestEscolar para dirimir quaisquer
          controvérsias.
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">11. Contato</h2>
        <p>
          Dúvidas sobre estes Termos? Entre em contato:
        </p>
        <div style="background:#f5f7fa;padding:16px;border-radius:8px;margin-top:12px;">
          <strong>Suporte:</strong> <a href="mailto:suporte@gestescolar.com" style="color:#1a73e8;">suporte@gestescolar.com</a><br>
          <strong>LGPD/Privacidade:</strong> <a href="mailto:dpo@gestescolar.com" style="color:#1a73e8;">dpo@gestescolar.com</a>
        </div>

        <hr style="margin:40px 0;border:none;border-top:1px solid #e0e0e0;">

        <div style="margin-top:32px;text-align:center;">
          <button class="btn btn-primary" onclick="Router.go('landing')" style="margin-right:8px;">
            <i class="fa-solid fa-arrow-left"></i> Voltar ao início
          </button>
          <button class="btn btn-outline" onclick="Router.go('privacy')">
            <i class="fa-solid fa-shield-halved"></i> Política de Privacidade
          </button>
        </div>
      </div>
    </div>
  </div>
  `;
});
