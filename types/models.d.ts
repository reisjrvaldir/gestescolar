/**
 * Definições de tipos compartilhados do GestEscolar SaaS
 *
 * Estes tipos são usados via JSDoc nos arquivos .js:
 *   /** @type {import('../types/models').School} *\/
 *
 * Para validação: npx tsc --noEmit
 *
 * IMPORTANTE: O sistema mistura camelCase (frontend) e snake_case (DB/Supabase).
 * Os tipos abaixo refletem ambos os formatos para evitar falsos positivos.
 */

export type SchoolStatus = 'trial' | 'active' | 'blocked' | 'inactive';
export type PlanId = 'free' | 'piloto' | 'gestao_100' | 'gestao_250' | 'gestao_unlimited' | null;
export type UserRole = 'superadmin' | 'gestor' | 'administrativo' | 'financeiro' | 'professor' | 'pai';
export type BillingCycle = 'mensal' | 'anual';
export type InvoiceStatus = 'pendente' | 'pago' | 'cancelado' | 'vencido';

/**
 * Escola - tenant principal do SaaS.
 * Aceita ambos camelCase (memória/frontend) e snake_case (Supabase DB).
 */
export interface School {
  id: string | number;
  name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  customStudentLimit?: number | null;

  // camelCase (frontend/memória)
  planId?: PlanId;
  planExpiresAt?: string | Date | null;
  planSubscriptionId?: string | null;
  planPaymentId?: string | null;
  planBillingCycle?: BillingCycle;
  schoolStatus?: SchoolStatus;
  createdAt?: string | Date;
  trialStartedAt?: string | Date | null;
  ownerId?: string;
  asaasCustomerId?: string | null;
  asaasWalletId?: string | null;

  // snake_case (Supabase DB)
  plan_id?: PlanId;
  plan_expires_at?: string | Date | null;
  plan_subscription_id?: string | null;
  plan_payment_id?: string | null;
  plan_billing_cycle?: BillingCycle;
  school_status?: SchoolStatus;
  created_at?: string | Date;
  trial_started_at?: string | Date | null;
  owner_id?: string;
  asaas_customer_id?: string | null;
  asaas_wallet_id?: string | null;
}

/**
 * Usuário autenticado - cache em localStorage (ges_session).
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  schoolId?: string | number;
  planId?: PlanId;
}

/**
 * Definição de plano (catálogo estático em Plans.defs).
 */
export interface PlanDefinition {
  id: string;
  name: string;
  price: number;
  order: number;
  desc: string;
  limits: {
    students: number;
    teachers: number;
    gestors: number;
  };
  features: string[];
  newFeatures: string[];
  highlight: boolean;
  hidden?: boolean;
}

/**
 * Fatura/cobrança gerada via Asaas.
 */
export interface Invoice {
  id: string;
  studentId?: string;
  schoolId: string | number;
  amount: number;
  dueDate: string | Date;
  status: InvoiceStatus;
  asaasPaymentId?: string;
  paidAt?: string | Date | null;
}

/**
 * Payload de webhook do Asaas.
 * Documentação: https://docs.asaas.com/docs/webhooks
 */
export interface AsaasWebhookEvent {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    status: string;
    externalReference?: string;
    subscription?: string;
    invoice?: string;
    dueDate?: string;
    paymentDate?: string;
  };
  subscription?: {
    id: string;
    customer: string;
    value: number;
    status: string;
    externalReference?: string;
  };
}
