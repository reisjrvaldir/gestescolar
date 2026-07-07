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
  asaas_configured: boolean;
  onboarding: SubaccountOnboarding;
}

export const payoutService = {
  async get(): Promise<PayoutAccount> {
    const r = await api.get<{ ok: boolean; data: PayoutAccount }>('/payout');
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
