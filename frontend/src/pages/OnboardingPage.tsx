import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Headset, LogOut } from 'lucide-react';
import { useSession, signOut } from '@/lib/authClient';
import { contactHref } from '@/lib/siteConfig';
import { funnel } from '@/lib/analytics';

/**
 * Conta autenticada, mas sem perfil vinculado a nenhuma escola.
 *
 * Até 07/08/2026 esta página era um formulário de auto-cadastro: quem chegasse
 * aqui criava a própria escola e virava school_admin dela. A operação passou a
 * ser curada — quem abre escola é a equipe, pelo painel de superadmin — então o
 * formulário saiu e ficou a explicação.
 *
 * Ainda é possível cair aqui de forma legítima: o login com Google cria a
 * identidade no provedor antes de existir qualquer perfil. Sem esta tela a
 * pessoa via um formulário que o backend recusa com 403.
 */
export function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) navigate('/login', { replace: true });
  }, [isPending, session, navigate]);

  const email = (session?.user as { email?: string } | undefined)?.email;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-lg p-7">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-ink">Conta sem escola vinculada</h1>
            <p className="text-sm text-ink-muted">
              {email ? <>Você entrou como <strong className="font-semibold text-ink">{email}</strong>.</> : 'Você está autenticado.'}
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-ink-muted">
          Este acesso ainda não está ligado a nenhuma escola. As contas do GestEscolar são
          criadas pela nossa equipe junto com a escola — fale com a gente para abrir a sua,
          ou peça à secretaria da sua escola que cadastre o seu acesso.
        </p>

        <a
          href={contactHref('Olá! Entrei no GestEscolar mas minha conta não está vinculada a nenhuma escola.')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => funnel.contactClick('onboarding_blocked')}
          className="btn-primary mt-5 w-full justify-center"
        >
          <Headset size={16} /> Falar com a nossa equipe
        </a>

        <button
          className="btn-ghost mt-2 w-full justify-center"
          onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
        >
          <LogOut size={15} /> Sair desta conta
        </button>
      </div>
    </div>
  );
}
