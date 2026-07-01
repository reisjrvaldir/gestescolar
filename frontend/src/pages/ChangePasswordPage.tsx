import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, Check } from 'lucide-react';
import { changePassword, signOut } from '@/lib/authClient';
import { api } from '@/lib/api';

interface Fields {
  current: string;
  next: string;
  confirm: string;
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Fields>();
  const next = watch('next');

  async function onSubmit(data: Fields) {
    setError(null);
    if (data.next !== data.confirm) {
      setError('A confirmação não corresponde à nova senha.');
      return;
    }
    if (data.next.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (data.next === data.current) {
      setError('A nova senha deve ser diferente da senha inicial.');
      return;
    }
    setLoading(true);
    try {
      let { error: bErr } = await changePassword({
        currentPassword: data.current,
        newPassword: data.next,
      });
      // Senha inicial de 6 dígitos é armazenada expandida para 8 chars no provedor;
      // refaz o mesmo cálculo se a tentativa direta falhar.
      if (bErr && /^\d{6}$/.test(data.current)) {
        ({ error: bErr } = await changePassword({
          currentPassword: (data.current + data.current).slice(0, 8),
          newPassword: data.next,
        }));
      }
      if (bErr) {
        setError(bErr.message ?? 'Falha ao trocar a senha. Verifique a senha atual.');
        setLoading(false);
        return;
      }
      await api.post('/me/password-changed');
      setSuccess(true);
      setTimeout(() => {
        // Forçar reload pra revalidar /me e seguir
        window.location.href = '/app';
      }, 1500);
    } catch (e: any) {
      setError(e?.message ?? 'Erro inesperado.');
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-full bg-primary-soft p-2 text-primary">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Defina sua senha</h1>
            <p className="text-xs text-ink-muted">
              Este é seu primeiro acesso. Por segurança, é obrigatório trocar a senha inicial por uma intransferível.
            </p>
          </div>
        </div>

        {success ? (
          <div className="rounded-xl bg-success-soft p-4 text-center text-sm text-success">
            <Check className="mx-auto mb-2" size={28} />
            <p className="font-semibold">Senha alterada com sucesso!</p>
            <p className="mt-1 text-xs">Redirecionando…</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
            )}
            <div>
              <label className="label">Senha atual (inicial)</label>
              <input type="password" autoComplete="current-password" className="input"
                placeholder="Senha temporária recebida"
                {...register('current', { required: 'Informe a senha atual' })} />
              {errors.current && <p className="mt-1 text-xs text-danger">{errors.current.message}</p>}
            </div>
            <div>
              <label className="label">Nova senha</label>
              <input type="password" autoComplete="new-password" className="input"
                placeholder="Mínimo 8 caracteres"
                {...register('next', { required: 'Informe a nova senha', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
              {errors.next && <p className="mt-1 text-xs text-danger">{errors.next.message}</p>}
            </div>
            <div>
              <label className="label">Confirme a nova senha</label>
              <input type="password" autoComplete="new-password" className="input"
                {...register('confirm', {
                  required: 'Confirme a senha',
                  validate: (v) => v === next || 'As senhas não conferem',
                })} />
              {errors.confirm && <p className="mt-1 text-xs text-danger">{errors.confirm.message}</p>}
            </div>
            <button className="btn-primary w-full justify-center" type="submit" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />} Alterar senha
            </button>
            <button type="button" className="w-full text-center text-xs text-ink-subtle hover:text-ink-muted" onClick={handleSignOut}>
              Sair
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
