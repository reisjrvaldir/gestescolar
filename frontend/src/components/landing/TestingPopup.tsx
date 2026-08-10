import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Sparkles, Gift, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { submitLead } from '@/services/leads';
import { funnel } from '@/lib/analytics';

type Step = 'info' | 'form' | 'success';

interface Props {
  open: boolean;
  /** Slug do plano clicado na landing (ex.: gestao_100), se veio de um card de preço. */
  plan?: string;
  onClose: () => void;
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free', gestao_100: 'Gestão 100', gestao_250: 'Gestão 250', ilimitado: 'Ilimitado',
};

/**
 * Popup exibido nos CTAs de "Testar" da landing. Em vez de mandar direto
 * pro contato, explica que a operação é um teste controlado (curated
 * onboarding — só o superadmin abre escola, ver LandingPage) e oferece
 * desconto de lançamento para quem topa entrar agora. Captura o lead
 * no banco (public.leads) para a equipe abordar e criar a escola manualmente.
 */
export function TestingPopup({ open, plan, onClose }: Props) {
  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    onClose();
    // Reseta depois da animação de fechar — evita "piscar" o form vazio.
    setTimeout(() => {
      setStep('info'); setName(''); setEmail(''); setPhone(''); setSchoolName(''); setError(null);
    }, 200);
  }

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canSubmit = name.trim().length >= 2 && emailOk;

  async function submit() {
    if (!canSubmit || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitLead({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        school_name: schoolName.trim() || undefined,
        message: plan ? `Interesse no plano ${PLAN_NAMES[plan] ?? plan}` : undefined,
        source: 'landing_popup',
      });
      funnel.leadSubmit(plan);
      setStep('success');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  const title = step === 'info' ? 'Teste controlado'
    : step === 'form' ? 'Quero participar'
    : 'Recebemos seu interesse!';

  return (
    <Modal
      open={open}
      title={title}
      onClose={handleClose}
      footer={
        step === 'info' ? (
          <button className="btn-primary w-full justify-center" onClick={() => setStep('form')}>
            Quero participar e garantir desconto <ArrowRight size={15} />
          </button>
        ) : step === 'form' ? (
          <>
            <button className="btn-outline" onClick={() => setStep('info')} disabled={sending}>Voltar</button>
            <button className="btn-primary" onClick={submit} disabled={!canSubmit || sending}>
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Enviar
            </button>
          </>
        ) : (
          <button className="btn-primary w-full justify-center" onClick={handleClose}>Entendi</button>
        )
      }
    >
      {step === 'info' && (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Sparkles size={26} />
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">
            O GestEscolar está em <strong className="text-ink">teste controlado</strong>: liberamos o
            acesso aos poucos, escola por escola, para garantir suporte de perto durante a
            implantação das funcionalidades.
          </p>
          <div className="flex items-start gap-2.5 rounded-xl bg-success-soft px-3.5 py-2.5 text-left text-sm text-success">
            <Gift size={18} className="mt-0.5 shrink-0" />
            <span>Quem entra agora garante <strong>desconto especial de lançamento</strong> na assinatura.</span>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="space-y-3">
          {error && (
            <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</div>
          )}
          <div>
            <label className="label">Seu nome *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" />
          </div>
          <div>
            <label className="label">E-mail *</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@escola.com.br" />
          </div>
          <div>
            <label className="label">Escola <span className="font-normal text-ink-subtle">(opcional)</span></label>
            <input className="input" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Nome da escola" />
          </div>
          <div>
            <label className="label">WhatsApp <span className="font-normal text-ink-subtle">(opcional)</span></label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
            <CheckCircle2 size={28} />
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">
            Nossa equipe vai entrar em contato em breve para liberar seu acesso ao teste
            controlado e aplicar seu desconto de lançamento.
          </p>
        </div>
      )}
    </Modal>
  );
}
