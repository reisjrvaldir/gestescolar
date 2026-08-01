/**
 * Configuração de contato público do site.
 *
 * O número do WhatsApp vem de env (VITE_WHATSAPP_NUMBER) porque muda entre
 * ambientes e nunca deve ficar hardcoded — a landing carregava o placeholder
 * `5500000000000`, que abria uma conversa com um número inexistente e perdia
 * todo lead que clicava em "Falar com Consultor".
 *
 * Enquanto o número não estiver configurado, `HAS_WHATSAPP` é false e os CTAs
 * caem para o e-mail via `contactHref()`. Melhor um canal que funciona do que
 * um botão quebrado.
 */

const rawWhatsapp = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '';

/** Só dígitos, no formato internacional (ex.: 5571999998888). */
export const WHATSAPP_NUMBER = rawWhatsapp.replace(/\D/g, '');

/** 55 (BR) + DDD (2) + número (8 ou 9 dígitos). */
export const HAS_WHATSAPP = /^55\d{10,11}$/.test(WHATSAPP_NUMBER);

export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? 'geste.escolar@gmail.com';

const DEFAULT_MESSAGE = 'Olá, tenho interesse no GestEscolar!';

/**
 * Link do canal de contato: WhatsApp quando configurado, e-mail caso contrário.
 * Use sempre esta função em vez de montar uma URL wa.me à mão.
 */
export function contactHref(message: string = DEFAULT_MESSAGE): string {
  if (HAS_WHATSAPP) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
  const subject = encodeURIComponent('Interesse no GestEscolar');
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodeURIComponent(message)}`;
}
