import { useEffect, useState } from 'react';
import { Save, Check, Loader2, Landmark, Lock, Rocket, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { payoutService, COMPANY_TYPE_LABELS, type CompanyType, type SubaccountOnboarding } from '@/services/payout';

const EMPTY: SubaccountOnboarding = {
  legal_name: '', cnpj: '', responsible_name: '', responsible_cpf: '', email: '', phone: '',
  income_value: null, company_type: 'LIMITED', birth_date: '',
  address: '', address_number: '', complement: '', province: '', postal_code: '',
};

/** Formulário de abertura de subconta ASAAS (split). Requer plano ativo. */
export function SubaccountForm({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<SubaccountOnboarding>(EMPTY);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('not_started');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    payoutService.get()
      .then((d) => {
        setForm({ ...EMPTY, ...d.onboarding });
        setWalletId(d.wallet_id);
        setStatus(d.status);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof SubaccountOnboarding>(k: K, v: SubaccountOnboarding[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function saveData() {
    setSaving(true); setError(null);
    try {
      await payoutService.saveOnboarding({ ...form, income_value: Number(form.income_value) || 0 });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  async function openSubaccount() {
    setOpening(true); setError(null); setOkMsg(null);
    try {
      await payoutService.saveOnboarding({ ...form, income_value: Number(form.income_value) || 0 });
      const r = await payoutService.createSubaccount();
      setWalletId(r.wallet_id ?? null);
      setStatus(r.status ?? 'pending_documents');
      setOkMsg('Subconta criada! Agora envie os documentos para validação.');
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao abrir a subconta');
    } finally { setOpening(false); }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
        <Landmark size={16} className="text-primary" /> Conta de recebimento (subconta)
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Abra sua subconta para receber os repasses automaticamente via split.
      </p>

      {!active ? (
        <div className="flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs text-ink-muted">
          <Lock size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
          <span>Disponível apenas com um <strong className="text-ink">plano ativo</strong>.</span>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-ink-muted"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
      ) : walletId ? (
        <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-xs text-ink">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="font-semibold">Subconta ativa</p>
            <p className="text-ink-muted">Wallet: <span className="font-mono">{walletId}</span></p>
            <p className="text-ink-muted">Status: {status}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Razão social" value={form.legal_name} onChange={(v) => set('legal_name', v)} />
            <Field label="CNPJ" value={form.cnpj} onChange={(v) => set('cnpj', v)} placeholder="00.000.000/0001-00" />
            <Field label="Responsável" value={form.responsible_name} onChange={(v) => set('responsible_name', v)} />
            <Field label="CPF do responsável" value={form.responsible_cpf} onChange={(v) => set('responsible_cpf', v)} />
            <Field label="E-mail" value={form.email} onChange={(v) => set('email', v)} type="email" />
            <Field label="Telefone / celular" value={form.phone} onChange={(v) => set('phone', v)} placeholder="(00) 00000-0000" />
            <div>
              <label className="label">Tipo de empresa</label>
              <select className="input" value={form.company_type} onChange={(e) => set('company_type', e.target.value as CompanyType)}>
                {(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((t) => (
                  <option key={t} value={t}>{COMPANY_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <Field label="Faturamento mensal (R$)" value={form.income_value == null ? '' : String(form.income_value)} onChange={(v) => set('income_value', v === '' ? null : Number(v))} type="number" />
            <Field label="CEP" value={form.postal_code} onChange={(v) => set('postal_code', v)} placeholder="00000-000" />
            <Field label="Endereço" value={form.address} onChange={(v) => set('address', v)} />
            <Field label="Número" value={form.address_number} onChange={(v) => set('address_number', v)} />
            <Field label="Complemento" value={form.complement} onChange={(v) => set('complement', v)} />
            <Field label="Bairro" value={form.province} onChange={(v) => set('province', v)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
          {okMsg && (
            <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-xs text-ink">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /> <span>{okMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-outline flex-1" onClick={saveData} disabled={saving || opening}>
              {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Salvo' : saving ? 'Salvando…' : 'Salvar dados'}
            </button>
            <button type="button" className="btn-primary flex-1" onClick={openSubaccount} disabled={opening || saving}>
              {opening ? <Loader2 className="animate-spin" size={16} /> : <Rocket size={16} />} {opening ? 'Abrindo…' : 'Abrir subconta'}
            </button>
          </div>
          <p className="text-xs text-ink-subtle">Após abrir a subconta, você poderá enviar os documentos para validação.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
