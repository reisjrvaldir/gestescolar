/**
 * Schemas Zod compartilhados entre frontend e backend.
 * Importação no backend: caminho relativo  ../../../shared/schemas
 * Importação no frontend: alias @shared/schemas  (configurado no vite.config.ts)
 *
 * REGRA: este arquivo só pode importar 'zod'. Nenhuma dependência de ambiente
 * (Node, browser, Express, React) pode ser adicionada aqui.
 */

import { z } from 'zod';

// ─── Primitivos reutilizáveis ─────────────────────────────────────────────────

function cpfDigits(s: string) {
  return s.replace(/\D/g, '');
}

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

/** CPF: aceita formatado (000.000.000-00) ou só dígitos. Transforma para 11 dígitos. */
export const cpfSchema = z
  .string({ required_error: 'CPF obrigatório' })
  .min(1, 'CPF obrigatório')
  .transform(cpfDigits)
  .refine(isValidCpf, 'CPF inválido');

/** E-mail com mensagem em PT-BR. */
export const emailSchema = z
  .string({ required_error: 'E-mail obrigatório' })
  .min(1, 'E-mail obrigatório')
  .email('E-mail inválido')
  .max(254, 'E-mail muito longo');

/** Telefone: aceita (00) 00000-0000 ou só dígitos. Transforma para 10–11 dígitos. */
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length === 0 || (s.length >= 10 && s.length <= 11), 'Telefone inválido (DDD + número)');

/** Telefone obrigatório. */
export const phoneRequiredSchema = z
  .string({ required_error: 'Telefone obrigatório' })
  .min(1, 'Telefone obrigatório')
  .transform((s) => s.replace(/\D/g, ''))
  .refine((s) => s.length >= 10 && s.length <= 11, 'Telefone inválido (DDD + número)');

/** Data no formato YYYY-MM-DD. */
export const dateSchema = z
  .string({ required_error: 'Data obrigatória' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)');

/** Data opcional — aceita string vazia ou undefined. */
export const optionalDateSchema = z
  .string()
  .optional()
  .refine(
    (s) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s),
    'Data inválida (use AAAA-MM-DD)',
  );

// ─── Funcionários ─────────────────────────────────────────────────────────────

export const staffCreateSchema = z.object({
  name:              z.string({ required_error: 'Nome obrigatório' }).min(2, 'Nome muito curto (mín. 2 caracteres)').max(120, 'Nome muito longo'),
  cpf:               cpfSchema,
  email:             emailSchema,
  phone:             phoneSchema.optional(),
  role_type:         z.enum(['school_admin', 'financial', 'teacher', 'coordinator'], { required_error: 'Perfil obrigatório', message: 'Perfil inválido' }),
  subject_teaches:   z.string().max(100).optional(),
  position:          z.string().max(100).optional(),
  admission_date:    optionalDateSchema,
  contract_type:     z.enum(['clt', 'pj', 'estagio', 'temporario']).optional(),
  weekly_hours:      z.number().min(0).max(80).optional(),
  timeclock_enabled: z.boolean().optional(),
});

export const staffUpdateSchema = staffCreateSchema.partial().extend({
  name: z.string().min(2, 'Nome muito curto (mín. 2 caracteres)').max(120),
});

export type StaffCreateInput = z.input<typeof staffCreateSchema>;
export type StaffCreateOutput = z.output<typeof staffCreateSchema>;
export type StaffUpdateOutput = z.output<typeof staffUpdateSchema>;

// ─── Alunos ───────────────────────────────────────────────────────────────────

export const guardianSchema = z.object({
  name:   z.string({ required_error: 'Nome do responsável obrigatório' }).min(2, 'Nome do responsável obrigatório').max(120),
  email:  emailSchema,
  cpf:    cpfSchema,
  phone:  phoneSchema.optional(),
  phone2: phoneSchema.optional(),
});

export const studentCreateSchema = z.object({
  name:                      z.string({ required_error: 'Nome obrigatório' }).min(2, 'Nome muito curto').max(120),
  cpf:                       cpfSchema,
  rg:                        z.string().max(20).optional(),
  birth_date:                dateSchema,
  blood_type:                z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  naturality:                z.string().max(100).optional(),
  photo_url:                 z.string().optional(),
  father_name:               z.string().min(2, 'Nome do pai obrigatório').max(120).optional(),
  mother_name:               z.string().min(2, 'Nome da mãe obrigatório').max(120).optional(),
  class_id:                  z.string().uuid('Turma inválida').optional(),
  plan_id:                   z.string({ required_error: 'Selecione um plano' }).uuid('Plano inválido'),
  discount_percentage:       z.number().min(0).max(100).optional(),
  enrollment_payment_method: z.enum(['cash', 'pix', 'card']).optional(),
  first_due:                 z.enum(['30', '05', '10', '15']).optional(),
  guardian:                  guardianSchema,
});

export const studentUpdateSchema = studentCreateSchema.omit({ guardian: true }).partial().extend({
  name: z.string().min(2, 'Nome muito curto').max(120).optional(),
});

