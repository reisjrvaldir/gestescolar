import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Settings, Save, Check, Loader2, Upload, Image, Percent, AlertTriangle } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { settingsService, type SchoolSettings } from '@/services/settings';
import { PlansManager } from '@/components/settings/PlansManager';
import { ModulesManager } from '@/components/settings/ModulesManager';
import { SubscribePanel } from '@/components/settings/SubscribePanel';
import { PixPayoutCard } from '@/components/settings/PixPayoutCard';
import { SubaccountForm } from '@/components/settings/SubaccountForm';
import { applyServerErrors } from '@/hooks/useFormErrors';

// Só neste formulário (que sempre envia tudo de uma vez, não é update
// parcial): nome, razão social e CNPJ obrigatórios — são os mesmos três
// campos que a AuthGate exige antes de liberar o sistema pro gestor,
// porque carimbam todo documento oficial gerado (declaração, histórico
// etc). O schema compartilhado (shared/schemas.ts) continua com esses
// campos opcionais — outras chamadas ao PUT /settings podem enviar só
// parte dos campos.
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome da escola',
  legal_name: 'Razão social',
  cnpj: 'CNPJ',
  email: 'E-mail',
  late_fine_pct: 'Multa por atraso',
  late_interest_pct: 'Juros de mora',
};

