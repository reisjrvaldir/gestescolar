import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Settings, Save, Check, Loader2, Upload, Image } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { settingsService, type SchoolSettings, type UpdateSchoolSettings } from '@/services/settings';
import { PlansManager } from '@/components/settings/PlansManager';
import { SubscribePanel } from '@/components/settings/SubscribePanel';
import { PixPayoutCard } from '@/components/settings/PixPayoutCard';
import { SubaccountForm } from '@/components/settings/SubaccountForm';

export function SettingsPage() {
  const [school, setSchool] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset } = useForm<UpdateSchoolSettings>();

  useEffect(() => {
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
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reset]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSave(data: UpdateSchoolSettings) {
    await settingsService.update({ ...data, logo_url: logoPreview ?? undefined });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading || !school) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const statusTone = school.subscription_status === 'active' ? 'success'
    : school.subscription_status === 'trialing' ? 'warning' : 'danger';
  const statusLabel = school.subscription_status === 'active' ? 'Ativa'
    : school.subscription_status === 'trialing' ? 'Trial' : school.subscription_status;

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Dados cadastrais e informações da escola."
        actions={
          <button className="btn-primary" form="settings-form" type="submit">
            {saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Salvo' : 'Salvar'}
          </button>
        }
      />

      <div className="mb-6">
        <PlansManager />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form id="settings-form" className="card space-y-4 p-5 lg:col-span-2" onSubmit={handleSubmit(onSave)}>
          <div>
            <label className="label">Logo da escola</label>
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-canvas cursor-pointer hover:border-primary"
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
              </div>
            </div>
          </div>
          <div>
            <label className="label">Nome da escola</label>
            <input className="input" {...register('name')} />
          </div>
          <div>
            <label className="label">Razão social</label>
            <input className="input" {...register('legal_name')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">CNPJ</label>
              <input className="input" placeholder="00.000.000/0001-00" {...register('cnpj')} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" placeholder="(00) 00000-0000" {...register('phone')} />
            </div>
          </div>
          <div>
            <label className="label">E-mail da escola</label>
            <input type="email" className="input" {...register('email')} />
          </div>
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
