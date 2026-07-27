import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { CURRENT_PRIVACY_VERSION } from '@/lib/consentVersions';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-ink">{n}. {title}</h2>
      <div className="space-y-2 text-sm text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

export function PrivacidadePage() {
  const versionLabel = new Date(CURRENT_PRIVACY_VERSION + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/login" className="mb-6 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-primary">
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        <div className="card p-8">
          <div className="mb-8 flex items-start gap-4 border-b border-border pb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-ink">Política de Privacidade</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Versão {CURRENT_PRIVACY_VERSION} — em vigor desde {versionLabel}
              </p>
              <p className="mt-2 text-xs text-ink-subtle">
                Elaborada em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <Section n="1" title="Controlador e Encarregado de Dados (DPO)">
              <p>
                <strong>Controlador:</strong> Pulsaris Digital ("GestEscolar"), operadora da plataforma disponível
                em gestescolar.com.br.
              </p>
              <p>
                <strong>Encarregado (DPO):</strong> responsável pelo tratamento de dados pessoais e pelo
                atendimento de solicitações dos titulares. Contato:{' '}
                <strong>lgpd@gestescolar.com.br</strong>.
              </p>
              <p>
                A escola contratante é o <strong>controlador</strong> dos dados pessoais de seus alunos,
                responsáveis e funcionários inseridos na plataforma. A GestEscolar atua como{' '}
                <strong>operadora</strong> desses dados, processando-os exclusivamente de acordo com as
                instruções do controlador e nos limites desta Política.
              </p>
            </Section>

            <Section n="2" title="Dados Coletados e Finalidades">
              <p>Coletamos as seguintes categorias de dados, para as finalidades indicadas:</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas text-xs font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-2 text-left">Categoria</th>
                      <th className="px-4 py-2 text-left">Finalidade</th>
                      <th className="px-4 py-2 text-left">Base Legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Dados de cadastro (nome, e-mail, telefone, CNPJ)', 'Identificação e gestão da conta', 'Contrato (art. 7°, V)'],
                      ['Dados de alunos e responsáveis (fornecidos pela escola)', 'Gestão acadêmica e financeira', 'Contrato / Legítimo interesse'],
                      ['Logs de acesso (IP, data/hora, agente de navegação)', 'Segurança e prevenção a fraudes', 'Legítimo interesse (art. 7°, IX)'],
                      ['Dados financeiros (faturas, pagamentos)', 'Prestação do serviço de cobranças', 'Contrato / Obrigação legal'],
                      ['Registro de aceite de termos (hash de IP e User-Agent)', 'Evidência de consentimento (LGPD)', 'Cumprimento de obrigação legal'],
                    ].map(([cat, fin, base]) => (
                      <tr key={cat} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 text-ink">{cat}</td>
                        <td className="px-4 py-2">{fin}</td>
                        <td className="px-4 py-2">{base}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section n="3" title="Bases Legais (LGPD)">
              <p>O tratamento se fundamenta nas seguintes hipóteses do art. 7° da LGPD:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li><strong>Execução de contrato</strong> (inciso V): dados necessários para operar e entregar o serviço contratado.</li>
                <li><strong>Cumprimento de obrigação legal</strong> (inciso II): dados exigidos por legislação fiscal, tributária ou educacional.</li>
                <li><strong>Legítimo interesse</strong> (inciso IX): dados de logs para segurança da plataforma e prevenção a acessos não autorizados, respeitados os direitos e expectativas dos titulares.</li>
              </ul>
            </Section>

            <Section n="4" title="Compartilhamento de Dados">
              <p>Compartilhamos dados exclusivamente com os seguintes fornecedores, sob contratos de processamento de dados (DPA):</p>
              <ul className="ml-4 list-disc space-y-1">
                <li><strong>Neon Inc.</strong> — banco de dados PostgreSQL em nuvem (EUA); dados trafegam com criptografia TLS.</li>
                <li><strong>Resend Inc.</strong> — envio de e-mails transacionais (confirmações, notificações).</li>
                <li><strong>ASAAS Pagamentos S.A.</strong> — processamento de cobranças PIX e cartão de crédito (CNPJ 19.540.550/0001-21).</li>
                <li><strong>Vercel Inc.</strong> — hospedagem da aplicação web (EUA); sem acesso ao banco de dados.</li>
              </ul>
              <p>
                <strong>Não vendemos, alugamos nem cedemos dados pessoais a terceiros</strong> para fins comerciais ou
                publicitários.
              </p>
            </Section>

            <Section n="5" title="Transferência Internacional">
              <p>
                Alguns fornecedores listados na seção anterior estão sediados nos Estados Unidos. As transferências
                internacionais são realizadas com base em cláusulas contratuais que garantem nível de proteção
                adequado, em conformidade com o art. 33 da LGPD.
              </p>
            </Section>

            <Section n="6" title="Retenção de Dados">
              <p>
                Os dados são retidos pelo prazo contratual. Após cancelamento da assinatura, os dados são mantidos
                por até <strong>12 (doze) meses</strong> para fins de auditoria e cumprimento de obrigações legais,
                salvo prazo maior exigido por lei (ex.: obrigações fiscais de 5 anos). Após o prazo de retenção, os
                dados são anonimizados ou eliminados de forma segura.
              </p>
            </Section>

            <Section n="7" title="Segurança da Informação">
              <p>Adotamos medidas técnicas e organizacionais que incluem:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Criptografia em trânsito (TLS 1.2 ou superior);</li>
                <li>Criptografia em repouso no banco de dados;</li>
                <li>Isolamento de dados por escola via Row-Level Security (RLS) no banco de dados;</li>
                <li>Controle de acesso baseado em papéis (administrador, professor, responsável);</li>
                <li>Registro de trilha de auditoria para operações sensíveis;</li>
                <li>Senhas armazenadas com hashing seguro (nunca em texto claro).</li>
              </ul>
              <p>
                Nenhum sistema de informação é imune a todos os riscos. Em caso de incidente de segurança com
                potencial impacto relevante aos titulares, comunicaremos a <strong>ANPD</strong> e os titulares
                afetados nos prazos e formas estabelecidos pela LGPD.
              </p>
            </Section>

            <Section n="8" title="Direitos do Titular">
              <p>
                Nos termos do art. 18 da LGPD, você tem direito a:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Confirmar a existência e acessar seus dados pessoais;</li>
                <li>Solicitar correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
                <li>Obter informações sobre os terceiros com quem seus dados foram compartilhados;</li>
                <li>Solicitar a portabilidade dos dados;</li>
                <li>Revogar o consentimento, quando o tratamento se basear nessa hipótese.</li>
              </ul>
              <p>
                Você pode exercer esses direitos pela seção{' '}
                <strong>"Meus Dados (LGPD)"</strong> na plataforma ou pelo e-mail{' '}
                <strong>lgpd@gestescolar.com.br</strong>. Respondemos em até <strong>15 dias úteis</strong>.
              </p>
            </Section>

            <Section n="9" title="Cookies e Armazenamento Local">
              <p>
                Utilizamos cookies essenciais para manter a sessão autenticada. Não utilizamos cookies de
                rastreamento publicitário ou perfis comportamentais de terceiros. Os dados de sessão são armazenados
                de forma segura e expiram automaticamente.
              </p>
            </Section>

            <Section n="10" title="Alterações desta Política">
              <p>
                Esta Política pode ser atualizada para refletir mudanças no serviço ou na legislação. Alterações
                materiais serão comunicadas com antecedência de pelo menos <strong>15 (quinze) dias</strong> por
                e-mail e por aviso na plataforma. Ao continuar usando o serviço após o prazo, você confirma ciência
                da nova versão.
              </p>
            </Section>
          </div>

          <div className="mt-8 border-t border-border pt-6 text-xs text-ink-subtle">
            <p>Encarregado de Dados (DPO): <strong>lgpd@gestescolar.com.br</strong></p>
            <p>Versão {CURRENT_PRIVACY_VERSION} — Última atualização: {versionLabel}</p>
            <p className="mt-2">
              Também disponível em:{' '}
              <Link to="/termos" className="font-medium text-primary hover:underline" target="_blank">
                Termos de Uso
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
