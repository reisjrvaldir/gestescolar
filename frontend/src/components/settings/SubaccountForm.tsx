import { useEffect, useState } from 'react';
import { Save, Check, Loader2, Landmark, Lock, Rocket, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { payoutService, COMPANY_TYPE_LABELS, type CompanyType, type SubaccountOnboarding } from '@/services/payout';
import { SubaccountDocuments } from './SubaccountDocuments';

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
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('not_started');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    payoutService.get()
      .then((d) => {
        setForm({ ...EMPTY, ...d.onboarding });
        setWalletId(d.wallet_id);
        setAccountId(d.account_id);
        setAccountEmail(d.account_email ?? d.onboarding.email ?? null);
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
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-success-soft p-3 text-xs text-ink">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
            <div className="min-w-0">
              <p className="font-semibold">Subconta ativa</p>
              <p className="text-ink-muted">Status: {status}</p>
            </div>
          </div>

          {/* Dados da conta ASAAS da escola (para acesso direto ao ASAAS). */}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-subtle">Sua conta ASAAS</p>
            <div className="space-y-1.5 text-xs">
              <Row label="E-mail de acesso" value={accountEmail ?? '—'} copy />
              <Row label="ID da conta" value={accountId ?? '—'} copy />
              <Row label="Wallet ID (split)" value={walletId} copy />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-primary">Como acessar minha conta ASAAS →</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-muted">
                <li>Acesse <a href="https://www.asaas.com/login" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">asaas.com/login</a></li>
                <li>Clique em <strong>“Esqueci minha senha”</strong> e informe o e-mail acima ({accountEmail ?? 'seu e-mail cadastrado'})</li>
                <li>Você receberá um e-mail do ASAAS para definir sua senha de acesso</li>
                <li>Defina a senha e entre — você verá o saldo, extrato e movimentações da sua conta</li>
                <li>É a mesma conta que recebe os repasses das mensalidades via split</li>
              </ol>
              <p className="mt-2 rounded bg-canvas p-2 text-[11px] text-ink-subtle">
                Por segurança, o GestEscolar não guarda nem exibe a senha da sua conta ASAAS — o acesso é sempre definido por você direto no ASAAS.
              </p>
            </details>
          </div>

          <SubaccountDocuments />
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

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate font-mono text-ink">{value}</span>
        {copy && value !== '—' && (
          <button
            type="button"
            className="shrink-0 rounded p-1 text-ink-subtle hover:bg-canvas hover:text-ink"
            title="Copiar"
            onClick={() => { navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }}
          >
            {done ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
        )}
      </span>
    </div>
  );
}
