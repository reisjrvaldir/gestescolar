import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './landing-v1.css';
import { LANDING_V1_HTML } from './landingV1Html';
import { signIn } from '@/lib/authClient';
import { contactHref, HAS_WHATSAPP } from '@/lib/siteConfig';
import { funnel } from '@/lib/analytics';
import { TestingPopup } from '@/components/landing/TestingPopup';

/**
 * Landing page — reprodução fiel da versão v1 (backup gestescolar-v1).
 * O markup original (HTML puro) é injetado via dangerouslySetInnerHTML e o
 * CSS original (landing-v1.css) o estiliza. Os comportamentos JS da v1
 * (fade-up, tilt 3D, parallax, FAQ, toggle mensal/anual, menu mobile) são
 * portados aqui; a navegação usa o React Router.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const [testingPopupOpen, setTestingPopupOpen] = useState(false);
  const [testingPopupPlan, setTestingPopupPlan] = useState<string | undefined>();

  // Neutraliza o `height: 100%` global (index.css) enquanto a landing está
  // montada — sem isso o body vira um container de scroll de 1 viewport de
  // altura e a rolagem por âncora não sai do lugar. Ver landing-v1.css.
  useEffect(() => {
    document.documentElement.classList.add('lp-active');
    return () => document.documentElement.classList.remove('lp-active');
  }, []);

  useEffect(() => {
    // ── Handlers da landing v1, disparados via delegação por `data-lp-action`.
    // Antes vinham como atributos `onclick=`/`onchange=`/`onkeydown=` inline,
    // mas a CSP `script-src 'self'` bloqueia handlers inline — os botões
    // "silenciavam" em produção. Delegar num único listener resolve sem
    // enfraquecer o CSP.
    const state = { annual: false };

    function scrollToSection(section: string) {
      const el = document.getElementById('lp-' + section);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function slideFeatures(dir: number) {
      const t = document.getElementById('lpFeatTrack');
      if (!t) return;
      const card = t.querySelector('.lp-feature-card') as HTMLElement | null;
      const gap = parseFloat(getComputedStyle(t).columnGap) || 24;
      const passo = card ? card.offsetWidth + gap : t.clientWidth;
      const max = t.scrollWidth - t.clientWidth;
      const destino = Math.max(0, Math.min(max, t.scrollLeft + dir * passo));
      // scroll-snap mandatory cancela scroll suave nativo e "gruda" no primeiro
      // card se avançarmos em passos pequenos. Desliga o snap durante a
      // animação e religa no fim (o snap então acomoda o card mais próximo).
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        t.style.scrollSnapType = 'none';
        t.scrollLeft = destino;
        t.style.scrollSnapType = '';
        return;
      }
      const inicio = t.scrollLeft;
      const t0 = performance.now();
      const dur = 380;
      t.style.scrollSnapType = 'none';
      const anima = (agora: number) => {
        const p = Math.min(1, (agora - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        t.scrollLeft = inicio + (destino - inicio) * e;
        if (p < 1) requestAnimationFrame(anima);
        else t.style.scrollSnapType = '';
      };
      requestAnimationFrame(anima);
    }
    /**
     * CTA principal → POPUP de teste controlado, não cadastro direto.
     *
     * Até 07/08/2026 isto abria a aba de cadastro e a pessoa criava a própria
     * escola sozinha. A operação passou a ser curada: quem abre escola é a
     * equipe, pelo painel de superadmin. Desde então o CTA virou captura de
     * lead com desconto de lançamento — ver TestingPopup.
     */
    function goRegister(plan?: string) {
      funnel.ctaClick(plan ? 'plan_card' : 'nav_hero', plan);
      setTestingPopupPlan(plan);
      setTestingPopupOpen(true);
    }
    function openSuperadmin() {
      const ov = document.getElementById('lpSaOverlay');
      const err = document.getElementById('lpSaErr');
      if (err) err.style.display = 'none';
      if (ov) ov.classList.add('open');
      setTimeout(() => document.getElementById('lpSaEmail')?.focus(), 50);
    }
    function closeSuperadmin() {
      document.getElementById('lpSaOverlay')?.classList.remove('open');
    }
    async function superadminLogin() {
      const email = (document.getElementById('lpSaEmail') as HTMLInputElement | null)?.value.trim() ?? '';
      const pass = (document.getElementById('lpSaPass') as HTMLInputElement | null)?.value ?? '';
      const err = document.getElementById('lpSaErr');
      const btn = document.getElementById('lpSaSubmit') as HTMLButtonElement | null;
      const showErr = (m: string) => { if (err) { err.textContent = m; err.style.display = 'block'; } };
      if (!email || !pass) { showErr('Informe e-mail e senha.'); return; }
      if (err) err.style.display = 'none';
      if (btn) { btn.disabled = true; btn.textContent = 'Entrando…'; }
      try {
        const res: any = await signIn.email({ email, password: pass });
        if (res?.error) { showErr('E-mail ou senha inválidos.'); return; }
        navigate('/saas');
      } catch {
        showErr('Não foi possível entrar. Tente novamente.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
      }
    }
    function toggleFaq(btn: HTMLElement) {
      const item = btn.closest('.lp-faq-item');
      if (!item) return;
      const ans = item.querySelector('.lp-faq-a');
      const open = btn.classList.toggle('open');
      if (ans) ans.classList.toggle('open', open);
    }
    function toggleBilling() {
      const toggle = document.getElementById('billingToggle') as HTMLInputElement | null;
      state.annual = !!toggle?.checked;
      const lblM = document.getElementById('lbl-monthly');
      const lblA = document.getElementById('lbl-annual');
      if (lblM) { lblM.style.fontWeight = state.annual ? '400' : '700'; lblM.style.color = state.annual ? '#999' : '#1a73e8'; }
      if (lblA) { lblA.style.fontWeight = state.annual ? '700' : '400'; lblA.style.color = state.annual ? '#1a73e8' : '#999'; }
      ['100', '250'].forEach((p) => {
        const m = document.getElementById(`price-${p}`);
        const a = document.getElementById(`price-${p}-annual`);
        if (m) m.style.display = state.annual ? 'none' : '';
        if (a) a.style.display = state.annual ? '' : 'none';
      });
    }
    function toggleMenu() {
      const links = document.getElementById('lpNavLinks');
      if (!links) return;
      const show = links.style.display !== 'flex';
      links.style.cssText = show
        ? 'display:flex;flex-direction:column;position:absolute;top:68px;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(20px);padding:16px 24px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:999;gap:16px;'
        : '';
    }
    function animateCount(el: HTMLElement) {
      if (el.dataset.animated) return;
      el.dataset.animated = '1';
      const target = parseInt(el.dataset.count || '0', 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const startAt = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startAt;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const val = Math.round(target * ease);
        el.textContent = prefix + val + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    // ── Delegação: uma única função lida com todos os data-lp-action. ──
    const onDelegatedClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-lp-action]');
      if (!target) return;
      const action = target.dataset.lpAction;
      // Links usam data-lp-action + href — evita a navegação padrão do <a>.
      if (target.tagName === 'A') e.preventDefault();
      switch (action) {
        case 'top':      window.scrollTo({ top: 0, behavior: 'smooth' }); break;
        case 'scroll':   if (target.dataset.lpTarget) scrollToSection(target.dataset.lpTarget); break;
        case 'login':    navigate('/login'); break;
        case 'register': goRegister(target.dataset.lpPlan); break;
        case 'contact':  funnel.contactClick('landing'); window.open(contactHref(), '_blank', 'noopener,noreferrer'); break;
        case 'slide':    slideFeatures(Number(target.dataset.lpDir) || 1); break;
        case 'menu':     toggleMenu(); break;
        case 'faq':      toggleFaq(target); break;
        case 'sa-open':  openSuperadmin(); break;
        case 'sa-close': closeSuperadmin(); break;
        case 'sa-submit': superadminLogin(); break;
        // Fecha o modal do super-admin apenas ao clicar no overlay em si
        // (fora do card). Sem esse guard, clicar no formulário fecharia.
        case 'sa-overlay': if (e.target === target) closeSuperadmin(); break;
      }
    };
    const onDelegatedChange = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-lp-action]');
      if (!target) return;
      if (target.dataset.lpAction === 'billing') toggleBilling();
    };
    const onDelegatedKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-lp-keydown]');
      if (!target) return;
      if (target.dataset.lpKeydown === 'sa-submit') superadminLogin();
    };
    document.addEventListener('click', onDelegatedClick);
    document.addEventListener('change', onDelegatedChange);
    document.addEventListener('keydown', onDelegatedKeydown);

    // Botão flutuante do WhatsApp: só aparece com número configurado.
    // Sem isso ele renderizava apontando para um número inexistente.
    const waBtn = document.getElementById('lpWhatsapp') as HTMLAnchorElement | null;
    if (waBtn && HAS_WHATSAPP) {
      waBtn.href = contactHref();
      waBtn.style.display = '';
      waBtn.addEventListener('click', () => funnel.contactClick('floating'));
    }

    // ── Efeitos visuais (fade-up, contadores, navbar, tilt, parallax) ──
    const fadeObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          if (entry.target.closest('.lp-metrics-inner')) {
            entry.target.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => animateCount(el));
          }
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-fade-up').forEach((el) => fadeObs.observe(el));

    const metricsObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => animateCount(el));
          metricsObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    const metrics = document.querySelector('.lp-metrics-inner');
    if (metrics) metricsObs.observe(metrics);

    const onScroll = () => {
      const nav = document.getElementById('lpNav');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll);

    document.querySelectorAll<HTMLElement>('.lp-tilt').forEach((card) => {
      const move = (e: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotX = ((y - rect.height / 2) / (rect.height / 2)) * -8;
        const rotY = ((x - rect.width / 2) / (rect.width / 2)) * 8;
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`;
        card.style.boxShadow = `${-rotY * 2}px ${rotX * 2}px 40px rgba(0,0,0,0.12)`;
      };
      const leave = () => { card.style.transform = ''; card.style.boxShadow = ''; };
      card.addEventListener('mousemove', move);
      card.addEventListener('mouseleave', leave);
    });

    // Numera cada card (NN / TT). O total revela quantos módulos ativos
    // existem; feito em JS para não repetir o número em 13 blocos de HTML.
    const cards = document.querySelectorAll<HTMLElement>('#lpFeatTrack .lp-feature-card');
    const total = String(cards.length).padStart(2, '0');
    cards.forEach((c, i) => {
      if (c.querySelector('.lp-feature-num')) return; // idempotente
      const n = document.createElement('span');
      n.className = 'lp-feature-num';
      n.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${total}`;
      c.appendChild(n);
    });

    // Setas do carrossel: somem nas pontas, para não virarem botão morto.
    const trilha = document.getElementById('lpFeatTrack');
    const btnPrev = document.getElementById('lpFeatPrev');
    const btnNext = document.getElementById('lpFeatNext');
    const syncSetas = () => {
      if (!trilha || !btnPrev || !btnNext) return;
      const fim = trilha.scrollWidth - trilha.clientWidth;
      btnPrev.toggleAttribute('hidden', trilha.scrollLeft <= 4);
      // Margem de 4px absorve o arredondamento sub-pixel do scroll.
      btnNext.toggleAttribute('hidden', trilha.scrollLeft >= fim - 4);
    };
    trilha?.addEventListener('scroll', syncSetas, { passive: true });
    window.addEventListener('resize', syncSetas);
    syncSetas();

    // Drag para arrastar a trilha com mouse (click e hold)
    // Auto-scroll: avança automaticamente a cada 4 segundos, pausando na interação
    if (trilha) {
      let isDragging = false;
      let startX = 0;
      let startScroll = 0;
      let autoScrollTimer: NodeJS.Timeout;

      const pauseAutoScroll = () => {
        if (autoScrollTimer) clearInterval(autoScrollTimer);
      };

      const startDrag = (e: MouseEvent) => {
        if ((e.target as Element).closest('button')) return; // não arrasta ao clicar nas setas
        isDragging = true;
        startX = e.clientX;
        startScroll = trilha.scrollLeft;
        trilha.classList.add('dragging');
        pauseAutoScroll();
      };

      const moveDrag = (e: MouseEvent) => {
        if (!isDragging) return;
        const diff = startX - e.clientX; // positivo = move pra frente
        trilha.scrollLeft = startScroll + diff;
      };

      const endDrag = () => {
        isDragging = false;
        trilha.classList.remove('dragging');
        startAutoScroll(); // retoma após soltar
      };

      trilha.addEventListener('mousedown', startDrag);
      document.addEventListener('mousemove', moveDrag);
      document.addEventListener('mouseup', endDrag);

      // Auto-scroll: avança a cada 4 segundos
      const startAutoScroll = () => {
        pauseAutoScroll();
        autoScrollTimer = setInterval(() => {
          const max = trilha.scrollWidth - trilha.clientWidth;
          const proximoScroll = trilha.scrollLeft + 200; // 200px por passo
          if (proximoScroll < max) {
            trilha.style.scrollSnapType = 'none';
            trilha.scrollLeft = proximoScroll;
            trilha.style.scrollSnapType = '';
          } else {
            // volta ao início
            trilha.scrollLeft = 0;
          }
        }, 4000);
      };

      // Pausa auto-scroll quando clica nas setas
      btnPrev?.addEventListener('click', () => { pauseAutoScroll(); startAutoScroll(); });
      btnNext?.addEventListener('click', () => { pauseAutoScroll(); startAutoScroll(); });

      // Inicializa auto-scroll
      startAutoScroll();
    }

    const mockup = document.getElementById('lpMockup');
    const onMouseMove = (e: MouseEvent) => {
      if (!mockup) return;
      const dx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      mockup.style.transform = `rotateY(${-18 + dx * 5}deg) rotateX(${8 - dy * 3}deg)`;
    };
    if (mockup) document.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousemove', onMouseMove);
      trilha?.removeEventListener('scroll', syncSetas);
      window.removeEventListener('resize', syncSetas);
      document.removeEventListener('click', onDelegatedClick);
      document.removeEventListener('change', onDelegatedChange);
      document.removeEventListener('keydown', onDelegatedKeydown);
      fadeObs.disconnect();
      metricsObs.disconnect();
    };
  }, [navigate]);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: LANDING_V1_HTML }} />
      <TestingPopup
        open={testingPopupOpen}
        plan={testingPopupPlan}
        onClose={() => setTestingPopupOpen(false)}
      />
    </>
  );
}
