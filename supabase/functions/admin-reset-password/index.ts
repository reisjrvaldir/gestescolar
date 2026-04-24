// =============================================================================
//  Edge Function: admin-reset-password
//  Permite que um Super Admin redefina diretamente a senha de qualquer usuario
//  (gestor, professor, pai, etc.) sem depender do fluxo de e-mail do Supabase.
//
//  Seguranca:
//   - Exige Authorization: Bearer <jwt do super admin> no header.
//   - Valida que o JWT pertence a um usuario presente em public.super_users.
//   - Usa SUPABASE_SERVICE_ROLE_KEY (nunca exposta ao frontend) para invocar
//     supabase.auth.admin.updateUserById().
//
//  Deploy:
//     supabase functions deploy admin-reset-password --no-verify-jwt
//     supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
//
//  Body esperado (JSON):
//     { "userEmail": "gestor@escola.com", "newPassword": "SenhaForte!1" }
//   OU { "userId":    "<auth.users.id>",  "newPassword": "SenhaForte!1" }
// =============================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function validatePassword(p: string): string | null {
  if (!p || p.length < 8)        return 'Senha deve ter no mínimo 8 caracteres.';
  if (!/[A-Z]/.test(p))          return 'Senha deve conter ao menos uma letra maiúscula.';
  if (!/[a-z]/.test(p))          return 'Senha deve conter ao menos uma letra minúscula.';
  if (!/[0-9]/.test(p))          return 'Senha deve conter ao menos um número.';
  if (!/[^A-Za-z0-9]/.test(p))   return 'Senha deve conter ao menos um símbolo.';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  try {
    // ---- 1. Autenticacao do chamador ----
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwt) return json(401, { error: 'Missing Authorization header.' });

    // Cliente "anon" so para validar o JWT do chamador
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) return json(401, { error: 'Invalid token.' });
    const callerEmail = (callerData.user.email || '').toLowerCase();

    // ---- 2. Cliente admin (service role) ----
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---- 3. Validar que o chamador eh super admin ----
    const { data: suList, error: suErr } = await admin
      .from('super_users')
      .select('id, email')
      .eq('email', callerEmail)
      .limit(1);
    if (suErr) return json(500, { error: 'Erro ao validar super admin: ' + suErr.message });
    if (!suList || suList.length === 0) {
      return json(403, { error: 'Apenas super administradores podem usar este endpoint.' });
    }

    // ---- 4. Validar payload ----
    const body = await req.json().catch(() => ({}));
    const { userId, userEmail, newPassword } = body as {
      userId?: string; userEmail?: string; newPassword?: string;
    };

    if (!userId && !userEmail) return json(400, { error: 'Informe userId ou userEmail.' });
    const pwdErr = validatePassword(newPassword || '');
    if (pwdErr) return json(400, { error: pwdErr });

    // ---- 5. Resolver userId se veio email ----
    let targetId = userId;
    if (!targetId && userEmail) {
      // listUsers paginado — para projetos pequenos basta o primeiro page
      const { data: usersPage, error: lstErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (lstErr) return json(500, { error: 'Falha ao listar usuários: ' + lstErr.message });
      const found = usersPage.users.find(u => (u.email || '').toLowerCase() === userEmail.toLowerCase());
      if (!found) return json(404, { error: 'Usuário não encontrado em auth.users.' });
      targetId = found.id;
    }

    // ---- 6. Atualizar senha ----
    const { error: updErr } = await admin.auth.admin.updateUserById(targetId!, {
      password: newPassword!,
    });
    if (updErr) return json(500, { error: 'Falha ao atualizar senha: ' + updErr.message });

    // ---- 7. Marcar needsPasswordChange para forcar troca no proximo login ----
    await admin.from('users').update({ needs_password_change: true }).eq('auth_id', targetId!);

    return json(200, { ok: true, userId: targetId });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
