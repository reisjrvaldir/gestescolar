import { z } from 'zod';
import { randomBytes } from 'crypto';

const cpfDigits = (s: string) => s.replace(/\D/g, '');

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (Number(cpf[9]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return Number(cpf[10]) === d2;
}

export const cpfSchema = z
  .string()
  .transform(cpfDigits)
  .refine((v) => isValidCpf(v), 'CPF inválido');

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD');

export const optionalDateSchema = dateSchema.optional();

export function generateSecurePassword(): string {
  return randomBytes(12).toString('base64url');
}

// Alfabeto sem caracteres ambíguos (0/O, 1/l/I) — senha temporária legível
// para ser ditada/anotada e repassada ao responsável ou funcionário.
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Senha inicial ALEATÓRIA (10 caracteres) gerada no cadastro e exibida uma
 * única vez a quem cadastra, para repasse ao usuário. Substitui o esquema
 * anterior (6 dígitos do CPF), que permitia tomada de conta antes do 1º acesso.
 * Login é feito pela matrícula; troca é obrigatória no 1º acesso
 * (password_change_required = true).
 */
export function initialPassword(): string {
  const bytes = randomBytes(10);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  return out;
}

/**
 * O provedor de auth (Neon/Better Auth) exige senha com no mínimo 8 caracteres.
 * A senha de 6 dígitos é completada de forma determinística e reconstruível
 * (6 dígitos + os 2 primeiros repetidos = 8), para o login refazer o cálculo
 * a partir do que o usuário digitou. Ver mesma lógica no frontend (authClient).
 */
export function toStoredPassword(visible6: string): string {
  return visible6.length >= 8 ? visible6 : (visible6 + visible6).slice(0, 8);
}
