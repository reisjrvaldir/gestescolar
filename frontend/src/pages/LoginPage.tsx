import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2, ShieldCheck, Zap, Headset } from 'lucide-react';
import { signIn, signUp } from '@/lib/authClient';

type Tab = 'login' | 'signup';

export function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);

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
    if (error) return setError(error.message ?? 'Falha ao cadastrar');
    navigate('/app'); // cai no onboarding (criar escola)
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Coluna esquerda — institucional */}
      <div className="hidden flex-col justify-between bg-primary p-10 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15"><GraduationCap size={20} /></div>
          <span className="text-lg font-extrabold">GestEscolar</span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold leading-tight">Gestão escolar simples, completa e integrada.</h1>
          <p className="mt-3 text-white/80">Acadêmico, financeiro e comunicação — tudo em um só lugar, com cobrança inteligente via PIX.</p>
          <div className="mt-8 space-y-3 text-sm">
            <div className="flex items-center gap-2"><Headset size={16} /> Suporte humano</div>
            <div className="flex items-center gap-2"><Zap size={16} /> Implantação rápida</div>
            <div className="flex items-center gap-2"><ShieldCheck size={16} /> Conformidade LGPD</div>
          </div>
        </div>
        <p className="text-xs text-white/50">© 2026 GestEscolar</p>
      </div>

      {/* Coluna direita — formulário */}
      <div className="flex items-center justify-center bg-canvas p-6">
        <div className="card w-full max-w-md p-6">
          <div className="mb-5 flex rounded-xl border border-border p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === 'login' ? 'bg-primary text-white' : 'text-ink-muted'}`}
              onClick={() => { setTab('login'); setError(null); }}
            >Entrar</button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === 'signup' ? 'bg-primary text-white' : 'text-ink-muted'}`}
              onClick={() => { setTab('signup'); setError(null); }}
            >Cadastrar escola</button>
          </div>

          {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

          {tab === 'login' ? (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="label">E-mail ou Matrícula</label>
                <input type="text" className="input" placeholder="seu@email.com ou nº de matrícula" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Senha</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <p className="mt-1 text-xs text-ink-subtle">1º acesso: senha = 6 primeiros dígitos do CPF.</p>
              </div>
              <button className="btn-primary w-full justify-center" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" />} Entrar na conta
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSignup}>
              <div>
                <label className="label">Seu nome</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Senha</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                <p className="mt-1 text-xs text-ink-subtle">Mínimo 8 caracteres.</p>
              </div>
              <label className="flex items-start gap-2 text-sm text-ink-muted">
                <input type="checkbox" className="mt-0.5" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
              </label>
              <button className="btn-primary w-full justify-center" disabled={loading}>
                {loading && <Loader2 size={16} className="animate-spin" />} Começar teste grátis
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