const settingsFormSchema = z.object({
  name: z.string({ required_error: 'Informe o nome da escola' }).min(2, 'Nome da escola muito curto'),
  legal_name: z.string({ required_error: 'Informe a razão social' }).min(2, 'Razão social muito curta'),
  cnpj: z.string({ required_error: 'Informe o CNPJ' }).min(14, 'CNPJ inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  // Campo numérico HTML: quando fica vazio, `valueAsNumber` devolve NaN (não
  // undefined), e o Zod rejeita NaN. Como esses dois campos nunca tiveram
  // erro exibido na tela, isso travava o "Salvar" sem nenhum aviso — o
  // usuário limpava/digitava vírgula no campo e o clique parecia não fazer
  // nada. `setValueAs` normaliza vazio para undefined antes da validação.
  late_fine_pct: z.number({ invalid_type_error: 'Percentual inválido' }).min(0, 'Não pode ser negativo').max(100, 'Máximo 100%').optional(),
  late_interest_pct: z.number({ invalid_type_error: 'Percentual inválido' }).min(0, 'Não pode ser negativo').max(100, 'Máximo 100%').optional(),
});
type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const MAX_LOGO_BYTES = 500 * 1024;

export function SettingsPage() {
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register, handleSubmit, reset, setError: setFieldError,
    formState: { errors },
  } = useForm<SettingsFormValues>({ resolver: zodResolver(settingsFormSchema) });

  function loadSettings() {
    setLoading(true);
    setError(null);
    settingsService.get()
      .then((data) => {
        setSchool(data);
        setLogoPreview(data.logo_url ?? null);
        reset({
          name: data.name,
          legal_name: data.legal_name ?? '',
          cnpj: data.cnpj ?? '',
          email: data.email ?? '',
          phone: data.phone ?? '',
          late_fine_pct: data.late_fine_pct ?? 0,
          late_interest_pct: data.late_interest_pct ?? 0,
        });
      })
      .catch((e: any) => setError(e?.message ?? 'Não foi possível carregar as configurações.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadSettings(); }, []);

  // Rolagem para âncora (ex.: /app/settings#subconta, vindo do checklist de
  // onboarding). A rolagem nativa do browser não serve aqui: enquanto o fetch
  // não termina a página só renderiza o loader, então o elemento alvo ainda
  // não existe quando a navegação acontece. getElementById em vez de
  // querySelector porque o hash vem da URL e um valor malformado (#123) faria
  // o seletor lançar.
  const { hash } = useLocation();
  useEffect(() => {
    if (loading || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loading, hash]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Imagem muito grande (${(file.size / 1024).toFixed(0)}KB). Máximo: 500KB.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.onerror = () => setLogoError('Não foi possível ler o arquivo. Tente outra imagem.');
    reader.readAsDataURL(file);
  }

  async function onSave(data: SettingsFormValues) {
    setSaveError(null);
    if (!logoPreview) {
      setLogoError('Envie a logo da escola.');
      return;
    }
    try {
      await settingsService.update({ ...data, logo_url: logoPreview });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      if (!applyServerErrors(e, setFieldError)) {
        setSaveError(e?.message ?? 'Não foi possível salvar as configurações.');
      }
    }
  }

  // Lista consolidada de tudo que falta — mostrada abaixo do formulário
  // quando o submit é bloqueado por validação (campo ausente/inválido).
  // Genérica sobre `errors` (em vez de enumerar campo a campo) para que um
  // campo novo — ou um campo sem exibição própria de erro, como aconteceu
  // com multa/juros — nunca mais trave o "Salvar" sem nenhum aviso visível.
  const missingFields = [
    ...Object.keys(errors).map((k) => FIELD_LABELS[k] ?? k),
    logoError && 'Logo da escola',
  ].filter(Boolean) as string[];

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }
  if (error || !school) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <p className="text-sm text-danger">{error ?? 'Não foi possível carregar as configurações.'}</p>
        <button className="btn-outline mt-4 inline-flex items-center gap-2" onClick={loadSettings}>
          <Loader2 size={15} /> Tentar novamente
        </button>
      </div>
    );
  }

  const statusTone = school.subscription_status === 'active' ? 'success'
    : school.subscription_status === 'trialing' ? 'warning' : 'danger';
  const statusLabel = school.subscription_status === 'active' ? 'Ativa'
    : school.subscription_status === 'trialing' ? 'Trial' : school.subscription_status;

  return (
    <>
      <PageHero
        title="Configurações"
        subtitle="Dados cadastrais e informações da escola."
        icon={Settings}
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
            form="settings-form"
            type="submit"
          >
            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Salvo' : 'Salvar'}
          </button>
        }
      />

      <div className="mb-6">
        <PlansManager />
      </div>

      <div className="mb-6">
        <ModulesManager />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form id="settings-form" className="card space-y-4 p-5 lg:col-span-2" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="label">Logo da escola *</label>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-canvas cursor-pointer hover:border-primary ${
                  logoError ? 'border-danger' : 'border-border'
                }`}
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <Image size={28} className="text-ink-subtle" />
                )}
              </div>
              <div>
                <button type="button" className="btn-outline text-xs" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Enviar logo
                </button>
                <p className="mt-1 text-xs text-ink-muted">PNG, JPG ou SVG. Máx 500KB.</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                {logoError && <p className="mt-1 text-xs text-danger">{logoError}</p>}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Nome da escola *</label>
            <input className={`input ${errors.name ? 'border-danger' : ''}`} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Razão social *</label>
            <input className={`input ${errors.legal_name ? 'border-danger' : ''}`} {...register('legal_name')} />
            {errors.legal_name && <p className="mt-1 text-xs text-danger">{errors.legal_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">CNPJ *</label>
              <input
                className={`input ${errors.cnpj ? 'border-danger' : ''}`}
                placeholder="00.000.000/0001-00"
                {...register('cnpj')}
              />
              {errors.cnpj && <p className="mt-1 text-xs text-danger">{errors.cnpj.message}</p>}
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" placeholder="(00) 00000-0000" {...register('phone')} />
            </div>
          </div>
          <div>
            <label className="label">E-mail da escola</label>
            <input type="email" className={`input ${errors.email ? 'border-danger' : ''}`} {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          {/* Multa e juros por atraso */}
          <div className="border-t border-border pt-4">
            <div className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
              <Percent size={15} className="text-primary" /> Multa e juros por atraso
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              Aplicados automaticamente às cobranças pagas após o vencimento. Deixe 0 para não cobrar.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Multa (% único)</label>
                <div className="relative">
                  <input
                    type="number" step="0.01" min="0" max="100" inputMode="decimal"
                    className={`input pr-8 ${errors.late_fine_pct ? 'border-danger' : ''}`} placeholder="Ex.: 2"
                    {...register('late_fine_pct', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-subtle">%</span>
                </div>
                {errors.late_fine_pct
                  ? <p className="mt-1 text-xs text-danger">{errors.late_fine_pct.message}</p>
                  : <p className="mt-1 text-[11px] text-ink-subtle">Cobrada uma vez sobre o valor em atraso.</p>}
              </div>
              <div>
                <label className="label">Juros de mora (% ao mês)</label>
                <div className="relative">
                  <input
                    type="number" step="0.01" min="0" max="100" inputMode="decimal"
                    className={`input pr-8 ${errors.late_interest_pct ? 'border-danger' : ''}`} placeholder="Ex.: 1"
                    {...register('late_interest_pct', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-subtle">%</span>
                </div>
                {errors.late_interest_pct
                  ? <p className="mt-1 text-xs text-danger">{errors.late_interest_pct.message}</p>
                  : <p className="mt-1 text-[11px] text-ink-subtle">Proporcional aos dias de atraso (≈ {'{'}mês{'}'}/30 ao dia).</p>}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              Padrão comum no Brasil: multa 2% + juros 1% ao mês. As taxas valem para novas cobranças geradas após salvar.
            </p>
          </div>

          {/* Erro consolidado — some sozinho quando o campo é corrigido, já que
              `missingFields` é recalculado a cada render a partir do formState. */}
          {missingFields.length > 0 && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Preencha os campos obrigatórios antes de salvar:</p>
                <ul className="mt-0.5 list-inside list-disc">
                  {missingFields.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            </div>
          )}
          {saveError && (
            <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{saveError}</div>
          )}
        </form>

        <div className="space-y-6">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Settings size={16} className="text-primary" /> Status da conta
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Status</span>
              <StatusBadge tone={school.status === 'active' ? 'success' : 'danger'}>
                {school.status === 'active' ? 'Ativa' : school.status}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Assinatura</span>
              <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
            </div>
            {school.trial_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Trial expira em</span>
                <span className="font-medium text-ink">{new Date(school.trial_ends_at).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>

          {school.subscription_status !== 'active' && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Assinar plano</p>
              <SubscribePanel />
            </div>
          )}
        </div>
        <PixPayoutCard active={school.subscription_status === 'active'} />
        <SubaccountForm active={school.subscription_status === 'active'} />
        </div>
      </div>
    </>
  );
}
