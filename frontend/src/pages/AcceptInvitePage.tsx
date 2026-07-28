import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Loader2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { invitationsService, type InviteInfo } from '@/services/invitations';

/**
 * Aceite de convite: o usuário convidado define a própria senha a partir do
 * token de uso único recebido por e-mail. Nenhuma senha é pré-definida pela
 * escola. Rota pública: /convite?token=...
 */
export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const uid = useId();
  const passwordId = `${uid}-password`;
  const confirmId = `${uid}-confirm`;

  useEffect(() => {
    let active = true;
    if (!token) { setChecking(false); return; }
    invitationsService.getInvite(token)
      .then((r) => { if (active) setInfo(r); })
      .catch(() => { if (active) setInfo({ valid: false }); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('A senha deve ter ao menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setSubmitting(true);
    try {
      await invitationsService.acceptInvite(token, password);
      setDone(true);
      setTimeout(() => navigate('/login?ativado=1'), 2500);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível ativar o acesso. Solicite um novo convite à escola.');
    } finally {
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap size={20} /></div>
          <span className="text-lg font-extrabold text-ink">GestEscolar</span>
        </div>
        {children}
      </div>
    </div>
  );

  if (checking) {
    return shell(
      <div className="flex items-center gap-2 py-8 text-ink-muted">
        <Loader2 size={18} className="animate-spin" /> Validando convite…
      </div>,
    );
  }

  if (!token || !info?.valid) {
    const expired = info?.state === 'expired';
    return shell(
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-lg font-bold text-ink">{expired ? 'Convite expirado' : 'Convite inválido'}</h1>
        <p className="text-sm text-ink-muted">
          {expired
            ? 'Este link de convite expirou. Solicite um novo convite à secretaria da escola.'
            : 'Este link de convite não é válido ou já foi utilizado. Solicite um novo à secretaria da escola.'}
        </p>
        <Link to="/login" className="btn-outline inline-flex w-full justify-center">Ir para o login</Link>
      </div>,
    );
  }

  if (done) {
    return shell(
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
          <CheckCircle2 size={28} />
        </div>
        <h1 className="text-lg font-bold text-ink">Acesso ativado!</h1>
        <p className="text-sm text-ink-muted">Sua senha foi criada. Redirecionando para o login…</p>
      </div>,
    );
  }

  return shell(
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h1 className="text-lg font-bold text-ink">
          {info.purpose === 'recovery' ? 'Redefinir seu acesso' : `Bem-vindo(a)${info.name ? `, ${info.name}` : ''}!`}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Crie uma senha pessoal para a conta <strong>{info.email_masked}</strong>. Ela é intransferível — não compartilhe.
        </p>
      </div>

      <div>
        <label htmlFor={passwordId} className="mb-1 block text-sm font-medium text-ink">Nova senha</label>
        <PasswordInput id={passwordId} value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres" autoComplete="new-password" required />
      </div>
      <div>
        <label htmlFor={confirmId} className="mb-1 block text-sm font-medium text-ink">Confirmar senha</label>
        <PasswordInput id={confirmId} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repita a senha" autoComplete="new-password" required />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <button type="submit" className="btn-primary flex w-full items-center justify-center gap-2" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        {submitting ? 'Ativando…' : 'Criar senha e ativar acesso'}
      </button>
    </form>,
  );
}
