import { useEffect, useState } from 'react';
import { Clock, LogIn, LogOut, Loader2, Check, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { listMyEntries, listAllEntries, clockIn, clockOut, type TimeclockEntry } from '@/services/timeclock';
import { useMe } from '@/auth/AuthGate';

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
  const isAdmin = me && ['school_admin', 'superadmin'].includes(me.role);

  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimeclockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  useEffect(() => { load(); }, [month]);

  async function load() {
    setLoading(true);
    try {
      setEntries(await listMyEntries(month));
      if (isAdmin) setAllEntries(await listAllEntries());
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const openEntry = entries.find((e) => !e.clock_out);

  async function onClockIn() {
    try {
      await clockIn();
      setToast({ type: 'success', msg: 'Entrada registrada com sucesso' });
      await load();
    } catch (e: any) {
      setToast({ type: 'error', msg: e?.message ?? 'Erro ao registrar entrada' });
    }
  }

  async function onClockOut() {
    try {
      await clockOut();
      setToast({ type: 'success', msg: 'Saída registrada com sucesso' });
      await load();
    } catch (e: any) {
      setToast({ type: 'error', msg: e?.message ?? 'Erro ao registrar saída' });
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + calcHoursNum(e), 0);
  const daysWorked = new Set(entries.map((e) => formatDate(e.clock_in))).size;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const displayEntries = tab === 'mine' ? entries : allEntries;

  // Agrupar por colaborador na aba "Todos"
  const groupedByUser = tab === 'all'
    ? allEntries.reduce<Record<string, { name: string; entries: TimeclockEntry[]; hours: number }>>((acc, e) => {
        const name = e.user_name ?? 'Sem nome';
        if (!acc[name]) acc[name] = { name, entries: [], hours: 0 };
        acc[name].entries.push(e);
        acc[name].hours += calcHoursNum(e);
        return acc;
      }, {})
    : {};

  return (
    <>
      <PageHeader
        title="Ponto"
        subtitle={isAdmin ? 'Gerencie os registros de ponto da equipe.' : 'Registre e acompanhe suas entradas e saídas.'}
        actions={
          <div className="flex items-center gap-2">
            <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
            {openEntry ? (
              <button className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 inline-flex items-center gap-1" onClick={onClockOut}>
                <LogOut size={16} /> Registrar saída
              </button>
            ) : (
              <button className="btn-primary" onClick={onClockIn}>
                <LogIn size={16} /> Registrar entrada
              </button>
            )}
          </div>
        }
      />

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <MetricCard label="Total de registros" value={String(entries.length)} icon={Clock} tone="primary" />
        <MetricCard label="Horas no mês" value={`${totalHours.toFixed(1)}h`} icon={Clock} tone="success" />
        <MetricCard label="Dias trabalhados" value={String(daysWorked)} icon={Clock} tone="primary" />
        <MetricCard
          label="Status atual"
          value={openEntry ? `Desde ${formatTime(openEntry.clock_in)}` : 'Fora do expediente'}
          icon={Clock}
          tone={openEntry ? 'warning' : 'primary'}
        />
      </div>

      {isAdmin && (
        <div className="mb-4 flex gap-2">
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'mine' ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`} onClick={() => setTab('mine')}>Meus registros</button>
          <button className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'all' ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas'}`} onClick={() => setTab('all')}>Todos (equipe)</button>
        </div>
      )}

      {tab === 'all' && Object.keys(groupedByUser).length > 0 ? (
        <div className="space-y-4">
          {Object.values(groupedByUser).sort((a, b) => a.name.localeCompare(b.name)).map((group) => (
            <div key={group.name} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-canvas px-4 py-2.5">
                <h3 className="text-sm font-bold text-ink">{group.name}</h3>
                <span className="text-xs text-ink-muted">{group.hours.toFixed(1)}h no período — {group.entries.length} registro(s)</span>
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
      ) : (
        <div className="card overflow-hidden">
          {displayEntries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhum registro"
              description="Registre sua primeira entrada para começar."
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
                {displayEntries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 text-ink-muted">{formatWeekday(e.clock_in)} {formatDate(e.clock_in)}</td>
                    <td className="px-4 py-3 font-mono text-ink-muted">{formatTime(e.clock_in)}</td>
                    <td className="px-4 py-3 font-mono text-ink-muted">{e.clock_out ? formatTime(e.clock_out) : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{calcHours(e)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={e.clock_out ? 'success' : 'warning'}>{e.clock_out ? 'Completo' : 'Aberto'}</StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
