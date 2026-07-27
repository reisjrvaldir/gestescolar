import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/authClient';
import { api } from '@/lib/api';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/consentVersions';
import { onboardingSchema } from '@/lib/schemas';
import type { z } from 'zod';

type OnboardingForm = z.input<typeof onboardingSchema>;

export function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<OnboardingForm>({ resolver: zodResolver(onboardingSchema) });

  const uid = useId();
  const schoolNameId = `${uid}-school-name`;
  const adminNameId = `${uid}-admin-name`;
  const cnpjId = `${uid}-cnpj`;
  const phoneId = `${uid}-phone`;
  const errorId = `${uid}-error`;

  useEffect(() => {
    if (!isPending && !session) navigate('/login', { replace: true });
  }, [isPending, session, navigate]);

  async function onSubmit(data: OnboardingForm) {
    setError(null);
    try {
      await api.post('/me/onboarding', {
        ...data,
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
      });
      navigate('/app', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao criar a escola');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-lg p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap size={22} /></div>
          <div>
            <h1 className="text-lg font-extrabold text-ink">Bem-vindo ao GestEscolar</h1>
            <p className="text-sm text-ink-muted">Vamos configurar sua escola para começar.</p>
          </div>
        </div>

        {error && (
          <div id={errorId} role="alert" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor={schoolNameId} className="label">Nome da escola *</label>
            <input
              id={schoolNameId}
              autoComplete="organization"
              className="input"
              aria-describedby={errors.school_name ? `${schoolNameId}-err` : undefined}
              maxLength={200}
              {...register('school_name')}
            />
            {errors.school_name && <p id={`${schoolNameId}-err`} className="mt-1 text-xs text-danger">{errors.school_name.message}</p>}
          </div>
          <div>
            <label htmlFor={adminNameId} className="label">Seu nome (responsável) *</label>
            <input
              id={adminNameId}
              autoComplete="name"
              className="input"
              aria-describedby={errors.admin_name ? `${adminNameId}-err` : undefined}
              maxLength={120}
              {...register('admin_name')}
            />
            {errors.admin_name && <p id={`${adminNameId}-err`} className="mt-1 text-xs text-danger">{errors.admin_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={cnpjId} className="label">CNPJ</label>
              <input id={cnpjId} autoComplete="off" className="input" {...register('cnpj')} />
            </div>
            <div>
              <label htmlFor={phoneId} className="label">Telefone</label>
              <input id={phoneId} autoComplete="tel" inputMode="tel" maxLength={15} className="input" {...register('phone')} />
            </div>
          </div>
          <button className="btn-primary w-full justify-center" disabled={isSubmitting}>
            {isSubmitting && <Loader2 size={16} className="animate-spin" />} Criar escola e começar
          </button>
          <p className="text-center text-xs text-ink-subtle">Seu teste grátis de 7 dias começa agora.</p>
        </form>
      </div>
    </div>
  );
}
