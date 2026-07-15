import { api } from '@/lib/api';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
export type CompanyType = 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';

export interface SubaccountOnboarding {
  legal_name: string;
  cnpj: string;
  responsible_name: string;
  responsible_cpf: string;
  email: string;
  phone: string;
  income_value: number | null;
  company_type: CompanyType;
  birth_date: string;
  address: string;
  address_number: string;
  complement: string;
  province: string;
  postal_code: string;
}

export interface PayoutAccount {
  status: string;
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  wallet_id: string | null;
  account_id: string | null;
  account_email: string | null;
  asaas_configured: boolean;
  onboarding: SubaccountOnboarding;
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: 'requested' | 'processing' | 'paid' | 'failed' | 'cancelled';
  requested_at: string;
  paid_at?: string | null;
  failed_reason?: string | null;
}

export interface WithdrawalsInfo {
  available: number;
  pending: number;
  withdrawn: number;
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  history: Withdrawal[];
}

export const payoutService = {
  async get(): Promise<PayoutAccount> {
    const r = await api.get<{ ok: boolean; data: PayoutAccount }>('/payout');
    return r.data;
  },
  async withdrawals(): Promise<WithdrawalsInfo> {
    const r = await api.get<{ ok: boolean; data: WithdrawalsInfo }>('/payout/withdrawals');
    return r.data;
  },
  async withdraw(amount: number): Promise<{ withdrawal_id: string; status: string; amount: number }> {
    const r = await api.post<{ ok: boolean; data: { withdrawal_id: string; status: string; amount: number } }>('/payout/withdraw', { amount });
    return r.data;
  },
  async savePix(pix_key: string, pix_key_type: PixKeyType): Promise<void> {
    await api.put('/payout/pix', { pix_key, pix_key_type });
  },
  async saveOnboarding(data: Omit<SubaccountOnboarding, 'income_value'> & { income_value: number }): Promise<void> {
    await api.put('/payout/onboarding', data);
  },
  async createSubaccount(): Promise<{ ok: boolean; wallet_id?: string; status?: string }> {
    return api.post('/payout/subaccount');
  },
  async listDocuments(): Promise<any> {
    const r = await api.get<{ ok: boolean; data: any }>('/payout/documents');
    return r.data;
  },
  async uploadDocument(groupId: string, type: string, filename: string, mime: string, file_data: string): Promise<void> {
    await api.post(`/payout/documents/${groupId}`, { type, filename, mime, file_data });
  },
};

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  EVP: 'Chave aleatória',
};

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  MEI: 'MEI',
  LIMITED: 'Ltda / Sociedade',
  INDIVIDUAL: 'Empresário individual',
  ASSOCIATION: 'Associação',
};
