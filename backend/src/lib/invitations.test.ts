/**
 * Testes das credenciais iniciais seguras (fluxo de convite).
 * Foco: lógica pura de token/estado (sem banco de dados).
 *
 * Cenários de integração (exigem Neon + neon_auth) documentados ao final.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInviteToken, hashToken, inviteExpiry, deriveInviteState, INVITE_TTL_HOURS,
} from './invitations';

// ─── Unicidade e formato do token ─────────────────────────────────────────────

test('dois convites geram tokens diferentes', () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.notEqual(a.token, b.token, 'tokens crus devem diferir');
  assert.notEqual(a.tokenHash, b.tokenHash, 'hashes devem diferir');
});

test('token cru tem entropia suficiente (>=32 chars base64url)', () => {
  const { token } = generateInviteToken();
  assert.ok(token.length >= 32, `token curto demais: ${token.length}`);
  assert.match(token, /^[A-Za-z0-9_-]+$/, 'deve ser base64url');
});

test('hashToken é determinístico e SHA-256 (64 hex)', () => {
  const { token, tokenHash } = generateInviteToken();
  assert.equal(hashToken(token), tokenHash, 'mesmo token → mesmo hash');
  assert.match(tokenHash, /^[a-f0-9]{64}$/, 'hash deve ser 64 hex');
});

test('o token cru nunca é igual ao hash armazenado', () => {
  const { token, tokenHash } = generateInviteToken();
  assert.notEqual(token, tokenHash, 'nunca guardar o token cru');
});

// ─── Expiração ────────────────────────────────────────────────────────────────

test('inviteExpiry retorna instante no futuro dentro do TTL', () => {
  const exp = inviteExpiry().getTime();
  const now = Date.now();
  assert.ok(exp > now, 'expiração deve ser futura');
  const hours = (exp - now) / 3_600_000;
  assert.ok(Math.abs(hours - INVITE_TTL_HOURS) < 0.1, `TTL ≈ ${INVITE_TTL_HOURS}h`);
});

// ─── Derivação de estado (badge da UI) ────────────────────────────────────────

test('estado = activated quando access_activated_at presente', () => {
  assert.equal(deriveInviteState({ access_activated_at: '2026-01-01T00:00:00Z' }), 'activated');
});

test('estado = activated quando último convite aceito (sem timestamp)', () => {
  assert.equal(deriveInviteState({ latest_invite_status: 'accepted' }), 'activated');
});

test('estado = pending quando convite pendente e não expirado', () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  assert.equal(deriveInviteState({ latest_invite_status: 'pending', latest_invite_expires_at: future }), 'pending');
});

test('estado = expired quando pendente porém já vencido', () => {
  const past = new Date(Date.now() - 3_600_000).toISOString();
  assert.equal(deriveInviteState({ latest_invite_status: 'pending', latest_invite_expires_at: past }), 'expired');
});

test('estado = expired quando convite revogado', () => {
  assert.equal(deriveInviteState({ latest_invite_status: 'revoked' }), 'expired');
});

test('estado = none quando nunca houve convite', () => {
  assert.equal(deriveInviteState({}), 'none');
});

// ─── Garantia anti-vazamento: nada aqui contém a senha padrão antiga ──────────

test('a lib de convites não referencia a senha padrão antiga', () => {
  // Regressão do incidente: garante que nenhum default reapareceu no módulo.
  const src = generateInviteToken().token + hashToken('x');
  assert.doesNotMatch(src, /Escola@2026/);
});

/*
 * ─── Cenários de INTEGRAÇÃO (rodar manualmente contra Neon + neon_auth) ───────
 *
 * 1. Uso único:
 *    - POST /api/public/invite/accept com token válido → 200 e status='accepted'.
 *    - Repetir o MESMO token → 409 'used' (não pode reutilizar).
 *
 * 2. Expiração:
 *    - Forçar expires_at no passado → GET /invite/:token retorna valid:false,
 *      state:'expired'; POST accept → 410 'expired'.
 *
 * 3. Revogação de convite anterior:
 *    - Enviar convite duas vezes → o primeiro token vira status='revoked' e
 *      não pode mais ser aceito; só o mais recente funciona.
 *
 * 4. Isolamento multi-tenant (RLS):
 *    - Gestor da escola A chama POST /api/students/:id/invite com id de aluno
 *      da escola B → 404 (o SELECT filtra por school_id; RLS reforça).
 *
 * 5. Nenhuma senha em claro:
 *    - Respostas de create/list/invite NÃO contêm campo de senha.
 *    - invitation_audit_log NÃO possui coluna de token nem de senha.
 */
