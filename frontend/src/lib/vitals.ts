// Telemetria leve de Web Vitals — sem dados pessoais.
// Resultados vão para console.info (sempre) e opcionalmente para o backend.
// Metas: LCP ≤ 2500 ms · INP ≤ 200 ms · CLS ≤ 0.1

export function reportWebVitals() {
  if (typeof PerformanceObserver === 'undefined') return;

  // ── TTFB + DOMContentLoaded + Load (via Navigation Timing) ──
  const reportNav = () => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (!nav) return;
    console.info('[vitals] TTFB', Math.round(nav.responseStart - nav.requestStart), 'ms');
    console.info('[vitals] DOMContentLoaded', Math.round(nav.domContentLoadedEventEnd), 'ms');
    console.info('[vitals] Load', Math.round(nav.loadEventEnd), 'ms');
  };
  if (document.readyState === 'complete') reportNav();
  else window.addEventListener('load', reportNav, { once: true });

  // ── LCP (Largest Contentful Paint) ──
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) console.info('[vitals] LCP', Math.round(last.startTime), 'ms');
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { /* unsupported */ }

  // ── CLS (Cumulative Layout Shift) — reportado na saída da página ──
  try {
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const entry = e as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!entry.hadRecentInput) cls += entry.value ?? 0;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden')
        console.info('[vitals] CLS', cls.toFixed(4));
    }, { once: true });
  } catch { /* unsupported */ }

  // ── INP (Interaction to Next Paint) — candidate via event timing ──
  try {
    let maxInp = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const entry = e as PerformanceEntry & { duration?: number };
        const dur = entry.duration ?? 0;
        if (dur > maxInp) { maxInp = dur; console.info('[vitals] INP candidate', Math.round(dur), 'ms'); }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
  } catch { /* unsupported */ }
}
