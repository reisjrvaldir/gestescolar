// =============================================
//  GESTESCOLAR – POLÍTICA DE PRIVACIDADE (LGPD)
// =============================================

Router.register('privacy', () => {
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

    <!-- Conteúdo -->
    <div style="max-width:800px;margin:40px auto;padding:0 20px;">
      <div style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.05);">

        <h1 style="color:#1a73e8;margin:0 0 8px;font-size:32px;">Política de Privacidade</h1>
        <p style="color:#666;margin:0 0 32px;font-size:14px;">
          <i class="fa-solid fa-calendar"></i> Última atualização: ${new Date().toLocaleDateString('pt-BR')}
          &nbsp;|&nbsp;
          <i class="fa-solid fa-shield-halved"></i> Em conformidade com a LGPD (Lei 13.709/2018)
        </p>

        <div style="background:#e3f2fd;border-left:4px solid #1a73e8;padding:16px;border-radius:6px;margin-bottom:32px;">
          <strong>Resumo:</strong> O GestEscolar coleta e processa dados pessoais necessários para
          gestão escolar (alunos, professores, responsáveis e gestores). Tratamos dados com
          segurança, respeitando os direitos previstos na Lei Geral de Proteção de Dados (LGPD).
        </div>

        <h2 style="color:#1a73e8;margin-top:32px;">1. Quem somos</h2>
        <p>
          <strong>GestEscolar SaaS</strong> ("nós", "nosso", "Plataforma") é uma plataforma
          online de gestão escolar destinada a instituições de ensino, professores, responsáveis
          e alunos.
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">2. Dados que coletamos</h2>

        <h3 style="color:#333;margin-top:20px;">2.1 Dados de identificação (gestores)</h3>
        <ul>
          <li>Nome completo, e-mail, telefone</li>
          <li>CPF/CNPJ (para emissão de cobranças via Asaas)</li>
          <li>Endereço da instituição</li>
        </ul>

        <h3 style="color:#333;margin-top:20px;">2.2 Dados de alunos (incluindo menores)</h3>
        <p style="background:#fff3e0;border-left:4px solid #ff9800;padding:12px;border-radius:6px;">
          <strong>Atenção - Art. 14 LGPD:</strong> Dados de crianças e adolescentes são tratados
          com cuidado especial. O cadastro de aluno menor de idade requer consentimento
          específico de pelo menos um dos pais ou responsável legal.
        </p>
        <ul>
          <li>Nome, data de nascimento</li>
          <li>Endereço residencial</li>
          <li>Dados acadêmicos: turma, notas, frequência, comportamento</li>
          <li>Dados dos responsáveis (vínculo familiar)</li>
        </ul>

        <h3 style="color:#333;margin-top:20px;">2.3 Dados de pagamento</h3>
        <ul>
          <li>Dados de cartão de crédito são processados <strong>diretamente pela Asaas</strong>
            (parceira certificada PCI-DSS). Não armazenamos números de cartão.</li>
          <li>Histórico de faturas e pagamentos (preservados por 5 anos para fins fiscais).</li>
        </ul>

        <h3 style="color:#333;margin-top:20px;">2.4 Dados técnicos automaticamente coletados</h3>
        <ul>
          <li>Endereço IP, navegador, sistema operacional</li>
          <li>Logs de acesso (data, hora, ação realizada)</li>
          <li>Cookies essenciais para funcionamento (sessão de login)</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">3. Como usamos seus dados</h2>
        <p>Utilizamos os dados coletados <strong>exclusivamente</strong> para:</p>
        <ul>
          <li><strong>Execução do contrato:</strong> prestação dos serviços de gestão escolar</li>
          <li><strong>Cumprimento legal:</strong> obrigações fiscais e regulatórias</li>
          <li><strong>Comunicação:</strong> notificações de pagamento, recuperação de senha</li>
          <li><strong>Segurança:</strong> prevenção de fraudes e proteção da Plataforma</li>
        </ul>
        <p style="background:#e8f5e9;border-left:4px solid #43a047;padding:12px;border-radius:6px;">
          <strong>Nunca vendemos seus dados.</strong> Não compartilhamos informações com
          terceiros para fins de marketing ou publicidade.
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">4. Com quem compartilhamos</h2>
        <ul>
          <li><strong>Supabase:</strong> infraestrutura de banco de dados (hospedagem segura)</li>
          <li><strong>Asaas:</strong> processador de pagamentos PIX/cartão</li>
          <li><strong>Resend:</strong> envio de e-mails transacionais</li>
          <li><strong>Vercel:</strong> hospedagem da aplicação web</li>
          <li><strong>Autoridades:</strong> apenas mediante ordem judicial ou obrigação legal</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">5. Seus direitos (Art. 18 LGPD)</h2>
        <p>Como titular de dados, você tem direito a:</p>
        <ul>
          <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e obter cópia</li>
          <li><strong>Correção:</strong> atualizar dados incompletos, inexatos ou desatualizados</li>
          <li><strong>Anonimização ou eliminação:</strong> de dados desnecessários</li>
          <li><strong>Portabilidade:</strong> exportação dos dados em formato estruturado (JSON)</li>
          <li><strong>Revogação do consentimento:</strong> a qualquer momento</li>
          <li><strong>Informação:</strong> sobre compartilhamento de dados com terceiros</li>
        </ul>
        <p style="background:#e3f2fd;border-left:4px solid #1a73e8;padding:12px;border-radius:6px;">
          <strong>Como exercer:</strong> Acesse seu perfil → "Meus Dados (LGPD)" para baixar,
          editar ou excluir suas informações. Ou envie e-mail ao DPO (abaixo).
        </p>

        <h2 style="color:#1a73e8;margin-top:32px;">6. Segurança</h2>
        <ul>
          <li>Conexões protegidas por HTTPS (TLS 1.2+)</li>
          <li>Senhas armazenadas com hash bcrypt (Supabase Auth)</li>
          <li>Isolamento entre escolas (Row-Level Security)</li>
          <li>Backups automáticos diários (Supabase)</li>
          <li>Auditoria de acessos a dados sensíveis</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">7. Retenção de dados</h2>
        <ul>
          <li><strong>Conta ativa:</strong> dados mantidos enquanto a escola é cliente</li>
          <li><strong>Após cancelamento:</strong> dados acadêmicos anonimizados em 30 dias</li>
          <li><strong>Dados fiscais (faturas):</strong> retidos por 5 anos (obrigação legal)</li>
          <li><strong>Logs de auditoria:</strong> 12 meses</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">8. Encarregado de Dados (DPO)</h2>
        <p>
          Em conformidade com o Art. 41 da LGPD, nosso Encarregado de Proteção de Dados é:
        </p>
        <div style="background:#f5f7fa;padding:16px;border-radius:8px;margin-top:12px;">
          <strong>E-mail:</strong> <a href="mailto:dpo@gestescolar.com" style="color:#1a73e8;">dpo@gestescolar.com</a><br>
          <strong>Prazo de resposta:</strong> até 15 dias úteis<br>
          <strong>Autoridade reguladora (ANPD):</strong>
          <a href="https://www.gov.br/anpd" target="_blank" style="color:#1a73e8;">www.gov.br/anpd</a>
        </div>

        <h2 style="color:#1a73e8;margin-top:32px;">9. Incidentes de segurança</h2>
        <p>
          Em caso de violação de dados (Art. 48 LGPD), notificaremos a ANPD e os titulares
          afetados em até <strong>72 horas</strong>, descrevendo:
        </p>
        <ul>
          <li>A natureza dos dados afetados</li>
          <li>Os titulares envolvidos</li>
          <li>As medidas técnicas adotadas</li>
          <li>Os riscos relacionados ao incidente</li>
        </ul>

        <h2 style="color:#1a73e8;margin-top:32px;">10. Alterações nesta Política</h2>
        <p>
          Esta política pode ser atualizada periodicamente. Alterações relevantes serão
          comunicadas por e-mail. A versão vigente é sempre a publicada nesta página, com
          a data de atualização no topo.
        </p>

        <hr style="margin:40px 0;border:none;border-top:1px solid #e0e0e0;">

        <div style="text-align:center;color:#888;font-size:13px;">
          <i class="fa-solid fa-shield-halved"></i>
          Esta política está em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018)
          e demais normativos aplicáveis.
        </div>

        <div style="margin-top:32px;text-align:center;">
          <button class="btn btn-primary" onclick="Router.go('landing')" style="margin-right:8px;">
            <i class="fa-solid fa-arrow-left"></i> Voltar ao início
          </button>
          <button class="btn btn-outline" onclick="Router.go('terms')">
            <i class="fa-solid fa-file-contract"></i> Termos de Uso
          </button>
        </div>
      </div>
    </div>
  </div>
  `;
});
