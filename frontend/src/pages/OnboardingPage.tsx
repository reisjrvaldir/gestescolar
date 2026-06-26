import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useSession } from '@/lib/authClient';
import { api } from '@/lib/api';

interface OnboardingForm {
  school_name: string;
  admin_name: string;
  cnpj?: string;
  phone?: string;
}

export function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<OnboardingForm>();

  useEffect(() => {
    if (!isPending && !session) navigate('/login', { replace: true });
  }, [isPending, session, navigate]);

  async function onSubmit(data: OnboardingForm) {
    setError(null);
    try {
      await api.post('/me/onboarding', data);
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

        {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Nome da escola *</label>
            <input className="input" {...register('school_name', { required: 'Informe o nome da escola' })} />
            {errors.school_name && <p className="mt-1 text-xs text-danger">{errors.school_name.message}</p>}
          </div>
          <div>
            <label className="label">Seu nome (responsável) *</label>
            <input className="input" {...register('admin_name', { required: 'Informe seu nome' })} />
            {errors.admin_name && <p className="mt-1 text-xs text-danger">{errors.admin_name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">CNPJ</label>
              <input className="input" {...register('cnpj')} />
            </div>
            <div>
              <label className="label">Telefone</label>
              <input className="input" {...register('phone')} />
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
