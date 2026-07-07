import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import { requestPasswordReset } from '@/lib/authClient';

/** Solicita o e-mail de redefinição de senha (Better Auth / Neon Auth). */
export function ForgotPasswordPage() {
  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let email = id.trim();
      // Login por matrícula: resolve o e-mail da conta no backend.
      if (!email.includes('@')) {
        const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
        const r = await fetch(`${API}/public/login-email?matricula=${encodeURIComponent(email)}`);
        if (r.ok) email = (await r.json()).data.email;
        // Se não encontrar, seguimos assim mesmo (resposta genérica, evita enumeração).
      }
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch {
      // Mensagem genérica para não revelar se o e-mail existe.
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap size={20} /></div>
          <span className="text-lg font-extrabold text-ink">GestEscolar</span>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-ink">
              <MailCheck size={20} className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="font-semibold">Verifique seu e-mail</p>
                <p className="text-ink-muted">Se houver uma conta associada, enviamos um link para redefinir a senha. O link expira em algumas horas.</p>
              </div>
            </div>
            <Link to="/login" className="btn-outline w-full justify-center"><ArrowLeft size={16} /> Voltar ao login</Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-bold text-ink">Esqueci minha senha</h1>
            <p className="mb-5 text-sm text-ink-muted">Informe seu e-mail ou matrícula para receber o link de redefinição.</p>
            {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="label">E-mail ou Matrícula</label>
                <input type="text" className="input" placeholder="seu@email.com ou nº de matrícula" value={id} onChange={(e) => setId(e.target.value)} required />
              </div>
              <button className="btn-primary w-full justify-center" disabled={loading || !id.trim()}>
                {loading && <Loader2 size={16} className="animate-spin" />} Enviar link de redefinição
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
