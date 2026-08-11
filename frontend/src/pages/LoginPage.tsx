import React, { useId, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  GraduationCap, Loader2, ShieldCheck, Zap, Headset, ArrowLeft, Sparkles,
} from 'lucide-react';
import { signIn, authClient } from '@/lib/authClient';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { funnel } from '@/lib/analytics';
import { contactHref } from '@/lib/siteConfig';

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

/**
 * O client do Better Auth confirma o login (signIn.email resolve sem erro)
 * ANTES da sessão realmente propagar pro estado reativo que o AuthGate lê
 * (useSession) — o próprio pacote agenda esse refresh com setTimeout interno.
 * Sem esperar aqui, o AuthGate podia montar, checar a sessão, não achar
 * nada ainda, e chutar de volta pro /login — apagando o formulário e dando
 * a impressão de que "sumiu", exigindo login de novo. Confirma a sessão via
 * chamada direta (não reativa) antes de navegar, corta essa corrida pela raiz.
 */
async function waitForSession(maxAttempts = 10, delayMs = 150): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { data } = await authClient.getSession();
      if (data) return true;
    } catch { /* tenta de novo */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const resetOk = params.get('reset') === '1';

  const uid = useId();
  const loginEmailId = `${uid}-login-email`;
  const loginPasswordId = `${uid}-login-password`;
  const errorId = `${uid}-error`;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const id = email.trim();

      if (id.includes('@')) {
        // ── Login por e-mail: fluxo direto com Neon Auth ──
        let res = await signIn.email({ email: id, password });
        // Senha inicial de 6 dígitos: reconstrói a versão de 8 chars.
        if (res.error && /^\d{6}$/.test(password)) {
          res = await signIn.email({ email: id, password: (password + password).slice(0, 8) });
        }
        if (res.error) {
          setLoading(false);
          return setError(res.error.message ?? 'Falha ao entrar');
        }
      } else {
        // ── Login por matrícula: backend resolve o e-mail internamente ──
        // O e-mail NUNCA é retornado ao browser. O backend autentica
        // server-to-server com o Neon Auth e encaminha o JWT via header
        // set-auth-jwt. O fetchPlugin do authClient processa esse header
        // e injeta o token no estado interno sem expor o e-mail.
        const API = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
        // Deve ser URL absoluta para o $fetch do authClient não prefixar
        // com o baseURL do Neon Auth.
        const apiBase = API.startsWith('http') ? API : `${window.location.origin}${API}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (authClient as any).$fetch(
          `${apiBase}/public/auth/matricula`,
          {
            method: 'POST',
            body: JSON.stringify({ matricula: id, password }),
            headers: { 'Content-Type': 'application/json' },
            throw: false,
          },
        );
        if (result?.error || !result?.data?.ok) {
          setLoading(false);
          return setError('Não foi possível entrar. Verifique os dados ou procure a escola.');
        }
      }

      // Espera a sessão ficar disponível de fato antes de navegar.
      const ready = await waitForSession();
      setLoading(false);
      if (!ready) {
        return setError('Login confirmado, mas demorou para iniciar a sessão. Tente novamente.');
      }
      navigate('/app');
    } catch {
      setLoading(false);
      setError('Não foi possível entrar. Verifique os dados ou procure a escola.');
    }
  }

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
                  Bem-vindo de volta
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Entre para acessar o painel da sua escola.
                </p>
              </div>

              <div className="my-5" />

              {error && (
                <div id={errorId} role="alert" className="mb-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                  {error}
                </div>
              )}
              {resetOk && (
                <div className="mb-4 rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-ink">
                  Senha redefinida com sucesso. Faça login com a nova senha.
                </div>
              )}

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

              {/* Sem auto-cadastro: quem abre escola é a equipe (ver LandingPage). */}
              <div className="mt-5 border-t border-border pt-4 text-center">
                <p className="text-sm text-ink-muted">
                  Sua escola ainda não usa o GestEscolar?
                </p>
                <a
                  href={contactHref('Olá! Quero abrir a conta da minha escola no GestEscolar.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => funnel.contactClick('login')}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <Headset size={15} /> Falar com a nossa equipe
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/45 lg:text-left">© 2026 GestEscolar</p>
      </div>
    </div>
  );
}
