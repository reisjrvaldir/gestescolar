// =============================================
//  GESTESCOLAR – EMAIL SERVICE (Resend)
//  Vercel Serverless Function
// =============================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

module.exports = async function handler(req, res) {
  // CORS
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://gestescolar.com.br';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Apenas POST permitido' });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY não configurada' });
  }

  try {
    const { action, data } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (!action) {
      return res.status(400).json({ error: 'Parâmetro "action" obrigatório' });
    }

    // ── ENVIAR EMAIL DE ACESSO (novo cadastro) ────────────────
    if (action === 'sendAccessEmail') {
      const { email, password, schoolName, gestorName } = data || {};
      if (!email || !password || !schoolName) {
        return res.status(400).json({ error: 'email, password e schoolName obrigatórios' });
      }

      const loginUrl = 'https://gestescolar.com.br/login';
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #1976d2, #1565c0); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 20px; }
    .credentials { background: #f0f7ff; border-left: 4px solid #1976d2; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .credentials p { margin: 8px 0; font-family: monospace; }
    .credentials label { font-weight: 700; color: #1976d2; }
    .button { display: inline-block; background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
    .logo { font-size: 14px; color: #1976d2; font-weight: 700; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 GestEscolar</h1>
      <p>Bem-vindo à plataforma!</p>
    </div>
    <div class="content">
      <p class="greeting">Olá ${escapeHtml(gestorName || 'Gestor')},</p>

      <p>Sua conta foi criada com sucesso na plataforma GestEscolar! 🎉</p>
      <p>A escola <strong>${escapeHtml(schoolName)}</strong> está pronta para ser gerenciada.</p>

      <div class="credentials">
        <p><label>Email de acesso:</label><br>${escapeHtml(email)}</p>
        <p><label>Senha:</label><br><code>${escapeHtml(password)}</code></p>
      </div>

      <p><strong>Recomendações:</strong></p>
      <ul>
        <li>Acesse a plataforma e <strong>altere sua senha</strong> imediatamente</li>
        <li>Explore as funcionalidades no menu da esquerda</li>
        <li>Consulte a documentação de ajuda na plataforma</li>
      </ul>

      <a href="${loginUrl}" class="button">Acessar Plataforma</a>

      <div class="footer">
        <p>Se tiver dúvidas, entre em contato com nosso suporte: <strong>suporte@gestescolar.com.br</strong></p>
        <p>&copy; ${new Date().getFullYear()} GestEscolar. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const textContent = `Olá ${gestorName || 'Gestor'},

Sua conta foi criada com sucesso na plataforma GestEscolar!

Escola: ${schoolName}

Dados de acesso:
- Email: ${email}
- Senha: ${password}

Recomendações:
- Acesse a plataforma e altere sua senha imediatamente
- Explore as funcionalidades no menu da esquerda
- Consulte a documentação de ajuda na plataforma

Link para login: ${loginUrl}

Se tiver dúvidas, entre em contato: suporte@gestescolar.com.br`;

      // Enviar via Resend
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@gestescolar.com.br',
          to: email,
          subject: `Bem-vindo ao GestEscolar! 🎓 Dados de Acesso`,
          html: htmlContent,
          text: textContent,
          replyTo: 'suporte@gestescolar.com.br',
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error('[Resend Error]', resendRes.status, resendData);
        return res.status(resendRes.status).json({
          error: resendData.message || 'Erro ao enviar email',
        });
      }

      console.log('[Email] Enviado com sucesso para', email, 'ID:', resendData.id);
      return res.status(200).json({ success: true, messageId: resendData.id });
    }

    // ── ENVIAR EMAIL DE RECUPERAÇÃO DE SENHA ────────────────
    if (action === 'sendPasswordRecoveryEmail') {
      const { email, resetLink } = data || {};
      if (!email || !resetLink) {
        return res.status(400).json({ error: 'email e resetLink obrigatórios' });
      }

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
    .header { background: linear-gradient(135deg, #1976d2, #1565c0); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .button { display: inline-block; background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
    .timer { color: #d32f2f; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 GestEscolar</h1>
      <p>Recuperação de Senha</p>
    </div>
    <div class="content">
      <p>Recebemos uma solicitação para recuperar sua senha.</p>

      <div class="warning">
        <strong>⏰ Link válido por 1 hora</strong><br>
        Se você não solicitou esta recuperação, ignore este email.
      </div>

      <p>Clique no botão abaixo para criar uma nova senha:</p>
      <a href="${resetLink}" class="button">Recuperar Senha</a>

      <p style="font-size:13px;color:#666;">Ou copie e cole este link no seu navegador:</p>
      <p style="word-break:break-all;font-size:12px;background:#f0f0f0;padding:10px;border-radius:4px;color:#666;">
        ${resetLink}
      </p>

      <div class="footer">
        <p>Se tiver dúvidas, entre em contato: <strong>suporte@gestescolar.com.br</strong></p>
        <p>&copy; ${new Date().getFullYear()} GestEscolar. Todos os direitos reservados.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

      const textContent = `Recuperação de Senha - GestEscolar

Recebemos uma solicitação para recuperar sua senha.

Link válido por 1 hora:
${resetLink}

Se você não solicitou esta recuperação, ignore este email.

Para dúvidas: suporte@gestescolar.com.br`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'suporte@gestescolar.com.br',
          to: email,
          subject: 'Recuperação de Senha - GestEscolar 🔐',
          html: htmlContent,
          text: textContent,
          replyTo: 'suporte@gestescolar.com.br',
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error('[Resend Error]', resendRes.status, resendData);
        return res.status(resendRes.status).json({
          error: resendData.message || 'Erro ao enviar email',
        });
      }

      console.log('[Email] Recovery enviado para', email);
      return res.status(200).json({ success: true, messageId: resendData.id });
    }

    return res.status(400).json({ error: 'Action desconhecida' });

  } catch (e) {
    console.error('[Email] Erro:', e.message);
    return res.status(500).json({ error: e.message || 'Erro interno' });
  }
};

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
