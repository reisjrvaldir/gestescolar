import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { CURRENT_TERMS_VERSION } from '@/lib/consentVersions';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-ink">{n}. {title}</h2>
      <div className="space-y-2 text-sm text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

export function TermosPage() {
  const versionLabel = new Date(CURRENT_TERMS_VERSION + 'T12:00:00').toLocaleDateString('pt-BR', {
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
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-ink">Termos de Uso</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Versão {CURRENT_TERMS_VERSION} — em vigor desde {versionLabel}
              </p>
              <p className="mt-2 text-xs text-ink-subtle">
                Leia com atenção. O uso do GestEscolar implica aceitação integral destes Termos.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <Section n="1" title="Aceitação">
              <p>
                Ao criar uma conta no <strong>GestEscolar</strong> (disponível em gestescolar.com.br), o
                usuário ("Contratante") declara que leu, compreendeu e concorda com estes Termos de Uso e
                com a{' '}
                <Link to="/privacidade" className="font-medium text-primary hover:underline" target="_blank">
                  Política de Privacidade
                </Link>.
                Caso não concorde com alguma cláusula, não utilize o serviço.
              </p>
            </Section>

            <Section n="2" title="Objeto do Serviço">
              <p>
                O GestEscolar é um sistema de gestão escolar desenvolvido e operado por <strong>Pulsaris Digital</strong>{' '}
                ("GestEscolar"), que oferece funcionalidades de gestão acadêmica, financeira e comunicação entre escola,
                professores e responsáveis. O serviço é prestado na modalidade <em>software como serviço</em> (SaaS)
                e pode ser aprimorado ou adaptado ao longo do tempo.
              </p>
            </Section>

            <Section n="3" title="Cadastro e Responsabilidades">
              <p>3.1. O Contratante é responsável pela veracidade e atualização dos dados informados no cadastro.</p>
              <p>3.2. O acesso é pessoal e intransferível. As credenciais (e-mail e senha) devem ser mantidas em sigilo.</p>
              <p>
                3.3. Qualquer acesso indevido decorrente de negligência na guarda das credenciais é de exclusiva
                responsabilidade do Contratante.
              </p>
              <p>
                3.4. O Contratante é responsável por obter, quando exigido por lei, as autorizações necessárias para
                o tratamento de dados de alunos, responsáveis e funcionários dentro da plataforma.
              </p>
            </Section>

            <Section n="4" title="Usos Permitidos e Vedados">
              <p>4.1. O serviço deve ser utilizado exclusivamente para fins lícitos de gestão escolar.</p>
              <p>É vedado ao Contratante:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Tentar acessar dados de outras escolas ou usuários;</li>
                <li>Introduzir vírus, código malicioso ou realizar ataques à infraestrutura;</li>
                <li>Fazer engenharia reversa do software;</li>
                <li>Usar a plataforma para fins ilegais ou em violação a direitos de terceiros.</li>
              </ul>
            </Section>

            <Section n="5" title="Dados Pessoais">
              <p>
                O tratamento de dados pessoais é regido pela nossa{' '}
                <Link to="/privacidade" className="font-medium text-primary hover:underline" target="_blank">
                  Política de Privacidade
                </Link>{' '}
                e pela Lei nº 13.709/2018 (LGPD).
              </p>
              <p>
                A GestEscolar atua como <strong>operadora</strong> dos dados pessoais de alunos, responsáveis e
                funcionários inseridos na plataforma, sendo o Contratante (escola) o <strong>controlador</strong>{' '}
                desses dados.
              </p>
            </Section>

            <Section n="6" title="Disponibilidade do Serviço">
              <p>
                Envidamos melhores esforços para manter o serviço disponível de forma contínua, mas não garantimos
                disponibilidade ininterrupta. Janelas de manutenção serão comunicadas com antecedência sempre que
                tecnicamente possível. Incidentes fora do nosso controle (falhas de infraestrutura de terceiros,
                eventos de força maior) não geram direito a compensação.
              </p>
            </Section>

            <Section n="7" title="Propriedade Intelectual">
              <p>
                Todo o código-fonte, interface, marcas, logotipos e demais ativos da plataforma são de propriedade
                exclusiva da GestEscolar. Nenhuma disposição destes Termos transfere ao Contratante qualquer direito
                de propriedade intelectual sobre a plataforma.
              </p>
            </Section>

            <Section n="8" title="Limitação de Responsabilidade">
              <p>A GestEscolar não se responsabiliza por:</p>
              <ul className="ml-4 list-disc space-y-1">
                <li>Danos indiretos, morais ou lucros cessantes decorrentes do uso ou indisponibilidade do serviço;</li>
                <li>Uso indevido do serviço pelo Contratante ou por terceiros que tenham acesso com as credenciais do Contratante;</li>
                <li>Falhas ou interrupções em serviços de infraestrutura de terceiros (banco de dados em nuvem, provedores de pagamento, operadoras de e-mail).</li>
              </ul>
              <p>
                A responsabilidade total da GestEscolar perante o Contratante, em qualquer hipótese, é limitada ao valor
                efetivamente pago nos últimos 3 (três) meses de uso do serviço.
              </p>
            </Section>

            <Section n="9" title="Prazo e Cancelamento">
              <p>
                O contrato vigora enquanto o Contratante mantiver uma assinatura ativa ou período de teste. O cancelamento
                pode ser solicitado a qualquer momento por meio das Configurações da conta. Após o cancelamento, os dados
                serão retidos conforme descrito na Política de Privacidade.
              </p>
            </Section>

            <Section n="10" title="Alterações destes Termos">
              <p>
                Podemos atualizar estes Termos periodicamente. Alterações materiais serão comunicadas com antecedência
                de pelo menos <strong>15 (quinze) dias</strong> por e-mail e por aviso na plataforma. O uso continuado
                do serviço após esse prazo implica aceite da nova versão. Caso o Contratante não concorde com as
                alterações, poderá cancelar a assinatura antes da data de vigência.
              </p>
            </Section>

            <Section n="11" title="Legislação e Foro">
              <p>
                Estes Termos são regidos pela legislação brasileira. Para resolução de eventuais litígios, fica eleito
                o foro da comarca de Recife, Estado de Pernambuco, com renúncia expressa a qualquer outro, por mais
                privilegiado que seja.
              </p>
            </Section>
          </div>

          <div className="mt-8 border-t border-border pt-6 text-xs text-ink-subtle">
            <p>Dúvidas? Entre em contato: <strong>contato@gestescolar.com.br</strong></p>
            <p className="mt-1">Versão {CURRENT_TERMS_VERSION} — Última atualização: {versionLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
