/**
 * Instrumentação de conversão (GA4 + Meta Pixel).
 *
 * Os IDs vêm de env. Sem ID configurado nada é carregado e `trackEvent` vira
 * no-op — nenhum script de terceiro é baixado em dev nem em preview, e a
 * ausência de configuração nunca quebra a aplicação.
 */

const GA4_ID = import.meta.env.VITE_GA4_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  if (GA4_ID) loadGa4(GA4_ID);
  if (META_PIXEL_ID) loadMetaPixel(META_PIXEL_ID);
}

function loadGa4(id: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // O gtag exige o `arguments` cru — não trocar por rest params.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id);
}

function loadMetaPixel(id: string): void {
  if (window.fbq) return;
  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod.apply(fbq, args) : fbq.queue.push(args);
  };
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  window._fbq = fbq;

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);

  fbq('init', id);
  fbq('track', 'PageView');
}

/** Evento customizado. No-op quando nenhum provedor está configurado. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  window.gtag?.('event', name, params);
  window.fbq?.('trackCustom', name, params);
}

/**
 * Marcos do funil. Centralizados aqui para que os nomes fiquem consistentes
 * entre a landing e o app — relatório quebrado por nome divergente é o erro
 * mais comum nesse tipo de instrumentação.
 */
export const funnel = {
  /** Clique em qualquer CTA de teste grátis. `where`: hero | nav | plans | final */
  ctaClick: (where: string, plan?: string) => trackEvent('cta_click', { where, plan: plan ?? 'none' }),
  /** Abriu o formulário de cadastro. */
  signupView: (source: string) => trackEvent('signup_view', { source }),
  /** Conta criada com sucesso. */
  signupSuccess: () => {
    trackEvent('sign_up', { method: 'email' });
    window.fbq?.('track', 'CompleteRegistration');
  },
  /** Clique em falar com consultor / WhatsApp. */
  contactClick: (where: string) => trackEvent('contact_click', { where }),
  /** Formulário do popup de teste controlado enviado com sucesso. */
  leadSubmit: (plan?: string) => {
    trackEvent('lead_submit', { plan: plan ?? 'none' });
    window.fbq?.('track', 'Lead');
  },
};
