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

/**
 * Fundo em 3 camadas (a primeira listada fica por cima):
 *   1. Véu escuro — garante contraste do texto branco independente da foto.
 *   2. A foto (public/login-bg.jpg). Se o arquivo não existir o navegador
 *      simplesmente pula esta camada, sem erro e sem quebrar o layout.
 *   3. Gradiente de marca — o fundo definitivo enquanto não houver foto.
 * Trocar a arte = substituir o arquivo. Nenhum código muda.
 */
const BACKDROP: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(105deg, rgba(9,20,54,0.94) 0%, rgba(15,32,86,0.86) 42%, rgba(30,58,138,0.72) 100%)',
    "url('/login-bg.jpg')",
    'radial-gradient(at 12% 22%, #1D4ED8 0px, transparent 55%),' +
      'radial-gradient(at 82% 12%, #7C3AED 0px, transparent 50%),' +
      'radial-gradient(at 68% 88%, #0EA5A4 0px, transparent 48%),' +
      'linear-gradient(135deg, #0F1E4B 0%, #1E3A8A 100%)',
  ].join(','),
  backgroundSize: 'cover, cover, cover',
  backgroundPosition: 'center, center, center',
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
    `flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
      tab === t ? 'bg-surface text-primary shadow-card' : 'text-ink-muted hover:text-ink'
    }`;

  return (
    <div className="relative min-h-screen w-full" style={BACKDROP}>
      {/* Vinheta: escurece as bordas e ancora o conteúdo sobre a foto */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(4,10,30,0.55) 100%)' }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 lg:px-8">
        {/* Topo: marca + voltar */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-white transition-opacity hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md">
              <GraduationCap size={21} />
            </div>
            <span className="text-lg font-extrabold tracking-tight">GestEscolar</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Voltar ao site</span>
          </Link>
        </div>

        {/* Miolo */}
        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-2 lg:gap-14">
          {/* Institucional — sobre a foto */}
          <div className="hidden max-w-lg text-white lg:block">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md ring-1 ring-white/20">
              <Sparkles size={13} /> Teste grátis por 7 dias
            </div>
            <h1 className="text-[2.7rem] font-extrabold leading-[1.08] tracking-tight drop-shadow-sm">
              Gestão escolar simples,
              <br />
              completa e integrada.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/80">
              Acadêmico, financeiro e comunicação — tudo em um só lugar, com
              cobrança inteligente via PIX.
            </p>

            <div className="mt-9 space-y-3">
              {[
                { icon: Headset, text: 'Suporte humano de verdade' },
                { icon: Zap, text: 'Implantação em menos de 2 minutos' },
                { icon: ShieldCheck, text: 'Dados isolados e conformidade LGPD' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-white/90">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/12 backdrop-blur-md ring-1 ring-white/15">
                    <Icon size={15} />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Card de vidro. Opacidade alta de propósito: vidro bonito demais
              deixa os campos ilegíveis — o efeito fica no entorno, não no input. */}
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-2xl bg-surface/[0.97] p-6 shadow-2xl ring-1 ring-white/40 backdrop-blur-2xl sm:p-7">
              <div>
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

        <p className="text-center text-xs text-white/45 lg:text-left">© 2026 GestEscolar</p>
      </div>
    </div>
  );
}
