import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Clock, LogIn, LogOut, Loader2, Check, AlertTriangle, Plus, Users, X, FileClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import {
  listMyEntries, listAllEntries, clockIn, clockOut, getOpenEntry, createManualEntry,
  timeclockReport, submitAdjustment, listPendingAdjustments, reviewAdjustment,
  type TimeclockEntry, type OpenEntry, type TimeclockReportRow, type PendingAdjustment,
} from '@/services/timeclock';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';

interface StaffOption { id: string; name: string; user_id?: string }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function formatWeekday(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short' });
}
function calcHours(entry: TimeclockEntry) {
  if (!entry.clock_out) return '—';
  const diff = new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, '0')}`;
}
function calcHoursNum(entry: TimeclockEntry): number {
  if (!entry.clock_out) return 0;
  return (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000;
}

export function TimeclockPage() {
  const me = useMe();
  const isAdmin = !!me && ['school_admin', 'superadmin'].includes(me.role);

  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimeclockEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Espelho de ponto (gestão) — período padrão: mês corrente.
  const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
  const [repFrom, setRepFrom] = useState(monthStart());
  const [repTo, setRepTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<TimeclockReportRow[]>([]);

  // Esquecimento de ponto
  const [pending, setPending] = useState<PendingAdjustment[]>([]);      // gestão
  const [adjOpen, setAdjOpen] = useState(false);                        // colaborador
  const { register: regAdj, handleSubmit: handleAdj, reset: resetAdj, formState: { errors: adjErrors } } = useForm<{
    date: string; clock_in: string; clock_out: string; justification: string;
  }>();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    user_id: string; date: string; clock_in: string; clock_out: string; notes: string;
  }>();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month, isAdmin]);

  // Espelho de ponto: recarrega ao mudar o período (só gestão).
  useEffect(() => {
    if (!isAdmin) return;
    timeclockReport(repFrom, repTo).then(setReport).catch(() => setReport([]));
  }, [repFrom, repTo, isAdmin]);

  async function load() {
    setLoading(true);
    try {
      if (isAdmin) {
        const [all, staff, pend] = await Promise.all([
          listAllEntries(),
          api.get<{ data: StaffOption[] }>('/staff'),
          listPendingAdjustments(),
        ]);
        setAllEntries(all);
        setStaffList(staff.data);
        setPending(pend);
      } else {
        const [mine, open] = await Promise.all([listMyEntries(month), getOpenEntry()]);
        setEntries(mine);
        setOpenEntry(open);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  async function onClockIn() {
    setBusy(true);
    try {
      await clockIn();
      showToast('success', 'Entrada registrada com sucesso.');
      await load();
    } catch (e: any) {
      // Fora da janela da jornada → oferece registrar esquecimento (aprovação).
      if (e?.code === 'outside_schedule') {
        resetAdj({ date: new Date().toISOString().slice(0, 10), clock_in: '', clock_out: '', justification: '' });
        setAdjOpen(true);
        showToast('error', e?.message ?? 'Fora do horário — registre como esquecimento.');
      } else {
        showToast('error', e?.message ?? 'Erro ao registrar entrada.');
      }
    } finally { setBusy(false); }
  }

  async function onAdjSubmit(data: { date: string; clock_in: string; clock_out: string; justification: string }) {
    setBusy(true);
    try {
      await submitAdjustment({
        date: data.date, clock_in: data.clock_in,
        clock_out: data.clock_out || undefined, justification: data.justification,
      });
      showToast('success', 'Esquecimento enviado. Aguarde a aprovação da gestão.');
      setAdjOpen(false);
      resetAdj();
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar esquecimento.');
    } finally { setBusy(false); }
  }

  async function onReview(id: string, action: 'approve' | 'reject') {
    try {
      await reviewAdjustment(id, action);
      showToast('success', action === 'approve' ? 'Esquecimento aprovado.' : 'Esquecimento recusado.');
      setPending((prev) => prev.filter((p) => p.id !== id));
      // Atualiza o espelho (horas passam a contar após aprovar).
      timeclockReport(repFrom, repTo).then(setReport).catch(() => {});
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao decidir.');
    }
  }

  async function onClockOut() {
    setBusy(true);
    try {
      await clockOut();
      showToast('success', 'Saída registrada com sucesso.');
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao registrar saída.');
    } finally { setBusy(false); }
  }

  async function onManualSubmit(data: { user_id: string; date: string; clock_in: string; clock_out: string; notes: string }) {
    setBusy(true);
    try {
      await createManualEntry({
        user_id: data.user_id,
        date: data.date,
        clock_in: data.clock_in,
        clock_out: data.clock_out || undefined,
        notes: data.notes || undefined,
      });
      const name = staffList.find((s) => (s.user_id ?? s.id) === data.user_id)?.name ?? '';
      showToast('success', `Ponto lançado para ${name}.`);
      setManualOpen(false);
      reset();
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao lançar ponto.');
    } finally { setBusy(false); }
  }

  const toastEl = toast && (
    <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
      toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
    }`}>
      {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
      {toast.msg}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  // ==================== VISÃO GESTÃO ====================
  if (isAdmin) {
    const groupedByUser = allEntries.reduce<Record<string, { name: string; entries: TimeclockEntry[]; hours: number }>>((acc, e) => {
      const name = e.user_name ?? 'Sem nome';
      if (!acc[name]) acc[name] = { name, entries: [], hours: 0 };
      acc[name].entries.push(e);
      acc[name].hours += calcHoursNum(e);
      return acc;
    }, {});
    const openNow = allEntries.filter((e) => !e.clock_out).length;

    return (
      <>
        <PageHeader
          title="Ponto — Gestão"
          subtitle="Acompanhe as marcações da equipe e lance ponto manualmente quando necessário."
          actions={
            <button className="btn-primary" onClick={() => { reset(); setManualOpen(true); }}>
              <Plus size={16} /> Lançar ponto
            </button>
          }
        />
        {toastEl}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Registros no mês" value={String(allEntries.length)} icon={Clock} tone="primary" />
          <MetricCard label="Colaboradores com ponto" value={String(Object.keys(groupedByUser).length)} icon={Users} tone="success" />
          <MetricCard label="Em aberto agora" value={String(openNow)} icon={Clock} tone={openNow > 0 ? 'warning' : 'primary'} />
        </div>

        {/* Espelho de ponto — total de horas por funcionário no período */}
        <div className="card mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Espelho de ponto</h3>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-ink-muted">De</label>
              <input type="date" className="input w-auto py-1.5" value={repFrom} max={repTo} onChange={(e) => setRepFrom(e.target.value)} />
              <label className="text-ink-muted">até</label>
              <input type="date" className="input w-auto py-1.5" value={repTo} min={repFrom} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setRepTo(e.target.value)} />
            </div>
          </div>
          {report.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhuma marcação no período selecionado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                    <th className="px-4 py-2.5">Funcionário</th>
                    <th className="px-4 py-2.5">Cargo</th>
                    <th className="px-4 py-2.5 text-center">Dias</th>
                    <th className="px-4 py-2.5 text-right">Trabalhadas</th>
                    <th className="px-4 py-2.5 text-right">Previstas</th>
                    <th className="px-4 py-2.5 text-right">Saldo (banco)</th>
                    <th className="px-4 py-2.5 text-center">Pendências</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.user_id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-4 py-2.5 font-medium text-ink">{r.user_name}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.position ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-ink-muted">{r.days_worked}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-ink">{r.total_hours.toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right font-mono text-ink-muted">{r.expected_hours.toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        <span className={r.balance_hours >= 0 ? 'text-success' : 'text-danger'}>
                          {r.balance_hours >= 0 ? '+' : ''}{r.balance_hours.toFixed(1)}h
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.pending_adjustments > 0
                          ? <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">{r.pending_adjustments}</span>
                          : <span className="text-ink-subtle">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Esquecimentos aguardando aprovação */}
        {pending.length > 0 && (
          <div className="card mb-6 overflow-hidden border-warning/40">
            <div className="flex items-center gap-2 border-b border-border bg-warning-soft px-5 py-3">
              <FileClock size={16} className="text-warning" />
              <h3 className="text-sm font-bold text-warning">Esquecimentos aguardando aprovação ({pending.length})</h3>
            </div>
            <div className="divide-y divide-border">
              {pending.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{p.user_name}</p>
                    <p className="text-xs text-ink-muted">
                      {formatWeekday(p.clock_in)} {formatDate(p.clock_in)} · {formatTime(p.clock_in)}
                      {p.clock_out ? `–${formatTime(p.clock_out)}` : ' (sem saída)'}
                    </p>
                    <p className="mt-0.5 text-xs italic text-ink-subtle">"{p.justification}"</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success hover:bg-success hover:text-white" onClick={() => onReview(p.id, 'approve')}>
                      <Check size={13} /> Aprovar
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white" onClick={() => onReview(p.id, 'reject')}>
                      <X size={13} /> Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(groupedByUser).length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Clock}
              title="Nenhuma marcação neste mês"
              description="Os pontos registrados pela equipe aparecerão aqui. Você também pode lançar um ponto manualmente."
              action={<button className="btn-primary" onClick={() => { reset(); setManualOpen(true); }}><Plus size={16} /> Lançar ponto</button>}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(groupedByUser).sort((a, b) => a.name.localeCompare(b.name)).map((group) => (
              <div key={group.name} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-canvas px-4 py-2.5">
                  <h3 className="text-sm font-bold text-ink">{group.name}</h3>
                  <span className="text-xs text-ink-muted">{group.hours.toFixed(1)}h no mês — {group.entries.length} registro(s)</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-2">Data</th>
                      <th className="px-4 py-2">Entrada</th>
                      <th className="px-4 py-2">Saída</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas">
                        <td className="px-4 py-2 text-ink-muted">{formatWeekday(e.clock_in)} {formatDate(e.clock_in)}</td>
                        <td className="px-4 py-2 font-mono text-ink-muted">{formatTime(e.clock_in)}</td>
                        <td className="px-4 py-2 font-mono text-ink-muted">{e.clock_out ? formatTime(e.clock_out) : '—'}</td>
                        <td className="px-4 py-2 font-semibold text-ink">{calcHours(e)}</td>
                        <td className="px-4 py-2">
                          <StatusBadge tone={e.clock_out ? 'success' : 'warning'}>{e.clock_out ? 'Completo' : 'Aberto'}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={manualOpen}
          title="Lançar ponto manualmente"
          onClose={() => { reset(); setManualOpen(false); }}
          footer={
            <>
              <button className="btn-outline" onClick={() => { reset(); setManualOpen(false); }}>Cancelar</button>
              <button className="btn-primary" form="manual-form" type="submit" disabled={busy}>
                {busy && <Loader2 size={16} className="animate-spin" />} Lançar
              </button>
            </>
          }
        >
          <form id="manual-form" className="space-y-4" onSubmit={handleSubmit(onManualSubmit)}>
            <div>
              <label className="label">Colaborador *</label>
              <select className="input" {...register('user_id', { required: 'Selecione o colaborador' })}>
                <option value="">Selecione…</option>
                {staffList.map((s) => <option key={s.id} value={s.user_id ?? s.id}>{s.name}</option>)}
              </select>
              {errors.user_id && <p className="mt-1 text-xs text-danger">{errors.user_id.message}</p>}
            </div>
            <div>
              <label className="label">Data *</label>
              <input type="date" className="input" {...register('date', { required: 'Informe a data' })} />
              {errors.date && <p className="mt-1 text-xs text-danger">{errors.date.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Entrada *</label>
                <input type="time" className="input" {...register('clock_in', { required: 'Informe a entrada' })} />
                {errors.clock_in && <p className="mt-1 text-xs text-danger">{errors.clock_in.message}</p>}
              </div>
              <div>
                <label className="label">Saída</label>
                <input type="time" className="input" {...register('clock_out')} />
                <p className="mt-1 text-xs text-ink-muted">Opcional (deixe vazio se em aberto).</p>
              </div>
            </div>
            <div>
              <label className="label">Observação</label>
              <input className="input" placeholder="Ex.: ajuste de marcação, esquecimento" {...register('notes')} />
            </div>
          </form>
        </Modal>
      </>
    );
  }

  // ==================== VISÃO COLABORADOR (professor) ====================
  const totalHours = entries.reduce((sum, e) => sum + calcHoursNum(e), 0);
  const daysWorked = new Set(entries.map((e) => formatDate(e.clock_in))).size;

  return (
    <>
      <PageHeader
        title="Meu Ponto"
        subtitle="Registre e acompanhe suas entradas e saídas."
        actions={
          <div className="flex items-center gap-2">
            <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button
              className="btn-outline inline-flex items-center gap-1 text-sm"
              onClick={() => { resetAdj({ date: new Date().toISOString().slice(0, 10), clock_in: '', clock_out: '', justification: '' }); setAdjOpen(true); }}
              disabled={busy}
            >
              <FileClock size={16} /> Esquecimento
            </button>
            {openEntry ? (
              <button className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 inline-flex items-center gap-1 disabled:opacity-50" onClick={onClockOut} disabled={busy}>
                <LogOut size={16} /> Registrar saída
              </button>
            ) : (
              <button className="btn-primary" onClick={onClockIn} disabled={busy}>
                <LogIn size={16} /> Registrar entrada
              </button>
            )}
          </div>
        }
      />
      {toastEl}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricCard label="Registros no mês" value={String(entries.length)} icon={Clock} tone="primary" />
        <MetricCard label="Horas no mês" value={`${totalHours.toFixed(1)}h`} icon={Clock} tone="success" />
        <MetricCard label="Dias trabalhados" value={String(daysWorked)} icon={Clock} tone="primary" />
        <MetricCard
          label="Status atual"
          value={openEntry ? `Desde ${formatTime(openEntry.clock_in)}` : 'Fora do expediente'}
          icon={Clock}
          tone={openEntry ? 'warning' : 'primary'}
        />
      </div>

      <div className="card overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Nenhum registro"
            description="Registre sua entrada para começar. É necessário ter uma jornada cadastrada pela gestão."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Saída</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const adj = e.is_adjustment;
                const st = e.approval_status;
                return (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 text-ink-muted">
                      {formatWeekday(e.clock_in)} {formatDate(e.clock_in)}
                      {adj && <span className="ml-1 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">esquecimento</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-muted">{formatTime(e.clock_in)}</td>
                    <td className="px-4 py-3 font-mono text-ink-muted">{e.clock_out ? formatTime(e.clock_out) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{calcHours(e)}</td>
                    <td className="px-4 py-3">
                      {adj && st === 'pending' ? (
                        <StatusBadge tone="warning">Aguardando aprovação</StatusBadge>
                      ) : adj && st === 'rejected' ? (
                        <StatusBadge tone="danger">Recusado</StatusBadge>
                      ) : adj && st === 'approved' ? (
                        <StatusBadge tone="success">Aprovado</StatusBadge>
                      ) : (
                        <StatusBadge tone={e.clock_out ? 'success' : 'warning'}>{e.clock_out ? 'Completo' : 'Aberto'}</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal — registrar esquecimento de ponto */}
      <Modal
        open={adjOpen}
        title="Registrar esquecimento de ponto"
        onClose={() => { resetAdj(); setAdjOpen(false); }}
        footer={
          <>
            <button className="btn-outline" onClick={() => { resetAdj(); setAdjOpen(false); }}>Cancelar</button>
            <button className="btn-primary flex items-center gap-2" form="adj-form" type="submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileClock size={16} />} Enviar para aprovação
            </button>
          </>
        }
      >
        <form id="adj-form" className="space-y-4" onSubmit={handleAdj(onAdjSubmit)}>
          <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>Use quando bateu fora do horário da jornada ou esqueceu de registrar. Fica pendente até a gestão aprovar — não vence.</span>
          </div>
          <div>
            <label className="label">Data *</label>
            <input type="date" className="input" max={new Date().toISOString().slice(0, 10)} {...regAdj('date', { required: 'Informe a data' })} />
            {adjErrors.date && <p className="mt-1 text-xs text-danger">{adjErrors.date.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Entrada *</label>
              <input type="time" className="input" {...regAdj('clock_in', { required: 'Informe a entrada' })} />
              {adjErrors.clock_in && <p className="mt-1 text-xs text-danger">{adjErrors.clock_in.message}</p>}
            </div>
            <div>
              <label className="label">Saída</label>
              <input type="time" className="input" {...regAdj('clock_out')} />
            </div>
          </div>
          <div>
            <label className="label">Motivo *</label>
            <input className="input" placeholder="Ex.: esqueci de bater a saída; cheguei antes do horário" {...regAdj('justification', { required: 'Descreva o motivo' })} />
            {adjErrors.justification && <p className="mt-1 text-xs text-danger">{adjErrors.justification.message}</p>}
          </div>
        </form>
      </Modal>
    </>
  );
}
