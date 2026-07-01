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

/**
 * Senha inicial que o usuário digita: os 6 primeiros dígitos do CPF.
 * Login é feito pela matrícula. Troca é obrigatória no 1º acesso
 * (password_change_required = true).
 */
export function initialPassword(cpf: string): string {
  return cpfDigits(cpf).slice(0, 6);
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
