import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CalendarOff, Plus, Loader2, Check, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  leaveRequestsService, LEAVE_TYPE_LABELS,
  type LeaveRequest, type LeaveType,
} from '@/services/leaveRequests';
import { useMe } from '@/auth/AuthGate';

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
} as const;

const STATUS_LABEL = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
} as const;

export function LeaveRequestsPage() {
  const me = useMe();
  const isAdmin = me && ['school_admin', 'superadmin'].includes(me.role);

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    type: LeaveType; start_date: string; end_date: string; reason: string;
  }>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setItems(await leaveRequestsService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onCreate(data: { type: LeaveType; start_date: string; end_date: string; reason: string }) {
    await leaveRequestsService.create(data);
    reset();
    setOpen(false);
    await load();
  }

  async function onDecide(id: string, status: 'approved' | 'rejected') {
    const note = window.prompt(`Observação (opcional) para ${status === 'approved' ? 'aprovação' : 'rejeição'}:`);
    await leaveRequestsService.decide(id, status, note ?? undefined);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Folgas, Licenças e Férias"
        subtitle={isAdmin ? 'Solicitações da equipe.' : 'Solicite e acompanhe suas folgas, licenças e férias.'}
        actions={
          !isAdmin && (
            <button className="btn-primary" onClick={() => { reset(); setOpen(true); }}>
              <Plus size={16} /> Nova solicitação
            </button>
          )
        }
      />

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-ink-muted"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarOff} title="Nenhuma solicitação" description="Crie sua primeira solicitação." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                {isAdmin && <th className="px-4 py-3">Funcionário</th>}
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  {isAdmin && <td className="px-4 py-3 font-medium text-ink">{r.user_name}</td>}
                  <td className="px-4 py-3 text-ink-muted">{LEAVE_TYPE_LABELS[r.type]}</td>
                  <td className="px-4 py-3 text-ink-muted whitespace-nowrap">
                    {new Date(r.start_date).toLocaleDateString('pt-BR')} → {new Date(r.end_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-xs">{r.reason || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</StatusBadge>
                    {r.decision_note && <p className="mt-1 text-xs text-ink-subtle">Nota: {r.decision_note}</p>}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' && (
                        <div className="inline-flex gap-1">
                          <button className="rounded-lg p-1.5 text-ink-muted hover:bg-success-soft hover:text-success" onClick={() => onDecide(r.id, 'approved')} title="Aprovar">
                            <Check size={15} />
                          </button>
                          <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onDecide(r.id, 'rejected')} title="Rejeitar">
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} title="Nova solicitação" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" form="leave-form" type="submit">Enviar</button>
          </>
        }>
        <form id="leave-form" className="space-y-4" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="label">Tipo *</label>
            <select className="input" {...register('type', { required: true })}>
              <option value="folga">Folga</option>
              <option value="licenca">Licença</option>
              <option value="ferias">Férias</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Início *</label>
              <input type="date" className="input" {...register('start_date', { required: 'Informe a data' })} />
              {errors.start_date && <p className="mt-1 text-xs text-danger">{errors.start_date.message}</p>}
            </div>
            <div>
              <label className="label">Fim *</label>
              <input type="date" className="input" {...register('end_date', { required: 'Informe a data' })} />
              {errors.end_date && <p className="mt-1 text-xs text-danger">{errors.end_date.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Motivo</label>
            <textarea className="input min-h-[80px]" placeholder="Opcional" {...register('reason')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
