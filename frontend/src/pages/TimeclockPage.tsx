import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Clock, LogIn, LogOut, Loader2, Check, AlertTriangle, Plus, Users, FileClock,
  CalendarClock, Download, PiggyBank, ClipboardCheck,
} from 'lucide-react';
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
/** 8.51 → "8h 31m"; -26.25 → "-26h 15m" */
function fmtHM(hours: number, withSign = false): string {
  const sign = hours < 0 ? '-' : withSign ? '+' : '';
  const abs = Math.abs(hours);
  let h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${sign}${h}h ${String(m).padStart(2, '0')}m`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type PeriodKind = 'month' | 'quarter' | 'semester' | 'year';
const PERIOD_LABELS: Record<PeriodKind, string> = {
  month: 'Mensal', quarter: 'Trimestral', semester: 'Semestral', year: 'Anual',
};

/** Intervalo do período a partir do tipo + mês de referência (YYYY-MM), limitado a hoje. */
function periodRange(kind: PeriodKind, refMonth: string): { from: string; to: string } {
  const [y, m] = refMonth.split('-').map(Number); // m: 1-12
  let from: Date; let to: Date;
  if (kind === 'month') { from = new Date(y, m - 1, 1); to = new Date(y, m, 0); }
  else if (kind === 'quarter') { const q = Math.floor((m - 1) / 3); from = new Date(y, q * 3, 1); to = new Date(y, q * 3 + 3, 0); }
  else if (kind === 'semester') { const s = m <= 6 ? 0 : 6; from = new Date(y, s, 1); to = new Date(y, s + 6, 0); }
  else { from = new Date(y, 0, 1); to = new Date(y, 11, 31); }
  const today = new Date();
  if (to > today) to = today;
  if (from > today) from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: ymd(from), to: ymd(to) };
}

export function TimeclockPage() {
  const me = useMe();
  const isAdmin = !!me && ['school_admin', 'superadmin'].includes(me.role);
  return isAdmin ? <AdminTimeclock /> : <MyTimeclock />;
}

// ═══════════════════════════ VISÃO GESTÃO ═══════════════════════════

type AdminTab = 'overview' | 'entries' | 'requests' | 'bank';

function AdminTimeclock() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [allEntries, setAllEntries] = useState<TimeclockEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [pending, setPending] = useState<PendingAdjustment[]>([]);
  const [report, setReport] = useState<TimeclockReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Período do banco de horas / espelho
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [refMonth, setRefMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const { from: repFrom, to: repTo } = periodRange(periodKind, refMonth);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    user_id: string; date: string; clock_in: string; clock_out: string; notes: string;
  }>();

  useEffect(() => { load(); }, []);
  useEffect(() => {
    timeclockReport(repFrom, repTo).then(setReport).catch(() => setReport([]));
  }, [repFrom, repTo]);

  async function load() {
    setLoading(true);
    try {
      const [all, staff, pend] = await Promise.all([
        listAllEntries(),
        api.get<{ data: StaffOption[] }>('/staff'),
        listPendingAdjustments(),
      ]);
      setAllEntries(all);
      setStaffList(staff.data);
      setPending(pend);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  async function onReview(id: string, action: 'approve' | 'reject') {
    try {
      await reviewAdjustment(id, action);
      showToast('success', action === 'approve' ? 'Solicitação aprovada.' : 'Solicitação recusada.');
      setPending(prev => prev.filter(p => p.id !== id));
      timeclockReport(repFrom, repTo).then(setReport).catch(() => {});
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao decidir.');
    }
  }

  async function onManualSubmit(data: { user_id: string; date: string; clock_in: string; clock_out: string; notes: string }) {
    setBusy(true);
    try {
      await createManualEntry({
        user_id: data.user_id, date: data.date, clock_in: data.clock_in,
        clock_out: data.clock_out || undefined, notes: data.notes || undefined,
      });
      const name = staffList.find(s => (s.user_id ?? s.id) === data.user_id)?.name ?? '';
      showToast('success', `Ponto lançado para ${name}.`);
      setManualOpen(false);
      reset();
      await load();
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao lançar ponto.');
    } finally { setBusy(false); }
  }

  function exportCsv() {
    const header = 'Funcionario;Cargo;Dias;Horas trabalhadas;Horas previstas;Saldo (banco)\n';
    const lines = report.map(r =>
      `${r.user_name};${r.position ?? ''};${r.days_worked};${r.total_hours.toFixed(2)};${r.expected_hours.toFixed(2)};${r.balance_hours.toFixed(2)}`,
    ).join('\n');
    const blob = new Blob(['﻿' + header + lines], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `espelho-ponto_${repFrom}_a_${repTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ───── Dados derivados ─────
  const todayStr = ymd(new Date());
  const yesterdayStr = ymd(new Date(Date.now() - 86400000));
  const entryDay = (e: TimeclockEntry) => ymd(new Date(e.clock_in));

  const todayEntries = allEntries.filter(e => entryDay(e) === todayStr);
  const yesterdayCount = allEntries.filter(e => entryDay(e) === yesterdayStr).length;
  const todayCount = todayEntries.length;
  const trendPct = yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : null;

  const openUsers = new Set(allEntries.filter(e => !e.clock_out).map(e => e.user_name)).size;
  const totalStaff = staffList.length;
  const onDutyPct = totalStaff > 0 ? Math.round((openUsers / totalStaff) * 100) : 0;

  const totalBalance = report.reduce((s, r) => s + r.balance_hours, 0);
  const positiveBalance = report.filter(r => r.balance_hours > 0).reduce((s, r) => s + r.balance_hours, 0);
  const negativeBalance = report.filter(r => r.balance_hours < 0).reduce((s, r) => s + r.balance_hours, 0);
  const topPositive = [...report].filter(r => r.balance_hours > 0).sort((a, b) => b.balance_hours - a.balance_hours).slice(0, 3);

  // Marcações do dia: agrupa por colaborador; 2+ batidas viram Entrada/Almoço/Retorno/Saída
  const todayRows = useMemo(() => {
    const byUser: Record<string, TimeclockEntry[]> = {};
    for (const e of todayEntries) {
      const k = e.user_name ?? '—';
      (byUser[k] ??= []).push(e);
    }
    return Object.entries(byUser).map(([name, list]) => {
      const sorted = [...list].sort((a, b) => a.clock_in.localeCompare(b.clock_in));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const hasLunch = sorted.length >= 2;
      const hours = sorted.reduce((s, e) => s + calcHoursNum(e), 0);
      const anyOpen = sorted.some(e => !e.clock_out);
      const anyPending = sorted.some(e => e.approval_status === 'pending');
      const status: 'open' | 'pending' | 'done' = anyOpen ? 'open' : anyPending ? 'pending' : 'done';
      return {
        name,
        position: report.find(r => r.user_name === name)?.position ?? '—',
        entrada: formatTime(first.clock_in),
        saidaAlmoco: hasLunch && first.clock_out ? formatTime(first.clock_out) : '—',
        retorno: hasLunch ? formatTime(sorted[1].clock_in) : '—',
        saida: last.clock_out ? formatTime(last.clock_out) : '—',
        horas: hours > 0 ? fmtHM(hours) : '—',
        status,
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [todayEntries, report]);

  // Resumo semanal: média de horas por colaborador em cada dia da semana atual (seg→dom)
  const weekBars = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    return labels.map((lbl, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = ymd(d);
      const dayEntries = allEntries.filter(e => entryDay(e) === dStr && e.clock_out);
      const users = new Set(dayEntries.map(e => e.user_name)).size;
      const total = dayEntries.reduce((s, e) => s + calcHoursNum(e), 0);
      const avg = users > 0 ? total / users : 0;
      return {
        label: `${lbl} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        hours: avg,
        future: d > now,
      };
    });
  }, [allEntries]);

  const ROW_STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'primary' }> = {
    done: { label: 'Em dia', tone: 'success' },
    open: { label: 'Em jornada', tone: 'primary' },
    pending: { label: 'Em análise', tone: 'warning' },
  };

  // Marcações (aba): agrupado por colaborador
  const groupedByUser = allEntries.reduce<Record<string, { name: string; entries: TimeclockEntry[]; hours: number }>>((acc, e) => {
    const name = e.user_name ?? 'Sem nome';
    if (!acc[name]) acc[name] = { name, entries: [], hours: 0 };
    acc[name].entries.push(e);
    acc[name].hours += calcHoursNum(e);
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  const TABS: { key: AdminTab; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Visão geral' },
    { key: 'entries', label: 'Marcações' },
    { key: 'requests', label: 'Solicitações', badge: pending.length || undefined },
    { key: 'bank', label: 'Banco de horas' },
  ];

  const pendingList = (limit?: number) => (
    <div className="divide-y divide-border">
      {(limit ? pending.slice(0, limit) : pending).map(p => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-purple/10 px-2 py-0.5 text-[10px] font-semibold text-purple">Ajuste de ponto</span>
              <p className="truncate text-sm font-medium text-ink">{p.user_name}</p>
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              {formatDate(p.clock_in)} · {formatTime(p.clock_in)}{p.clock_out ? `–${formatTime(p.clock_out)}` : ' (sem saída)'}
            </p>
            <p className="text-xs italic text-ink-subtle">"{p.justification}"</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button className="rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success hover:bg-success hover:text-white" onClick={() => onReview(p.id, 'approve')}>Aprovar</button>
            <button className="rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white" onClick={() => onReview(p.id, 'reject')}>Rejeitar</button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ═══ HERO ═══ */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-center justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Gestão de ponto</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Acompanhe marcações em tempo real, valide solicitações e tenha total controle do banco de horas da equipe.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
                onClick={() => { reset(); setManualOpen(true); }}
              >
                <Plus size={16} /> Lançar ponto
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/60 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-white"
                onClick={exportCsv}
              >
                <Download size={16} /> Exportar espelho
              </button>
            </div>
          </div>
          <div className="hidden shrink-0 sm:block">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
              <CalendarClock size={64} />
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ═══ ABAS + PERÍODO ═══ */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-border bg-surface p-1 shadow-card">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition ${
                tab === t.key ? 'bg-purple/10 text-purple' : 'text-ink-muted hover:text-ink'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border bg-surface p-1 shadow-card">
            {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map(k => (
              <button
                key={k}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  periodKind === k ? 'bg-purple/10 text-purple' : 'text-ink-muted hover:text-ink'
                }`}
                onClick={() => setPeriodKind(k)}
              >
                {PERIOD_LABELS[k]}
              </button>
            ))}
          </div>
          <input
            type="month"
            className="input w-auto py-2 text-sm"
            value={refMonth}
            max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
            onChange={e => e.target.value && setRefMonth(e.target.value)}
          />
        </div>
      </div>

      {/* ═══════════ VISÃO GERAL ═══════════ */}
      {tab === 'overview' && (
        <>
          {/* KPI CARDS */}
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="flex items-start gap-4 rounded-xl border border-purple/20 bg-purple/5 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple/10 text-purple"><Clock size={20} /></div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Marcações hoje</p>
                <p className="text-2xl font-extrabold text-ink">{todayCount}</p>
                {trendPct !== null ? (
                  <p className={`text-[11px] font-semibold ${trendPct >= 0 ? 'text-success' : 'text-danger'}`}>
                    {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct)}% vs. ontem
                  </p>
                ) : <p className="text-[11px] text-ink-subtle">sem base de comparação</p>}
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-warning/20 bg-warning-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning"><FileClock size={20} /></div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Solicitações pendentes</p>
                <p className="text-2xl font-extrabold text-warning">{pending.length}</p>
                <p className="text-[11px] text-ink-subtle">{pending.length > 0 ? 'aguardando sua ação' : 'nenhuma pendência'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Users size={20} /></div>
              <div className="flex flex-1 items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Em jornada agora</p>
                  <p className="text-2xl font-extrabold text-primary">{openUsers}</p>
                  <p className="text-[11px] text-ink-subtle">de {totalStaff} colaboradores</p>
                </div>
                <div className="relative h-12 w-12 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary/15" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary"
                      strokeDasharray={`${(onDutyPct / 100) * 94.2} 94.2`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-primary">{onDutyPct}%</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-xl border border-success/20 bg-success-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><PiggyBank size={20} /></div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Banco de horas</p>
                <p className={`text-2xl font-extrabold ${totalBalance >= 0 ? 'text-success' : 'text-danger'}`}>{fmtHM(totalBalance, true)}</p>
                <p className="text-[11px] text-ink-subtle">saldo geral no período</p>
              </div>
            </div>
          </div>

          {/* LAYOUT 70/30 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
            <div className="min-w-0 space-y-6">
              {/* Marcações do dia */}
              <div className="card overflow-hidden">
                <div className="border-b border-border px-5 py-3.5">
                  <h3 className="text-sm font-bold text-ink">Marcações do dia</h3>
                </div>
                {todayRows.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma marcação registrada hoje.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                          <th className="px-4 py-2.5">Colaborador</th>
                          <th className="px-4 py-2.5">Cargo</th>
                          <th className="px-4 py-2.5 text-center">Entrada</th>
                          <th className="px-4 py-2.5 text-center">Saída almoço</th>
                          <th className="px-4 py-2.5 text-center">Retorno</th>
                          <th className="px-4 py-2.5 text-center">Saída</th>
                          <th className="px-4 py-2.5 text-center">Horas</th>
                          <th className="px-4 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayRows.map(r => (
                          <tr key={r.name} className="border-b border-border last:border-0 hover:bg-canvas">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-purple/10 text-xs font-bold text-purple">
                                  {r.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                                </div>
                                <span className="font-medium text-ink">{r.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-ink-muted">{r.position}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-ink-muted">{r.entrada}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-ink-muted">{r.saidaAlmoco}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-ink-muted">{r.retorno}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-ink-muted">{r.saida}</td>
                            <td className="px-4 py-2.5 text-center font-mono font-bold text-ink">{r.horas}</td>
                            <td className="px-4 py-2.5 text-center">
                              <StatusBadge tone={ROW_STATUS[r.status].tone}>{ROW_STATUS[r.status].label}</StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {todayRows.length > 0 && (
                  <div className="border-t border-border bg-canvas px-4 py-2.5 text-xs text-ink-muted">
                    {todayRows.length} colaborador(es) com marcação hoje · {todayCount} batida(s)
                  </div>
                )}
              </div>

              {/* Resumo semanal */}
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-ink">Resumo semanal</h3>
                  <div className="flex items-center gap-4 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-purple" /> Média por colaborador</span>
                    <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink-muted" /> Meta diária (8h)</span>
                  </div>
                </div>
                <div className="relative">
                  {/* linha da meta */}
                  <div className="absolute inset-x-0 border-t-2 border-dashed border-ink-muted/40" style={{ bottom: `${(8 / 12) * 100}%` }} />
                  <div className="flex h-40 items-end justify-between gap-2">
                    {weekBars.map(b => (
                      <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-[10px] font-semibold text-ink-muted">{b.hours > 0 ? fmtHM(b.hours) : b.future ? '' : '0h'}</span>
                        <div
                          className={`w-3/5 max-w-[42px] rounded-t-lg ${b.hours >= 8 ? 'bg-purple' : b.hours > 0 ? 'bg-purple/70' : 'bg-canvas'}`}
                          style={{ height: `${Math.min((b.hours / 12) * 100, 100)}%`, minHeight: b.hours > 0 ? 6 : 2 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
                    {weekBars.map(b => (
                      <span key={b.label} className="flex-1 text-center text-[10px] text-ink-muted">{b.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SIDEBAR 30% */}
            <div className="space-y-4">
              {/* Solicitações pendentes */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">Solicitações pendentes</h3>
                  {pending.length > 0 && (
                    <button className="text-xs font-semibold text-purple hover:underline" onClick={() => setTab('requests')}>Ver todas</button>
                  )}
                </div>
                {pending.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-ink-subtle">Nenhuma solicitação pendente. ✓</p>
                ) : pendingList(4)}
              </div>

              {/* Banco de horas */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-bold text-ink">Banco de horas</h3>
                  <button className="text-xs font-semibold text-purple hover:underline" onClick={() => setTab('bank')}>Ver detalhes</button>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="px-4 py-3">
                    <p className="text-[11px] text-ink-muted">Saldo positivo</p>
                    <p className="text-lg font-extrabold text-success">{fmtHM(positiveBalance, true)}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[11px] text-ink-muted">Saldo negativo</p>
                    <p className="text-lg font-extrabold text-danger">{fmtHM(negativeBalance)}</p>
                  </div>
                </div>
                {topPositive.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Maiores saldos positivos</p>
                    <div className="space-y-2">
                      {topPositive.map((r, i) => (
                        <div key={r.user_id} className="flex items-center gap-2 text-sm">
                          <span className="w-4 text-xs font-bold text-ink-subtle">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{r.user_name}</span>
                          <span className="font-mono text-xs font-bold text-success">{fmtHM(r.balance_hours, true)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ações rápidas */}
              <div className="card p-4">
                <h3 className="mb-3 text-sm font-bold text-ink">Ações rápidas</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: ClipboardCheck, label: 'Validar solicitações', hint: 'Revise e aprove pendências', onClick: () => setTab('requests'), tone: 'bg-primary-soft/40 border-primary/20 text-primary' },
                    { icon: Download, label: 'Exportar espelho', hint: 'Gere o espelho da equipe', onClick: exportCsv, tone: 'bg-success-soft/40 border-success/20 text-success' },
                    { icon: Plus, label: 'Lançar ponto', hint: 'Marcação manual', onClick: () => { reset(); setManualOpen(true); }, tone: 'bg-warning-soft/40 border-warning/20 text-warning' },
                    { icon: PiggyBank, label: 'Banco de horas', hint: 'Saldo por colaborador', onClick: () => setTab('bank'), tone: 'bg-purple/5 border-purple/20 text-purple' },
                  ].map(a => (
                    <button key={a.label} className={`rounded-xl border p-3 text-left transition hover:shadow-card ${a.tone}`} onClick={a.onClick}>
                      <a.icon size={18} />
                      <p className="mt-1.5 text-xs font-bold text-ink">{a.label}</p>
                      <p className="text-[10px] leading-tight text-ink-muted">{a.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ MARCAÇÕES ═══════════ */}
      {tab === 'entries' && (
        Object.keys(groupedByUser).length === 0 ? (
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
            {Object.values(groupedByUser).sort((a, b) => a.name.localeCompare(b.name)).map(group => (
              <div key={group.name} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-canvas px-4 py-2.5">
                  <h3 className="text-sm font-bold text-ink">{group.name}</h3>
                  <span className="text-xs text-ink-muted">{fmtHM(group.hours)} no mês — {group.entries.length} registro(s)</span>
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
                    {group.entries.map(e => (
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
        )
      )}

      {/* ═══════════ SOLICITAÇÕES ═══════════ */}
      {tab === 'requests' && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <FileClock size={16} className="text-warning" />
            <h3 className="text-sm font-bold text-ink">Solicitações aguardando aprovação ({pending.length})</h3>
          </div>
          {pending.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Tudo em dia" description="Nenhuma solicitação pendente de aprovação." />
          ) : pendingList()}
        </div>
      )}

      {/* ═══════════ BANCO DE HORAS ═══════════ */}
      {tab === 'bank' && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Espelho de ponto · banco de horas</h3>
            <div className="flex items-center gap-3 text-xs text-ink-muted">
              <span>{formatDate(repFrom + 'T12:00:00')} — {formatDate(repTo + 'T12:00:00')}</span>
              <button className="inline-flex items-center gap-1 font-semibold text-purple hover:underline" onClick={exportCsv}>
                <Download size={13} /> CSV
              </button>
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
                  {report.map(r => (
                    <tr key={r.user_id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-4 py-2.5 font-medium text-ink">{r.user_name}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{r.position ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-ink-muted">{r.days_worked}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-ink">{fmtHM(r.total_hours)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-ink-muted">{fmtHM(r.expected_hours)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold">
                        <span className={r.balance_hours >= 0 ? 'text-success' : 'text-danger'}>{fmtHM(r.balance_hours, true)}</span>
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
      )}

      {/* ═══ MODAL LANÇAR PONTO ═══ */}
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
              {staffList.map(s => <option key={s.id} value={s.user_id ?? s.id}>{s.name}</option>)}
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

// ═══════════════════════════ VISÃO COLABORADOR ═══════════════════════════

function MyTimeclock() {
  const [entries, setEntries] = useState<TimeclockEntry[]>([]);
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  const { register: regAdj, handleSubmit: handleAdj, reset: resetAdj, formState: { errors: adjErrors } } = useForm<{
    date: string; clock_in: string; clock_out: string; justification: string;
  }>();

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  async function load() {
    setLoading(true);
    try {
      const [mine, open] = await Promise.all([listMyEntries(month), getOpenEntry()]);
      setEntries(mine);
      setOpenEntry(open);
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
      if (e?.code === 'outside_schedule') {
        resetAdj({ date: new Date().toISOString().slice(0, 10), clock_in: '', clock_out: '', justification: '' });
        setAdjOpen(true);
        showToast('error', e?.message ?? 'Fora do horário — registre como esquecimento.');
      } else {
        showToast('error', e?.message ?? 'Erro ao registrar entrada.');
      }
    } finally { setBusy(false); }
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

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const totalHours = entries.reduce((sum, e) => sum + calcHoursNum(e), 0);
  const daysWorked = new Set(entries.map(e => formatDate(e.clock_in))).size;

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
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

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
