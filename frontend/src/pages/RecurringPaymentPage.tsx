import { useEffect, useState } from 'react';
import { RefreshCw, Loader2, CreditCard, ShieldCheck, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';
import { recurringService, type RecurringStudent, type RecurringStatus } from '@/services/recurring';

const LABEL: Record<RecurringStatus, { tone: 'success' | 'warning' | 'danger' | 'neutral'; text: string }> = {
  active:    { tone: 'success', text: 'Ativo' },
  pending:   { tone: 'warning', text: 'Aguardando cartão' },
  failed:    { tone: 'danger',  text: 'Cartão recusado' },
  cancelled: { tone: 'neutral', text: 'Desligado' },
};

export function RecurringPaymentPage() {
  const [rows, setRows] = useState<RecurringStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyFor, setBusyFor] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState<RecurringStudent | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    recurringService.list()
      .then(setRows)
      .catch((e: any) => setError(e?.message ?? 'Não foi possível carregar.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  /** Cria a assinatura e leva ao checkout do provedor, onde o cartão é
   *  digitado. Redireciona na mesma aba: abrir janela depois do await
   *  costuma ser barrado por bloqueador de pop-up. */
  async function enable(studentId: string) {
    setBusyFor(studentId);
    setError(null);
    try {
      const r = await recurringService.enable(studentId);
      if (!r.checkout_url) throw new Error('O provedor não devolveu o link para cadastrar o cartão.');
      window.location.href = r.checkout_url;
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível ativar o pagamento automático.');
      setBusyFor(null);
    }
  }

  async function cancel(studentId: string) {
    setBusyFor(studentId);
    setError(null);
    try {
      await recurringService.cancel(studentId);
      setConfirmOff(null);
      load();
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível desligar.');
    } finally {
      setBusyFor(null);
    }
  }

  return (
    <>
      <PageHero
        title="Pagamento recorrente"
        subtitle="Cadastre um cartão e a mensalidade é paga automaticamente todo mês."
        icon={CreditCard}
        actions={
          <button className="btn-outline inline-flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        }
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" />
        <p>
          Os dados do cartão são digitados no ambiente seguro do provedor de pagamentos e
          ficam guardados lá — a escola e o GestEscolar nunca têm acesso ao número do
          seu cartão. Você pode desligar quando quiser.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum aluno vinculado"
          description="Quando houver aluno ativo vinculado a você, o pagamento automático aparece aqui."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const st = r.status ? LABEL[r.status] : null;
            const on = r.status === 'active' || r.status === 'pending' || r.status === 'failed';
            const busy = busyFor === r.student_id;
            return (
              <div key={r.student_id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink">{r.student_name}</p>
                      {st && <StatusBadge tone={st.tone}>{st.text}</StatusBadge>}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {r.monthly_fee != null && r.monthly_fee > 0
                        ? <>Mensalidade de <strong className="text-ink">{brl(r.monthly_fee)}</strong></>
                        : 'Sem plano de mensalidade definido'}
                    </p>
                    {r.status === 'active' && r.last_charged_at && (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-success">
                        <CheckCircle2 size={13} /> Última cobrança em {fmtDate(r.last_charged_at)}
                      </p>
                    )}
                    {r.status === 'pending' && (
                      <p className="mt-1 text-xs text-warning">
                        Assinatura criada, mas o cartão ainda não foi cadastrado. Clique de novo para concluir.
                      </p>
                    )}
                    {r.status === 'failed' && (
                      <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-danger">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>
                          A última cobrança foi recusada e a fatura do mês voltou para PIX.
                          Atualize o cartão para voltar a cobrar automaticamente.
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {on && r.status !== 'cancelled' && (
                      <button
                        className="btn-outline text-xs"
                        onClick={() => setConfirmOff(r)}
                        disabled={busy}
                      >
                        <X size={13} /> Desligar
                      </button>
                    )}
                    {r.status !== 'active' && (
                      <button
                        className="btn-primary text-xs"
                        onClick={() => enable(r.student_id)}
                        disabled={busy || !r.monthly_fee}
                      >
                        {busy
                          ? <><Loader2 size={13} className="animate-spin" /> Abrindo…</>
                          : <><CreditCard size={13} /> {r.status === 'pending' || r.status === 'failed' ? 'Cadastrar cartão' : 'Ativar'}</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmOff && (
        <Modal
          open
          title="Desligar pagamento automático"
          onClose={() => setConfirmOff(null)}
          footer={
            <>
              <button className="btn-outline" onClick={() => setConfirmOff(null)}>Cancelar</button>
              <button
                className="btn-danger"
                onClick={() => cancel(confirmOff.student_id)}
                disabled={busyFor === confirmOff.student_id}
              >
                {busyFor === confirmOff.student_id ? <Loader2 size={15} className="animate-spin" /> : null} Desligar
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-muted">
            O cartão de <strong className="text-ink">{confirmOff.student_name}</strong> deixa de ser
            cobrado. As próximas mensalidades voltam a ser pagas manualmente, por PIX ou cartão,
            na tela de Faturas.
          </p>
        </Modal>
      )}
    </>
  );
}
