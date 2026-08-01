import React, { useEffect, useId, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  GraduationCap, Loader2, ShieldCheck, Zap, Headset, ArrowLeft,
  CheckCircle2, Sparkles,
} from 'lucide-react';
import { signIn, signUp } from '@/lib/authClient';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { CURRENT_TERMS_VERSION } from '@/lib/consentVersions';
import { funnel } from '@/lib/analytics';

type Tab = 'login' | 'signup';

const PLAN_LABELS: Record<string, string> = {
  gestao_100: 'Gestão 100',
  gestao_250: 'Gestão 250',
};

export function LoginPage() {
  const [params] = useSearchParams();
  // A landing manda ?tab=signup nos CTAs de teste grátis. Sem isso o visitante
  // caía no formulário de login de uma conta que ele ainda não tem.
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'signup' ? 'signup' : 'login');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const resetOk = params.get('reset') === '1';
  const plan = params.get('plan');

  const uid = useId();
  const loginEmailId = `${uid}-login-email`;
  const loginPasswordId = `${uid}-login-password`;
  const signupNameId = `${uid}-signup-name`;
  const signupEmailId = `${uid}-signup-email`;
  const signupPasswordId = `${uid}-signup-password`;
  const signupAcceptId = `${uid}-signup-accept`;
  const errorId = `${uid}-error`;

  useEffect(() => {
    if (tab === 'signup') funnel.signupView(plan ? `plan:${plan}` : 'direct');
  }, [tab, plan]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const id = email.trim();
      let loginEmail = id;

      // Login por matrícula: resolve o e-mail da conta no backend.
      if (!id.includes('@')) {
        const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
        const r = await fetch(`${API}/public/login-email?matricula=${encodeURIComponent(id)}`);
        if (!r.ok) {
          setLoading(false);
          return setError('Matrícula não encontrada. Verifique com a secretaria.');
        }
        loginEmail = (await r.json()).data.email;
      }

      let res = await signIn.email({ email: loginEmail, password });
      // Senha inicial de 6 dígitos: reconstrói a versão de 8 chars armazenada no provedor.
      if (res.error && /^\d{6}$/.test(password)) {
        res = await signIn.email({ email: loginEmail, password: (password + password).slice(0, 8) });
      }
      setLoading(false);
      if (res.error) return setError(res.error.message ?? 'Falha ao entrar');
      navigate('/app');
    } catch {
      setLoading(false);
      setError('Falha ao entrar. Verifique os dados e tente novamente.');
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) return setError('Você precisa aceitar os Termos e a Política de Privacidade.');
    setLoading(true);
    const { error } = await signUp.email({ email, password, name });
    setLoading(false);
    if (error) {
      const msg = error.message ?? '';
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('user already')) {
        return setError(
          <span>
            Este e-mail já possui cadastro.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => { setTab('login'); setError(null); }}
            >
              Clique aqui para entrar
            </button>.
          </span>
        );
      }
      return setError(msg || 'Falha ao cadastrar');
    }
    funnel.signupSuccess();
    navigate('/app'); // cai no onboarding (criar escola)
  }

  const tabBtn = (t: Tab) =>
    `relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
      tab === t
        ? 'bg-surface text-primary shadow-card'
        : 'text-ink-muted hover:text-ink'
    }`;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ─── Coluna esquerda — institucional ─── */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        {/* Fundo em gradiente + orbes de luz */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-ink via-primary to-purple" />
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl" />
        {/* Grade sutil */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <Link
          to="/"
          className="relative z-10 inline-flex w-fit items-center gap-2.5 rounded-xl transition-opacity hover:opacity-80"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <GraduationCap size={22} />
          </div>
          <span className="text-lg font-extrabold tracking-tight">GestEscolar</span>
        </Link>

        <div className="relative z-10 max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm">
            <Sparkles size={13} /> Teste grátis por 7 dias
          </div>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.1] tracking-tight">
            Gestão escolar simples,
            <br />
            completa e integrada.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            Acadêmico, financeiro e comunicação — tudo em um só lugar, com
            cobrança inteligente via PIX.
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              { icon: Headset, text: 'Suporte humano de verdade' },
              { icon: Zap, text: 'Implantação em menos de 2 minutos' },
              { icon: ShieldCheck, text: 'Dados isolados e conformidade LGPD' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-white/90">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12 backdrop-blur-sm">
                  <Icon size={15} />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/45">© 2026 GestEscolar</p>
      </div>

      {/* ─── Coluna direita — formulário ─── */}
      <div className="flex flex-col bg-canvas">
        {/* Topo mobile: marca + voltar (a coluna institucional some no mobile) */}
        <div className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2 text-ink">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap size={19} />
            </div>
            <span className="font-extrabold">GestEscolar</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="mb-6 hidden items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary lg:inline-flex"
            >
              <ArrowLeft size={15} /> Voltar ao site
            </Link>

            <div className="rounded-2xl border border-border bg-surface p-7 shadow-card">
              <div className="mb-1.5">
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  {tab === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {tab === 'login'
                    ? 'Entre para acessar o painel da sua escola.'
                    : 'Comece o teste grátis de 7 dias. Sem cartão de crédito.'}
                </p>
              </div>

              {plan && PLAN_LABELS[plan] && tab === 'signup' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary-ink">
                  <CheckCircle2 size={15} className="shrink-0" />
                  Plano <strong className="font-semibold">{PLAN_LABELS[plan]}</strong> selecionado
                </div>
              )}

              <div role="tablist" className="my-5 flex gap-1 rounded-xl bg-canvas p-1">
                <button
                  role="tab"
                  aria-selected={tab === 'login'}
                  className={tabBtn('login')}
                  onClick={() => { setTab('login'); setError(null); }}
                >
                  Entrar
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'signup'}
                  className={tabBtn('signup')}
                  onClick={() => { setTab('signup'); setError(null); }}
                >
                  Criar conta
                </button>
              </div>

              {error && (
                <div id={errorId} role="alert" className="mb-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
              {resetOk && tab === 'login' && (
                <div className="mb-4 rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-ink">
                  Senha redefinida com sucesso. Faça login com a nova senha.
                </div>
              )}

              {tab === 'login' ? (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div>
                    <label htmlFor={loginEmailId} className="label">E-mail ou Matrícula</label>
                    <input
                      id={loginEmailId}
                      type="text"
                      autoComplete="username"
                      className="input"
                      placeholder="seu@email.com ou nº de matrícula"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-describedby={error ? errorId : undefined}
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label htmlFor={loginPasswordId} className="label">Senha</label>
                      <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                        Esqueci minha senha
                      </Link>
                    </div>
                    <PasswordInput
                      id={loginPasswordId}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby={error ? errorId : undefined}
                      required
                    />
                    <p className="mt-1.5 text-xs text-ink-subtle">
                      1º acesso: use a senha temporária fornecida pela escola.
                    </p>
                  </div>
                  {/* py-3 garante ~44px de altura — mínimo recomendado de alvo de toque */}
                  <button className="btn-primary w-full justify-center py-3" disabled={loading}>
                    {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Entrar na conta
                  </button>
                </form>
              ) : (
                <form className="space-y-4" onSubmit={handleSignup}>
                  <div>
                    <label htmlFor={signupNameId} className="label">Seu nome</label>
                    <input
                      id={signupNameId}
                      autoComplete="name"
                      className="input"
                      placeholder="Como podemos te chamar?"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={signupEmailId} className="label">E-mail</label>
                    <input
                      id={signupEmailId}
                      type="email"
                      autoComplete="email"
                      className="input"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-describedby={error ? errorId : undefined}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor={signupPasswordId} className="label">Senha</label>
                    <PasswordInput
                      id={signupPasswordId}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <p className="mt-1.5 text-xs text-ink-subtle">Mínimo 8 caracteres.</p>
                  </div>
                  <div className="flex items-start gap-2.5 text-sm text-ink-muted">
                    <input
                      id={signupAcceptId}
                      type="checkbox"
                      className="mt-1 accent-primary"
                      checked={accept}
                      required
                      onChange={(e) => setAccept(e.target.checked)}
                    />
                    <label htmlFor={signupAcceptId} className="text-[13px] leading-snug">
                      Li e aceito os{' '}
                      <Link to="/termos" target="_blank" className="font-medium text-primary hover:underline">
                        Termos de Uso
                      </Link>{' '}
                      e a{' '}
                      <Link to="/privacidade" target="_blank" className="font-medium text-primary hover:underline">
                        Política de Privacidade
                      </Link>{' '}
                      <span className="text-xs text-ink-subtle">(v{CURRENT_TERMS_VERSION})</span>
                    </label>
                  </div>
                  {/* py-3 garante ~44px de altura — mínimo recomendado de alvo de toque */}
                  <button className="btn-primary w-full justify-center py-3" disabled={loading}>
                    {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} Começar teste grátis
                  </button>
                  <p className="text-center text-xs text-ink-subtle">
                    Grátis por 7 dias · Sem cartão de crédito · Cancele quando quiser
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
