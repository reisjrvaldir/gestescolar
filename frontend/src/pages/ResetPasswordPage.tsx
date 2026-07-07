import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { resetPassword } from '@/lib/authClient';

/** Define uma nova senha a partir do token recebido por e-mail. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('A senha deve ter ao menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setLoading(true);
    try {
      const res = await resetPassword(password, token);
      setLoading(false);
      if ((res as any)?.error) return setError((res as any).error.message ?? 'Não foi possível redefinir a senha.');
      navigate('/login?reset=1');
    } catch {
      setLoading(false);
      setError('Link inválido ou expirado. Solicite um novo.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap size={20} /></div>
          <span className="text-lg font-extrabold text-ink">GestEscolar</span>
        </div>

        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-ink"><KeyRound size={18} className="text-primary" /> Nova senha</h1>

        {!token ? (
          <div className="mt-3 space-y-4">
            <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              Link inválido. Abra o link enviado ao seu e-mail ou solicite um novo.
            </div>
            <Link to="/forgot-password" className="btn-outline w-full justify-center">Solicitar novo link</Link>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-ink-muted">Escolha uma nova senha para sua conta.</p>
            {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="label">Nova senha</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="mt-1 text-xs text-ink-subtle">Mínimo 8 caracteres.</p>
              </div>
              <div>
                <label className="label">Confirmar senha</label>
                <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
              <button className="btn-primary w-full justify-center" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" />} Redefinir senha
              </button>
            </form>
            <Link to="/login" className="mt-4 flex items-center justify-center gap-1 text-sm text-ink-muted hover:text-ink">
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
