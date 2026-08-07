import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './landing-v1.css';
import { LANDING_V1_HTML } from './landingV1Html';
import { signIn } from '@/lib/authClient';
import { contactHref, HAS_WHATSAPP } from '@/lib/siteConfig';
import { funnel } from '@/lib/analytics';

/** Slug do plano no HTML da landing → nome legível, usado na mensagem de contato. */
const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  gestao_100: 'Gestão 100',
  gestao_250: 'Gestão 250',
  ilimitado: 'Ilimitado',
};

/**
 * Landing page — reprodução fiel da versão v1 (backup gestescolar-v1).
 * O markup original (HTML puro) é injetado via dangerouslySetInnerHTML e o
 * CSS original (landing-v1.css) o estiliza. Os comportamentos JS da v1
 * (fade-up, tilt 3D, parallax, FAQ, toggle mensal/anual, menu mobile) são
 * portados aqui; a navegação usa o React Router.
 */
export function LandingPage() {
  const navigate = useNavigate();

  // Neutraliza o `height: 100%` global (index.css) enquanto a landing está
  // montada — sem isso o body vira um container de scroll de 1 viewport de
  // altura e a rolagem por âncora não sai do lugar. Ver landing-v1.css.
  useEffect(() => {
    document.documentElement.classList.add('lp-active');
    return () => document.documentElement.classList.remove('lp-active');
  }, []);

  useEffect(() => {
    // ── Handlers de navegação (substituem Router.go / LandingPage.* da v1) ──
    const LP: any = {
      _annual: false,
      scrollTo(section: string) {
        const el = document.getElementById('lp-' + section);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      goLogin() { navigate('/login'); },
      /**
       * CTA principal → CONTATO, não cadastro.
       *
       * Até 07/08/2026 isto abria a aba de cadastro e a pessoa criava a própria
       * escola sozinha. A operação passou a ser curada: quem abre escola é a
       * equipe, pelo painel de superadmin. O CTA vira captura de contato e o
       * plano de interesse segue junto para o funil.
       */
      goRegister(plan?: string) {
        funnel.ctaClick(plan ? 'plan_card' : 'nav_hero', plan);
        funnel.contactClick(plan ? `plan_${plan}` : 'hero');
        const msg = plan
          ? `Olá! Tenho interesse no GestEscolar (plano ${PLAN_NAMES[plan] ?? plan}) e quero abrir a conta da minha escola.`
          : 'Olá! Tenho interesse no GestEscolar e quero abrir a conta da minha escola.';
        window.open(contactHref(msg), '_blank', 'noopener,noreferrer');
      },
      goContact() {
        funnel.contactClick('landing');
        window.open(contactHref(), '_blank', 'noopener,noreferrer');
      },
      openSuperadmin() {
        const ov = document.getElementById('lpSaOverlay');
        const err = document.getElementById('lpSaErr');
        if (err) err.style.display = 'none';
        if (ov) ov.classList.add('open');
        setTimeout(() => document.getElementById('lpSaEmail')?.focus(), 50);
      },
      closeSuperadmin() {
        document.getElementById('lpSaOverlay')?.classList.remove('open');
      },
      async superadminLogin() {
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
      },
      toggleFaq(btn: HTMLElement) {
        const item = btn.closest('.lp-faq-item');
        if (!item) return;
        const ans = item.querySelector('.lp-faq-a');
        const open = btn.classList.toggle('open');
        if (ans) ans.classList.toggle('open', open);
      },
      toggleBilling() {
        const toggle = document.getElementById('billingToggle') as HTMLInputElement | null;
        LP._annual = !!toggle?.checked;
        const lblM = document.getElementById('lbl-monthly');
        const lblA = document.getElementById('lbl-annual');
        if (lblM) { lblM.style.fontWeight = LP._annual ? '400' : '700'; lblM.style.color = LP._annual ? '#999' : '#1a73e8'; }
        if (lblA) { lblA.style.fontWeight = LP._annual ? '700' : '400'; lblA.style.color = LP._annual ? '#1a73e8' : '#999'; }
        ['100', '250'].forEach((p) => {
          const m = document.getElementById(`price-${p}`);
          const a = document.getElementById(`price-${p}-annual`);
          if (m) m.style.display = LP._annual ? 'none' : '';
          if (a) a.style.display = LP._annual ? '' : 'none';
        });
      },
      toggleMenu() {
        const links = document.getElementById('lpNavLinks');
        if (!links) return;
        const show = links.style.display !== 'flex';
        links.style.cssText = show
          ? 'display:flex;flex-direction:column;position:absolute;top:68px;left:0;right:0;background:rgba(255,255,255,.97);backdrop-filter:blur(20px);padding:16px 24px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:999;gap:16px;'
          : '';
      },
      _animateCount(el: HTMLElement) {
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
      },
    };
    (window as any).LandingPage = LP;
    (window as any).Router = {
      go: (page: string) => {
        if (page === 'login') navigate('/login');
        else if (page === 'school-register' || page === 'register' || page === 'checkout') navigate('/onboarding');
        // 'privacy' / 'terms': sem rota dedicada no app atual — ignora.
      },
    };

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
            entry.target.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => LP._animateCount(el));
          }
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.lp-fade-up').forEach((el) => fadeObs.observe(el));

    const metricsObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => LP._animateCount(el));
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
      fadeObs.disconnect();
      metricsObs.disconnect();
      delete (window as any).LandingPage;
      delete (window as any).Router;
    };
  }, [navigate]);

  return <div dangerouslySetInnerHTML={{ __html: LANDING_V1_HTML }} />;
}
