import { api } from '@/lib/api';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';

export interface PayoutAccount {
  status: string;
  pix_key: string | null;
  pix_key_type: PixKeyType | null;
  wallet_id: string | null;
}

export const payoutService = {
  async get(): Promise<PayoutAccount> {
    const r = await api.get<{ ok: boolean; data: PayoutAccount }>('/payout');
    return r.data;
  },
  async savePix(pix_key: string, pix_key_type: PixKeyType): Promise<void> {
    await api.put('/payout/pix', { pix_key, pix_key_type });
  },
};

export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  EMAIL: 'E-mail',
  PHONE: 'Telefone',
  EVP: 'Chave aleatória',
};