export type StudentCreateOutput = z.output<typeof studentCreateSchema>;
export type StudentUpdateOutput = z.output<typeof studentUpdateSchema>;

// ─── Despesas ─────────────────────────────────────────────────────────────────

const baseExpenseSchema = z.object({
  supplier_name: z.string({ required_error: 'Informe o fornecedor' }).min(1, 'Informe o fornecedor').max(200),
  description:   z.string().max(500).optional(),
  category:      z.string().max(100).optional(),
  amount:        z.number({ required_error: 'Valor obrigatório', invalid_type_error: 'Valor inválido' }).positive('Valor deve ser positivo'),
  due_date:      optionalDateSchema,
});

export const expenseCreateSchema = baseExpenseSchema.extend({
  installments:      z.number().int().min(1).max(60).optional(),
  installment_mode:  z.enum(['total', 'each']).optional(),
});

export const expenseEditSchema = baseExpenseSchema.partial();

export type ExpenseCreateOutput = z.output<typeof expenseCreateSchema>;
export type ExpenseEditOutput = z.output<typeof expenseEditSchema>;

// ─── Cobranças avulsas ────────────────────────────────────────────────────────

export const adhocChargeSchema = z.object({
  title:       z.string({ required_error: 'Título obrigatório' }).min(1, 'Título obrigatório').max(200),
  description: z.string().max(500).optional(),
  amount:      z.number({ required_error: 'Valor obrigatório', invalid_type_error: 'Valor inválido' }).positive('Valor deve ser positivo').min(0.01, 'Mínimo R$0,01'),
  due_date:    dateSchema,
  scope:       z.enum(['all', 'class'], { required_error: 'Selecione o escopo' }),
  class_id:    z.string().uuid('Turma inválida').optional(),
});

export type AdhocChargeOutput = z.output<typeof adhocChargeSchema>;

// ─── Configurações da escola ──────────────────────────────────────────────────

// Percentual de 0 a 100, com até 2 casas. Aceita number ou string ("2,5"/"2.5").
const pctSchema = z.coerce
  .number({ invalid_type_error: 'Informe um percentual válido' })
  .min(0, 'Não pode ser negativo')
  .max(100, 'Máximo de 100%')
  .optional();

export const schoolSettingsSchema = z.object({
  name:        z.string().min(2, 'Nome da escola muito curto').max(200).optional(),
  legal_name:  z.string().max(200).optional(),
  cnpj:        z.string().max(20).optional(),
  email:       z.string().email('E-mail inválido').max(254).optional().or(z.literal('')),
  phone:       phoneSchema.optional(),
  logo_url:    z.string().max(1000).optional(),
  // Multa (% fixo) e juros de mora (% ao mês) aplicados a pagamentos em atraso.
  late_fine_pct:     pctSchema,
  late_interest_pct: pctSchema,
});

export type SchoolSettingsOutput = z.output<typeof schoolSettingsSchema>;

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  school_name:     z.string({ required_error: 'Informe o nome da escola' }).min(2, 'Nome da escola muito curto').max(200),
  admin_name:      z.string({ required_error: 'Informe seu nome' }).min(2, 'Nome muito curto').max(120),
  cnpj:            z.string().max(20).optional(),
  phone:           phoneSchema.optional(),
  terms_version:   z.string().optional(),
  privacy_version: z.string().optional(),
});

export type OnboardingOutput = z.output<typeof onboardingSchema>;

// ─── Nova escola (superadmin) ─────────────────────────────────────────────────
// Substitui o auto-cadastro: só o superadmin abre escola, criando junto a conta
// do gestor. Decidido em 07/08/2026 ao reiniciar a operação.

export const saasSchoolCreateSchema = z.object({
  school_name: z.string({ required_error: 'Informe o nome da escola' }).min(2, 'Nome da escola muito curto').max(200),
  admin_name:  z.string({ required_error: 'Informe o nome do gestor' }).min(2, 'Nome muito curto').max(120),
  admin_email: emailSchema,
  cnpj:        z.string().max(20).optional(),
  phone:       phoneSchema.optional(),
  plan_id:     z.string().uuid('Plano inválido').optional(),
  /** Dias de teste antes de exigir assinatura. 0 = já nasce ativa. */
  trial_days:  z.number().int().min(0).max(365).optional(),
  /** Marca a escola como piloto/teste (para analytics, quotas especiais, etc). */
  is_pilot:    z.boolean().optional().default(false),
});

export type SaasSchoolCreateInput = z.input<typeof saasSchoolCreateSchema>;
export type SaasSchoolCreateOutput = z.output<typeof saasSchoolCreateSchema>;

// ─── Lead do popup de teste controlado (landing page) ─────────────────────────

export const publicLeadSchema = z.object({
  name:        z.string({ required_error: 'Informe seu nome' }).min(2, 'Nome muito curto').max(120),
  email:       emailSchema,
  phone:       phoneSchema.optional(),
  school_name: z.string().max(200).optional(),
  message:     z.string().max(1000).optional(),
  source:      z.string().max(60).optional(),
});

export type PublicLeadInput = z.input<typeof publicLeadSchema>;
export type PublicLeadOutput = z.output<typeof publicLeadSchema>;
