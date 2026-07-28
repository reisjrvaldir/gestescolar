// =============================================================
//  Envio de e-mails transacionais (Resend HTTP API).
//  - No-op seguro se RESEND_API_KEY não estiver configurada: apenas loga e
//    retorna false, NUNCA lança — o chamador deve ser fire-and-forget para
//    que uma falha de e-mail jamais quebre o fluxo principal (cobrança etc.).
// =============================================================
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'GestEscolar <noreply@gestescolar.com.br>';
const APP_URL = process.env.FRONTEND_URL || 'https://gestescolar.com.br';

export const isEmailConfigured = Boolean(RESEND_API_KEY);

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[email] RESEND_API_KEY ausente — e-mail não enviado:', input.subject);
    return false;
  }
  if (!input.to || !input.to.includes('@')) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: EMAIL_FROM, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[email] falha ao enviar:', res.status, t.slice(0, 200));
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[email] erro:', err?.message ?? err);
    return false;
  }
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F172A">
    <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0">
    <p style="font-size:12px;color:#94A3B8">GestEscolar — mensagem automática, não responda este e-mail.</p>
  </div>`;
}

/** Notifica o responsável de que uma nova cobrança está disponível para pagar. */
export async function notifyChargeCreated(to: string, data: {
  studentName?: string; amount: number; dueDate?: string | null; description?: string; schoolName?: string;
}): Promise<boolean> {
  const due = data.dueDate ? new Date(String(data.dueDate).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : null;
  const html = layout('Nova cobrança disponível', `
    <p style="font-size:14px;line-height:1.6">Olá! Uma nova cobrança${data.schoolName ? ` de <strong>${data.schoolName}</strong>` : ''} está disponível${data.studentName ? ` para <strong>${data.studentName}</strong>` : ''}.</p>
    <table style="font-size:14px;width:100%;margin:16px 0;border-collapse:collapse">
      ${data.description ? `<tr><td style="color:#64748B;padding:4px 0">Referente a</td><td style="text-align:right">${data.description}</td></tr>` : ''}
      <tr><td style="color:#64748B;padding:4px 0">Valor</td><td style="text-align:right;font-weight:bold">${brl(data.amount)}</td></tr>
      ${due ? `<tr><td style="color:#64748B;padding:4px 0">Vencimento</td><td style="text-align:right">${due}</td></tr>` : ''}
    </table>
    <a href="${APP_URL}/faturas" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px">Ver e pagar com PIX</a>
  `);
  return sendEmail({ to, subject: `Nova cobrança — ${brl(data.amount)}`, html });
}
