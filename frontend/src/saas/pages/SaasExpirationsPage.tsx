import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, CalendarClock, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { saasService, type SaasExpiration } from '@/services/saas';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

function urgencyTone(days: number | null): 'danger' | 'warning' | 'neutral' {
  if (days == null) return 'neutral';
  if (days < 0) return 'danger';
  if (days <= 7) return 'warning';
  return 'neutral';
}
function urgencyLabel(days: number | null): string {
  if (days == null) return '—';
  if (days < 0) return `vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'vence hoje';
  return `${days}d restantes`;
}

export function SaasExpirationsPage() {
  const [rows, setRows] = useState<SaasExpiration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extend, setExtend] = useState<SaasExpiration | null>(null);
  const [days, setDays] = useState('15');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await saasService.expirations());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os vencimentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function confirmExtend() {
    if (!extend) return;
    const d = Number(days);
    if (!Number.isFinite(d) || d <= 0) { showToast('error', 'Informe um número de dias válido.'); return; }
    if (!reason.trim()) { showToast('error', 'Informe o motivo da prorrogação.'); return; }
    setSaving(true);
    try {
      await saasService.extendAccess(extend.id, { days: d, reason: reason.trim() });
      showToast('success', `Acesso de ${extend.name} prorrogado por ${d} dias.`);
      setExtend(null); setReason(''); setDays('15');
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao prorrogar o acesso.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando vencimentos…</span></div>;
  }
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Vencimentos"
        subtitle="Escolas com trial vencendo nos próximos 30 dias ou já em atraso."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />} {toast.msg}
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-soft text-success"><CalendarClock size={24} /></div>
            <p className="text-sm font-medium text-ink">Nenhum vencimento próximo</p>
            <p className="text-xs text-ink-subtle">Nenhuma escola com trial vencendo em 30 dias ou em atraso.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Escola</th>
                  <th className="px-5 py-2.5">Plano</th>
                  <th className="hidden px-5 py-2.5 text-right sm:table-cell">Mensalidade</th>
                  <th className="px-5 py-2.5">Vencimento</th>
                  <th className="px-5 py-2.5">Situação</th>
                  <th className="px-5 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-5 py-2.5 font-medium text-ink">{r.name}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{r.plan}</td>
                    <td className="hidden px-5 py-2.5 text-right text-ink-muted sm:table-cell">{brl(r.monthly_price)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-ink-muted">{r.trial_ends_at ? fmtDate(r.trial_ends_at) : '—'}</td>
                    <td className="px-5 py-2.5"><StatusBadge tone={urgencyTone(r.days_left)}>{urgencyLabel(r.days_left)}</StatusBadge></td>
                    <td className="px-5 py-2.5 text-right">
                      <button className="btn-outline text-xs" onClick={() => { setExtend(r); setReason(''); setDays('15'); }}>
                        <CalendarClock size={14} /> Prorrogar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!extend}
        title={`Prorrogar acesso — ${extend?.name ?? ''}`}
        onClose={() => !saving && setExtend(null)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setExtend(null)} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={confirmExtend} disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />} Prorrogar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Dias a prorrogar</label>
            <input type="number" min="1" className="input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <label className="label">Motivo *</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: negociação em andamento" />
          </div>
        </div>
      </Modal>
    </>
  );
}
