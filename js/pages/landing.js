// =============================================
//  GESTESCOLAR – LANDING PAGE v2 (3D + Modern)
// =============================================

Router.register('landing', () => {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="landing">

    <!-- Orbs de luz de fundo -->
    <div class="lp-orb lp-orb-1"></div>
    <div class="lp-orb lp-orb-2"></div>
    <div class="lp-orb lp-orb-3"></div>

    <!-- ═══ NAVBAR ═══ -->
    <nav class="lp-nav" id="lpNav">
      <div class="lp-nav-inner">
        <a class="lp-logo" href="#" onclick="event.preventDefault();window.scrollTo({top:0,behavior:'smooth'})">
          <i class="fa-solid fa-graduation-cap"></i> GestEscolar
        </a>
        <div class="lp-nav-links" id="lpNavLinks">
          <a onclick="LandingPage.scrollTo('features')">Funcionalidades</a>
          <a onclick="LandingPage.scrollTo('how')">Como funciona</a>
          <a onclick="LandingPage.scrollTo('plans')">Planos</a>
          <a onclick="LandingPage.scrollTo('coming')">Em breve</a>
          <a onclick="LandingPage.scrollTo('faq')">FAQ</a>
        </div>
        <div class="lp-nav-btns">
          <button class="lp-btn lp-btn-outline lp-btn-nav" onclick="LandingPage.goLogin()">
            <i class="fa-solid fa-right-to-bracket"></i> Entrar
          </button>
          <button class="lp-btn lp-btn-accent lp-btn-nav" onclick="LandingPage.goRegister()">
            <i class="fa-solid fa-rocket"></i> Teste Grátis
          </button>
        </div>
        <button class="lp-hamburger" onclick="LandingPage.toggleMenu()">
          <i class="fa-solid fa-bars"></i>
        </button>
      </div>
    </nav>

    <!-- ═══ HERO 3D ═══ -->
    <section class="lp-hero">
      <div class="lp-hero-inner">

        <!-- Texto -->
        <div class="lp-hero-text">
          <div class="lp-hero-eyebrow">
            <span></span> Plataforma SaaS de Gestão Escolar
          </div>
          <h1>
            Gerencie sua escola com
            <span class="lp-grad">inteligência</span> e
            <span class="lp-grad2">eficiência</span>
          </h1>
          <p>Matrículas, financeiro, notas, frequência e comunicação em um único lugar. 100% online, seguro e fácil de usar.</p>
          <div class="lp-hero-btns">
            <button class="lp-btn lp-btn-accent lp-btn-hero" onclick="LandingPage.goRegister()">
              <i class="fa-solid fa-rocket"></i> Teste Grátis — 7 dias
            </button>
            <button class="lp-btn lp-btn-hero lp-btn-hero-outline" onclick="LandingPage.scrollTo('features')">
              <i class="fa-solid fa-play-circle"></i> Ver funcionalidades
            </button>
          </div>
          <div class="lp-hero-trust">
            <div class="lp-hero-trust-item"><i class="fa-solid fa-check-circle"></i> Sem cartão para testar</div>
            <div class="lp-hero-trust-item"><i class="fa-solid fa-check-circle"></i> Configuração em 2 minutos</div>
            <div class="lp-hero-trust-item"><i class="fa-solid fa-check-circle"></i> Suporte incluso</div>
          </div>
        </div>

        <!-- Mockup 3D -->
        <div class="lp-hero-visual">
          <div class="lp-mockup-wrap" id="lpMockup">

            <!-- Badge flutuante 1 -->
            <div class="lp-float-badge lp-float-badge-1">
              <i class="fa-solid fa-chart-line" style="color:#00b894;"></i>
              <div>
                <div style="font-size:14px;font-weight:900;">+24%</div>
                <div style="font-size:10px;opacity:.6;">Adimplência este mês</div>
              </div>
            </div>

            <!-- Badge flutuante 2 -->
            <div class="lp-float-badge lp-float-badge-2">
              <i class="fa-solid fa-graduation-cap" style="color:#74b9ff;"></i>
              <div>
                <div style="font-size:14px;font-weight:900;">128 alunos</div>
                <div style="font-size:10px;opacity:.6;">matriculados</div>
              </div>
            </div>

            <!-- Badge flutuante 3 -->
            <div class="lp-float-badge lp-float-badge-3">
              <i class="fa-solid fa-pix" style="color:#00b894;"></i>
              <div>
                <div style="font-size:13px;font-weight:900;">PIX confirmado</div>
                <div style="font-size:10px;opacity:.6;">R$ 850,00</div>
              </div>
            </div>

            <!-- Card principal do dashboard -->
            <div class="lp-dash-card">
              <div class="lp-dash-header">
                <div class="lp-dash-dot"></div>
                <div class="lp-dash-dot"></div>
                <div class="lp-dash-dot"></div>
                <span class="lp-dash-title">GestEscolar — Dashboard</span>
              </div>

              <!-- KPIs -->
              <div class="lp-dash-kpis">
                <div class="lp-dash-kpi">
                  <div class="lp-dash-kpi-val">R$24.8k</div>
                  <div class="lp-dash-kpi-lbl">Receita/mês</div>
                  <div class="lp-dash-kpi-tag tag-green">↑ 18%</div>
                </div>
                <div class="lp-dash-kpi">
                  <div class="lp-dash-kpi-val">128</div>
                  <div class="lp-dash-kpi-lbl">Alunos ativos</div>
                  <div class="lp-dash-kpi-tag tag-blue">+5 este mês</div>
                </div>
                <div class="lp-dash-kpi">
                  <div class="lp-dash-kpi-val">94%</div>
                  <div class="lp-dash-kpi-lbl">Adimplência</div>
                  <div class="lp-dash-kpi-tag tag-orange">▲ 3pts</div>
                </div>
              </div>

              <!-- Gráfico de barras simulado -->
              <div class="lp-dash-chart">
                <div class="lp-dash-chart-title">Receitas — últimos 6 meses</div>
                <div class="lp-bars">
                  <div class="lp-bar" style="height:40%"></div>
                  <div class="lp-bar" style="height:55%"></div>
                  <div class="lp-bar accent" style="height:45%"></div>
                  <div class="lp-bar" style="height:70%"></div>
                  <div class="lp-bar purple" style="height:60%"></div>
                  <div class="lp-bar accent" style="height:85%"></div>
                </div>
              </div>

              <!-- Lista de alunos/pagamentos -->
              <div class="lp-dash-rows">
                <div class="lp-dash-row">
                  <div class="lp-dash-avatar" style="background:linear-gradient(135deg,#1a73e8,#6c5ce7);">AS</div>
                  <div class="lp-dash-row-name">Ana Silva</div>
                  <div class="lp-dash-row-status status-paid">Pago</div>
                </div>
                <div class="lp-dash-row">
                  <div class="lp-dash-avatar" style="background:linear-gradient(135deg,#00b894,#00838f);">MO</div>
                  <div class="lp-dash-row-name">Marcos Oliveira</div>
                  <div class="lp-dash-row-status status-pend">Pendente</div>
                </div>
                <div class="lp-dash-row">
                  <div class="lp-dash-avatar" style="background:linear-gradient(135deg,#e84393,#c2185b);">LC</div>
                  <div class="lp-dash-row-name">Luísa Costa</div>
                  <div class="lp-dash-row-status status-paid">Pago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ MÉTRICAS ═══ -->
    <section class="lp-metrics">
      <div class="lp-metrics-inner">
        <div class="lp-metric-wrap lp-fade-up">
          <div class="lp-metric-num" data-count="8">0</div>
          <div class="lp-metric-label">Módulos integrados</div>
        </div>
        <div class="lp-metric-wrap lp-fade-up">
          <div class="lp-metric-num" data-count="100" data-suffix="%">0%</div>
          <div class="lp-metric-label">Online e seguro</div>
        </div>
        <div class="lp-metric-wrap lp-fade-up">
          <div class="lp-metric-num" data-prefix="R$ " data-count="0">R$ 0</div>
          <div class="lp-metric-label">Para começar</div>
        </div>
        <div class="lp-metric-wrap lp-fade-up">
          <div class="lp-metric-num" data-text="24/7">24/7</div>
          <div class="lp-metric-label">Disponível sempre</div>
        </div>
      </div>
    </section>

    <!-- ═══ FUNCIONALIDADES ═══ -->
    <section class="lp-section-gray" id="lp-features">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">Funcionalidades</div>
          <div class="lp-section-title lp-fade-up">Tudo que sua escola precisa,<br><span class="lp-grad">em um só lugar</span></div>
          <div class="lp-section-sub lp-fade-up">Uma plataforma completa para gestão escolar, do administrativo ao acadêmico.</div>
        </div>
        <div class="lp-features">
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#1a73e8;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#1a73e8,#0d47a1);"><i class="fa-solid fa-school"></i></div>
            <h3>Gestão Escolar</h3>
            <p>Cadastro de turmas, alunos, professores e equipe administrativa em um painel intuitivo e organizado.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#00b894;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#00b894,#00838f);"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            <h3>Financeiro Completo</h3>
            <p>Dashboard com saldo em tempo real, mensalidades PIX, despesas, cobranças avulsas e saques sem valor mínimo.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#6c5ce7;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#6c5ce7,#4a3dbb);"><i class="fa-solid fa-chart-bar"></i></div>
            <h3>Acadêmico</h3>
            <p>Lançamento de notas por disciplina, controle de frequência diária, boletim e desempenho por turma.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#ff6f00;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#ff6f00,#e65100);"><i class="fa-solid fa-comments"></i></div>
            <h3>Chat Escola-Família</h3>
            <p>Comunicação direta entre responsáveis e professores com histórico vinculado ao aluno.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#e84393;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#e84393,#c2185b);"><i class="fa-solid fa-shield-halved"></i></div>
            <h3>Segurança Total</h3>
            <p>Isolamento de dados por escola (RLS), autenticação segura e zero risco de vazamento de informações.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#00cec9;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#00cec9,#00838f);"><i class="fa-solid fa-users-gear"></i></div>
            <h3>Multi-perfil</h3>
            <p>Painéis dedicados para gestor, professor, financeiro e responsável. Cada um vê apenas o que precisa.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#7c4dff;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#7c4dff,#6200ea);"><i class="fa-solid fa-mobile-screen-button"></i></div>
            <h3>Portal do Responsável</h3>
            <p>Notas, boletim, frequência e desempenho por disciplina em tempo real, acessível pelo celular.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#43a047;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#43a047,#2e7d32);"><i class="fa-solid fa-wallet"></i></div>
            <h3>Financeiro do Responsável</h3>
            <p>Mensalidades pendentes, histórico de pagamentos, 2ª via e pagamento online via PIX.</p>
          </div>
          <div class="lp-feature-card lp-fade-up lp-tilt" style="--card-color:#f57c00;">
            <div class="lp-feature-icon" style="background:linear-gradient(135deg,#f57c00,#e65100);"><i class="fa-solid fa-folder-open"></i></div>
            <h3>Documentos Digitais</h3>
            <p>Declarações, atestados, histórico escolar e matrícula digital — tudo acessível pelo portal.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ DEPOIMENTOS ═══ -->
    <section id="lp-testimonials">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">Depoimentos</div>
          <div class="lp-section-title lp-fade-up">O que dizem nossos <span class="lp-grad">clientes</span></div>
          <div class="lp-section-sub lp-fade-up">Gestores que transformaram a rotina da escola com o GestEscolar.</div>
        </div>
        <div class="lp-testimonials">
          <div class="lp-testi-card lp-fade-up">
            <div class="lp-testi-quote">"</div>
            <div class="lp-testi-stars">★★★★★</div>
            <div class="lp-testi-text">"O financeiro da escola mudou completamente. Antes eram planilhas no Excel, hoje vejo tudo em tempo real e ainda recebo automaticamente via PIX. Incrível."</div>
            <div class="lp-testi-author">
              <div class="lp-testi-avatar" style="background:linear-gradient(135deg,#1a73e8,#6c5ce7);">CP</div>
              <div>
                <div class="lp-testi-name">Carla Pereira</div>
                <div class="lp-testi-role">Diretora — Escola Pequenos Passos</div>
              </div>
            </div>
          </div>
          <div class="lp-testi-card lp-fade-up">
            <div class="lp-testi-quote">"</div>
            <div class="lp-testi-stars">★★★★★</div>
            <div class="lp-testi-text">"A comunicação com os pais melhorou 100%. O chat integrado e o portal do responsável são diferenciais que os pais adoram. Muito mais profissional."</div>
            <div class="lp-testi-author">
              <div class="lp-testi-avatar" style="background:linear-gradient(135deg,#00b894,#00838f);">RS</div>
              <div>
                <div class="lp-testi-name">Roberto Santos</div>
                <div class="lp-testi-role">Coordenador — Instituto Saber</div>
              </div>
            </div>
          </div>
          <div class="lp-testi-card lp-fade-up">
            <div class="lp-testi-quote">"</div>
            <div class="lp-testi-stars">★★★★★</div>
            <div class="lp-testi-text">"Implantei em 2 horas. Cadastrei todos os alunos e professores no mesmo dia. O suporte é rápido e o sistema não trava. Vale muito o investimento."</div>
            <div class="lp-testi-author">
              <div class="lp-testi-avatar" style="background:linear-gradient(135deg,#e84393,#c2185b);">FL</div>
              <div>
                <div class="lp-testi-name">Fernanda Lima</div>
                <div class="lp-testi-role">Proprietária — Centro Educacional Luz</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ COMO FUNCIONA ═══ -->
    <section class="lp-section-gray" id="lp-how">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">Passo a passo</div>
          <div class="lp-section-title lp-fade-up">Comece a usar em <span class="lp-grad">menos de 2 minutos</span></div>
          <div class="lp-section-sub lp-fade-up">Sem burocracia, sem instalação. Tudo no navegador.</div>
        </div>
        <div class="lp-steps-wrap lp-fade-up">
          <div class="lp-steps-line"></div>
          <div class="lp-steps">
            <div class="lp-step">
              <div class="lp-step-num">1</div>
              <div class="lp-step-icon"><i class="fa-solid fa-school"></i></div>
              <h4>Cadastre sua escola</h4>
              <p>Nome, CNPJ e e-mail. Em segundos sua escola está criada e pronta para usar.</p>
            </div>
            <div class="lp-step">
              <div class="lp-step-num">2</div>
              <div class="lp-step-icon"><i class="fa-solid fa-users"></i></div>
              <h4>Cadastre sua equipe</h4>
              <p>Adicione professores, secretários e gestores com acesso por e-mail.</p>
            </div>
            <div class="lp-step">
              <div class="lp-step-num">3</div>
              <div class="lp-step-icon"><i class="fa-solid fa-user-graduate"></i></div>
              <h4>Matricule os alunos</h4>
              <p>Cadastre alunos e responsáveis. Contas e acessos são criados automaticamente.</p>
            </div>
            <div class="lp-step">
              <div class="lp-step-num">4</div>
              <div class="lp-step-icon"><i class="fa-solid fa-chart-line"></i></div>
              <h4>Gerencie tudo</h4>
              <p>Notas, frequência, financeiro e comunicação em um único painel.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ PLANOS ═══ -->
    <section id="lp-plans">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">Preços</div>
          <div class="lp-section-title lp-fade-up">Planos para <span class="lp-grad">cada tamanho</span> de escola</div>
          <div class="lp-section-sub lp-fade-up">Comece grátis e faça upgrade conforme sua escola cresce.</div>
        </div>

        <div class="lp-billing-toggle lp-fade-up">
          <span class="lp-billing-label" id="lbl-monthly" style="font-weight:700;color:#1a73e8;">Mensal</span>
          <label class="lp-toggle-switch">
            <input type="checkbox" id="billingToggle" onchange="LandingPage.toggleBilling()">
            <span class="lp-toggle-slider"></span>
          </label>
          <span class="lp-billing-label" id="lbl-annual">Anual</span>
          <span class="lp-billing-badge">2 meses grátis</span>
        </div>

        <div class="lp-plans">
          <!-- Free Trial -->
          <div class="lp-plan-card lp-fade-up">
            <div class="lp-plan-name">Trial</div>
            <div class="lp-plan-price">Grátis</div>
            <div class="lp-plan-limit">por 7 dias completos</div>
            <ul class="lp-plan-features">
              <li><i class="fa-solid fa-check"></i> Acesso completo</li>
              <li><i class="fa-solid fa-check"></i> Cadastro de alunos</li>
              <li><i class="fa-solid fa-check"></i> Responsáveis e professores</li>
              <li><i class="fa-solid fa-check"></i> 1 gestor</li>
              <li><i class="fa-solid fa-check"></i> Sem cartão de crédito</li>
            </ul>
            <button class="lp-btn lp-btn-outline lp-plan-btn" onclick="LandingPage.goRegister('free')">
              Começar grátis
            </button>
          </div>

          <!-- Gestão 100 -->
          <div class="lp-plan-card lp-fade-up">
            <div class="lp-plan-name">Gestão 100</div>
            <div class="lp-plan-price" id="price-100">R$ 149<small>,90/mês</small></div>
            <div class="lp-plan-price-annual" id="price-100-annual" style="display:none;">R$ 1.499<small>/ano</small></div>
            <div class="lp-plan-limit">Até 150 alunos</div>
            <ul class="lp-plan-features">
              <li><i class="fa-solid fa-check"></i> Professores ilimitados</li>
              <li><i class="fa-solid fa-check"></i> Chat interno</li>
              <li><i class="fa-solid fa-check"></i> Sistema financeiro</li>
              <li><i class="fa-solid fa-check"></i> Portal do responsável</li>
              <li><i class="fa-solid fa-check"></i> Suporte por e-mail</li>
              <li style="color:#bbb;font-size:12px;"><i class="fa-solid fa-circle-info" style="color:#bbb;"></i> Taxa de 3% por transferência</li>
            </ul>
            <button class="lp-btn lp-btn-primary lp-plan-btn" onclick="LandingPage.goRegister('gestao_100')">
              Assinar agora
            </button>
          </div>

          <!-- Gestão 250 — POPULAR -->
          <div class="lp-plan-card popular lp-fade-up">
            <div class="lp-plan-badge">⭐ MAIS POPULAR</div>
            <div class="lp-plan-name">Gestão 250</div>
            <div class="lp-plan-price" id="price-250">R$ 249<small>,90/mês</small></div>
            <div class="lp-plan-price-annual" id="price-250-annual" style="display:none;">R$ 2.499<small>/ano</small></div>
            <div class="lp-plan-limit">Até 250 alunos</div>
            <ul class="lp-plan-features">
              <li><i class="fa-solid fa-check"></i> Tudo do Gestão 100</li>
              <li><i class="fa-solid fa-check"></i> Documentos digitais</li>
              <li><i class="fa-solid fa-check"></i> Notificações automáticas</li>
              <li><i class="fa-solid fa-check"></i> Relatórios avançados</li>
              <li><i class="fa-solid fa-check"></i> Suporte via WhatsApp</li>
              <li style="color:#bbb;font-size:12px;"><i class="fa-solid fa-circle-info" style="color:#bbb;"></i> Taxa de 3% por transferência</li>
            </ul>
            <button class="lp-btn lp-btn-accent lp-plan-btn" onclick="LandingPage.goRegister('gestao_250')">
              Assinar agora
            </button>
          </div>

          <!-- 251+ -->
          <div class="lp-plan-card lp-fade-up">
            <div class="lp-plan-name">Enterprise</div>
            <div class="lp-plan-price">Sob consulta</div>
            <div class="lp-plan-limit">Alunos ilimitados</div>
            <ul class="lp-plan-features">
              <li><i class="fa-solid fa-check"></i> Tudo do Gestão 250</li>
              <li><i class="fa-solid fa-check"></i> API de integração</li>
              <li><i class="fa-solid fa-check"></i> Relatórios customizados</li>
              <li><i class="fa-solid fa-check"></i> SLA garantido</li>
              <li><i class="fa-solid fa-check"></i> Gerente de conta dedicado</li>
            </ul>
            <button class="lp-btn lp-btn-outline lp-plan-btn" onclick="LandingPage.goContact()">
              Falar com consultor
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ EM BREVE ═══ -->
    <section class="lp-section-gray" id="lp-coming">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">Roadmap</div>
          <div class="lp-section-title lp-fade-up">Em breve no <span class="lp-grad">GestEscolar</span></div>
          <div class="lp-section-sub lp-fade-up">Novos módulos chegando para transformar ainda mais a experiência da sua escola.</div>
        </div>
        <div class="lp-coming">
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#7c4dff,#6200ea);"><i class="fa-solid fa-fingerprint"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Registro de Ponto Online</h3>
              <p>Controle de ponto digital para colaboradores, com relatórios automáticos e integração com a folha de pagamento.</p>
            </div>
          </div>
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#00b894,#00838f);"><i class="fa-solid fa-spell-check"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Provas e Correção Automática</h3>
              <p>Aplicação de provas online com correção automática e análise de desempenho individual e por turma.</p>
            </div>
          </div>
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#ff6f00,#e65100);"><i class="fa-solid fa-brain"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Análise Pedagógica por IA</h3>
              <p>Identificação automática de dificuldades por turma com sugestão de planos de ação pedagógica.</p>
            </div>
          </div>
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#e84393,#c2185b);"><i class="fa-solid fa-paperclip"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Envio de Arquivos no Chat</h3>
              <p>Compartilhe documentos, imagens e atividades diretamente pelo chat entre escola e família.</p>
            </div>
          </div>
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#3ddc84,#1f6e3f);"><i class="fa-brands fa-android"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Aplicativo Nativo Android</h3>
              <p>App nativo para Android com acesso offline, notificações push e integração perfeita com o sistema.</p>
            </div>
          </div>
          <div class="lp-coming-card lp-fade-up">
            <div class="lp-coming-icon" style="background:linear-gradient(135deg,#555555,#000000);"><i class="fa-brands fa-apple"></i></div>
            <div>
              <div class="lp-coming-badge">EM BREVE</div>
              <h3>Aplicativo Nativo iOS</h3>
              <p>App nativo para iPhone com design elegante, acesso offline e sincronização contínua com a plataforma.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ FAQ ═══ -->
    <section id="lp-faq">
      <div class="lp-section">
        <div style="text-align:center;">
          <div class="lp-section-eyebrow lp-fade-up">FAQ</div>
          <div class="lp-section-title lp-fade-up">Dúvidas <span class="lp-grad">frequentes</span></div>
          <div class="lp-section-sub lp-fade-up">Respondemos as perguntas mais comuns sobre a plataforma.</div>
        </div>
        <div class="lp-faq-list lp-fade-up">
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>Como recebo o dinheiro pago pelos responsáveis na plataforma?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Quando um responsável paga via PIX ou cartão, o valor cai diretamente na sua <strong>conta Asaas</strong> — gateway homologado pelo Banco Central. <strong>Ao se cadastrar na plataforma, uma conta no modelo Split é criada automaticamente para sua escola</strong>, garantindo que você receba o dinheiro <strong>sem intervenção de terceiros</strong>. Você pode transferir o saldo para qualquer conta bancária a qualquer momento, <strong>sem valor mínimo, direto da plataforma GESTESCOLAR</strong>. Caso queira acessar sua conta Asaas para consultas, <strong>disponibilizamos todos os dados de acesso</strong> para você. A plataforma desconta apenas a <strong>taxa de 3%</strong> sobre cada pagamento.</p>
            </div>
          </div>
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>O GestEscolar fica com alguma parte do dinheiro das mensalidades?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Apenas a <strong>taxa de 3%</strong> é descontada automaticamente — esse valor cobre o processamento do PIX/cartão e a infraestrutura. Os outros 97% são seus, creditados imediatamente após a confirmação do pagamento.</p>
            </div>
          </div>
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>Quanto tempo leva para o dinheiro cair na minha conta?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Pagamentos via <strong>PIX</strong> são confirmados em segundos e disponíveis para saque imediatamente. Cartão de crédito pode levar até 30 dias (ciclo normal da operadora).</p>
            </div>
          </div>
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>Os dados dos alunos ficam seguros? Outras escolas podem ver meus dados?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Não. Cada escola tem seu próprio <strong>cofre de dados fechado</strong> — suas informações ficam 100% isoladas e <strong>ninguém mais consegue acessar</strong>. É como se cada escola tivesse um cadeado digital único. <strong>O sistema é seguro, criptografado e monitorado</strong> 24/7 para garantir que seus dados nunca saiam do lugar.</p>
            </div>
          </div>
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>Posso usar no celular? Precisa instalar algum aplicativo?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Sim! O GestEscolar é um <strong>PWA (Progressive Web App)</strong> — funciona no navegador do celular sem instalação. No Android (Chrome) ou iPhone (Safari) toque em "Adicionar à tela inicial" para experiência nativa.</p>
            </div>
          </div>
          <div class="lp-faq-item">
            <button class="lp-faq-q" onclick="LandingPage.toggleFaq(this)">
              <span>Como funciona o período gratuito de 7 dias?</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lp-faq-a">
              <p>Ao criar sua conta, você tem <strong>acesso completo por 7 dias grátis</strong>, sem cartão de crédito. Após esse período, escolha o plano ideal. Se não quiser continuar, é só não assinar — sem cobranças automáticas.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ CTA FINAL ═══ -->
    <section class="lp-cta">
      <h2 class="lp-fade-up">Pronto para <span>transformar</span><br>sua escola?</h2>
      <p class="lp-fade-up">Cadastro gratuito em menos de 2 minutos. Sem cartão de crédito.</p>
      <div class="lp-cta-btns lp-fade-up">
        <button class="lp-btn lp-btn-accent lp-cta-btn" onclick="LandingPage.goRegister('free')">
          <i class="fa-solid fa-rocket"></i> Começar Grátis Agora
        </button>
        <button class="lp-btn lp-cta-btn lp-cta-btn-ghost" onclick="LandingPage.goContact()">
          <i class="fa-solid fa-headset"></i> Falar com Consultor
        </button>
      </div>
    </section>

    <!-- ═══ FOOTER ═══ -->
    <footer class="lp-footer">
      <div class="lp-footer-inner">
        <div>
          <div class="lp-footer-brand"><i class="fa-solid fa-graduation-cap"></i> GestEscolar</div>
          <p>Plataforma SaaS de gestão escolar. Simplifique matrículas, financeiro, notas e comunicação da sua instituição.</p>
        </div>
        <div>
          <h4>Plataforma</h4>
          <ul>
            <li><a href="#" onclick="LandingPage.scrollTo('features')">Funcionalidades</a></li>
            <li><a href="#" onclick="LandingPage.scrollTo('plans')">Planos</a></li>
            <li><a href="#" onclick="LandingPage.scrollTo('coming')">Em breve</a></li>
          </ul>
        </div>
        <div>
          <h4>Acesso</h4>
          <ul>
            <li><a href="#" onclick="LandingPage.goLogin()">Login</a></li>
            <li><a href="#" onclick="LandingPage.goRegister()">Cadastrar escola</a></li>
          </ul>
        </div>
        <div>
          <h4>Contato</h4>
          <ul>
            <li><a href="mailto:geste.escolar@gmail.com"><i class="fa-solid fa-envelope"></i> geste.escolar@gmail.com</a></li>
          </ul>
        </div>
      </div>
      <div class="lp-footer-bottom">
        <span>© 2026 GestEscolar. Todos os direitos reservados. LGPD compliant.</span>
        <div class="lp-footer-social">
          <a href="#" title="Instagram"><i class="fa-brands fa-instagram"></i></a>
          <a href="#" title="LinkedIn"><i class="fa-brands fa-linkedin"></i></a>
          <a href="#" title="YouTube"><i class="fa-brands fa-youtube"></i></a>
        </div>
      </div>
    </footer>

    <!-- Botão flutuante WhatsApp -->
    <a class="lp-whatsapp-btn" href="https://wa.me/5500000000000?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20GestEscolar!" target="_blank" title="Falar no WhatsApp">
      <i class="fa-brands fa-whatsapp"></i>
    </a>

  </div>`;

  LandingPage.init();
});

const LandingPage = {
  _annual: false,

  init() {
    // ── Fade-up com IntersectionObserver ──────────────────────────────
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Animar contadores quando métricas ficam visíveis
          if (entry.target.closest('.lp-metrics-inner')) {
            entry.target.querySelectorAll('[data-count]').forEach(el => LandingPage._animateCount(el));
          }
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-fade-up').forEach(el => observer.observe(el));

    // Animar métricas diretamente também
    const metricsObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.querySelectorAll('[data-count]').forEach(el => LandingPage._animateCount(el));
          metricsObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    const metrics = document.querySelector('.lp-metrics-inner');
    if (metrics) metricsObs.observe(metrics);

    // ── Navbar scroll ──────────────────────────────────────────────
    window.addEventListener('scroll', () => {
      const nav = document.getElementById('lpNav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    });

    // ── 3D Tilt nos cards ─────────────────────────────────────────
    document.querySelectorAll('.lp-tilt').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -8;
        const rotY = ((x - cx) / cx) * 8;
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
        card.style.boxShadow = `${-rotY * 2}px ${rotX * 2}px 40px rgba(0,0,0,0.12)`;
        // Brilho seguindo o mouse
        const after = card.querySelector('::after');
        card.style.setProperty('--mouse-x', x + 'px');
        card.style.setProperty('--mouse-y', y + 'px');
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
      });
    });

    // ── Mockup 3D — paralaxe leve no mouse ───────────────────────
    const mockup = document.getElementById('lpMockup');
    if (mockup) {
      document.addEventListener('mousemove', (e) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx;
        const dy = (e.clientY - cy) / cy;
        mockup.style.transform = `rotateY(${-18 + dx * 5}deg) rotateX(${8 - dy * 3}deg)`;
      });
    }
  },

  // ── Contador animado ────────────────────────────────────────────
  _animateCount(el) {
    if (el.dataset.animated) return;
    el.dataset.animated = '1';
    const target  = parseInt(el.dataset.count, 10);
    const prefix  = el.dataset.prefix  || '';
    const suffix  = el.dataset.suffix  || '';
    const duration = 1800;
    const start   = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(target * ease);
      el.textContent = prefix + val + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  toggleBilling() {
    this._annual = document.getElementById('billingToggle').checked;
    const lblM = document.getElementById('lbl-monthly');
    const lblA = document.getElementById('lbl-annual');
    if (lblM) { lblM.style.fontWeight = this._annual ? '400' : '700'; lblM.style.color = this._annual ? '#999' : '#1a73e8'; }
    if (lblA) { lblA.style.fontWeight = this._annual ? '700' : '400'; lblA.style.color = this._annual ? '#1a73e8' : '#999'; }
    ['100','250'].forEach(p => {
      const m = document.getElementById(`price-${p}`);
      const a = document.getElementById(`price-${p}-annual`);
      if (m) m.style.display = this._annual ? 'none' : '';
      if (a) a.style.display = this._annual ? '' : 'none';
    });
  },

  scrollTo(section) {
    const el = document.getElementById('lp-' + section);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  goLogin()    { Router.go('login'); },
  goRegister(planId = 'free') {
    localStorage.setItem('selectedPlan', planId);
    if (planId === 'free') {
      Router.go('school-register');
    } else {
      Router.go('checkout', { planId });
    }
  },
  goContact()  { window.open('https://wa.me/5500000000000?text=Ol%C3%A1%2C%20tenho%20interesse%20no%20GestEscolar!', '_blank'); },

  toggleFaq(btn) {
    const item = btn.closest('.lp-faq-item');
    if (!item) return;
    const ans  = item.querySelector('.lp-faq-a');
    const open = btn.classList.toggle('open');
    if (ans) ans.classList.toggle('open', open);
  },

  toggleMenu() {
    const links = document.getElementById('lpNavLinks');
    if (!links) return;
    const show = links.style.display !== 'flex';
    links.style.cssText = show
      ? 'display:flex;flex-direction:column;position:absolute;top:68px;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(20px);padding:16px 24px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:999;gap:16px;'
      : '';
  },

  async checkPasswordResetToken() {
    if (typeof LoginPage !== 'undefined') return await LoginPage.checkPasswordResetToken();
    return false;
  },

  _showResetPasswordForm() {
    if (typeof LoginPage !== 'undefined') LoginPage._showResetPasswordForm();
  }
};
