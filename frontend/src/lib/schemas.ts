/**
 * Schemas Zod para uso exclusivo no frontend.
 * Primitivos (cpf, email, telefone, data) importados do shared.
 * Schemas de formulário achatados (sem nested guardian) para compatibilidade com RHF.
 */

import { z } from 'zod';
import {
  cpfSchema,
  emailSchema,
  phoneSchema,
  phoneRequiredSchema,
  dateSchema,
  optionalDateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  expenseCreateSchema,
  expenseEditSchema,
  adhocChargeSchema,
  schoolSettingsSchema,
  onboardingSchema,
} from '@shared/schemas';

export {
  cpfSchema,
  emailSchema,
  phoneSchema,
  phoneRequiredSchema,
  dateSchema,
  optionalDateSchema,
  staffCreateSchema,
  staffUpdateSchema,
  expenseCreateSchema,
  expenseEditSchema,
  adhocChargeSchema,
  schoolSettingsSchema,
  onboardingSchema,
};

// ─── Aluno: esquema achatado p/ formulário ────────────────────────────────────
// O backend espera guardian aninhado; aqui usamos campos planos e mapeamos em onSubmit.

export const studentFormSchema = z.object({
  name:                      z.string({ required_error: 'Nome obrigatório' }).min(2, 'Nome muito curto').max(120),
  cpf:                       cpfSchema,
  rg:                        z.string().max(20).optional(),
  birth_date:                dateSchema,
  blood_type:                z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().or(z.literal('')),
  naturality:                z.string().max(100).optional(),
  photo_url:                 z.string().optional(),
  father_name:               z.string().max(120).optional(),
  mother_name:               z.string().max(120).optional(),
  class_id:                  z.string().uuid('Turma inválida').optional().or(z.literal('')),
  plan_id:                   z.string({ required_error: 'Selecione um plano' }).uuid('Plano inválido'),
  discount_percentage:       z.number().min(0).max(100).optional(),
  enrollment_payment_method: z.enum(['cash', 'pix', 'card']).optional().or(z.literal('')),
  first_due:                 z.enum(['30', '05', '10', '15']).optional().or(z.literal('')),
  address_zip:               z.string().max(9).optional(),
  address_street:            z.string().max(200).optional(),
  address_number:            z.string().max(20).optional(),
  address_complement:        z.string().max(100).optional(),
  address_neighborhood:      z.string().max(100).optional(),
  address_city:              z.string().max(100).optional(),
  address_state:             z.string().max(2).optional(),
  // responsável
  guardian_name:   z.string({ required_error: 'Nome do responsável obrigatório' }).min(2, 'Nome do responsável obrigatório').max(120),
  guardian_email:  emailSchema,
  guardian_cpf:    cpfSchema,
  guardian_phone:  phoneSchema.optional(),
  guardian_phone2: phoneSchema.optional(),
});

export const studentEditFormSchema = studentFormSchema
  .omit({ guardian_name: true, guardian_email: true, guardian_cpf: true, guardian_phone: true, guardian_phone2: true })
  .partial()
  .extend({ name: z.string().min(2, 'Nome muito curto').max(120).optional() });

export type StudentFormValues = z.input<typeof studentFormSchema>;
export type StudentEditFormValues = z.input<typeof studentEditFormSchema>;
