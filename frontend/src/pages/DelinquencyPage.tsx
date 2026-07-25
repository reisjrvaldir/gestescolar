import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, AlertTriangle, Download, CheckCircle2, Search,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { financeService, type DelinquentInvoice } from '@/services/finance';
import { brl } from '@/lib/fees';
import { fmtDate } from '@/lib/dates';

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DelinquencyPage() {
  const [rows, setRows] = useState<DelinquentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setRows(await financeService.delinquency()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((d) =>
      d.student_name.toLowerCase().includes(q) ||
      (d.guardian_name ?? '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totalAmount = useMemo(() => rows.reduce((s, d) => s + Number(d.amount), 0), [rows]);
  const avgDays = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round(rows.reduce((s, d) => s + d.days_late, 0) / rows.length);
  }, [rows]);

  function exportData() {
    if (rows.length === 0) return;
    downloadCsv(
      `inadimplentes-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Aluno', 'Responsável', 'Plano', 'Valor', 'Vencimento', 'Dias em atraso'],
      rows.map((d) => [d.student_name, d.guardian_name ?? '', d.plan_name ?? '', d.amount.toFixed(2), d.due_date ?? '', d.days_late]),
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-danger-soft to-danger-soft/40 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Inadimplência</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Monitore os alunos com pagamentos em atraso e acompanhe a recuperação financeira.
            </p>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white/40 text-danger shadow-inner">
              <AlertTriangle size={64} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Valor em atraso" value={brl(totalAmount)} tone="danger" />
        <KpiCard label="Alunos inadimplentes" value={rows.length.toString()} tone="warning" />
        <KpiCard label="Atraso médio" value={`${avgDays} dias`} tone="primary" />
        <KpiCard label="Faturas vencidas" value={rows.length.toString()} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna principal ===== */}
        <div className="min-w-0 space-y-4">
          {/* Filtros */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input className="input pl-9" placeholder="Buscar aluno ou responsável…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                onClick={exportData}
              >
                <Download size={14} /> Exportar
              </button>
            </div>
          </div>

          {/* Tabela */}
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
                <CheckCircle2 size={28} className="text-success" />
                <p className="text-sm font-medium text-ink">Nenhum aluno inadimplente</p>
                <p className="text-xs text-ink-muted">Todas as mensalidades estão em dia.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-3">Aluno</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Plano</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-center">Dias em atraso</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const risk = d.days_late >= 30 ? 'danger' : d.days_late >= 15 ? 'warning' : 'primary';
                      return (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-canvas">
                          <td className="px-4 py-3 font-medium text-ink">{d.student_name}</td>
                          <td className="px-4 py-3 text-ink-muted">{d.guardian_name ?? '—'}</td>
                          <td className="px-4 py-3 text-ink-muted">{d.plan_name ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink">{brl(d.amount)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{fmtDate(d.due_date)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              risk === 'danger' ? 'bg-danger-soft text-danger' :
                              risk === 'warning' ? 'bg-warning-soft text-warning' :
                              'bg-primary-soft text-primary'
                            }`}>
                              {d.days_late}
                            </span>
                          </td>
                          <td className="px-4 py-3"><StatusBadge tone="danger">Em atraso</StatusBadge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="border-t border-border px-4 py-3 text-xs text-ink-muted">
                Mostrando {filtered.length} de {rows.length} inadimplente(s)
              </div>
            )}
          </div>
        </div>

        {/* ===== Sidebar ===== */}
        <div className="space-y-4">
          <div className="card p-5">
            <p className="mb-3 text-sm font-bold text-ink">Resumo da inadimplência</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Valor em atraso</span><span className="font-semibold text-danger">{brl(totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Alunos inadimplentes</span><span className="font-medium text-ink">{rows.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Atraso médio</span><span className="font-medium text-ink">{avgDays} dias</span></div>
            </div>
          </div>

          {/* Top devedores */}
          {rows.length > 0 && (
            <div className="card p-5">
              <p className="mb-3 text-sm font-bold text-ink">Top devedores</p>
              <div className="space-y-2">
                {rows.slice(0, 5).map((d, i) => (
                  <div key={d.id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-[10px] font-bold text-danger">{i + 1}</span>
                    <span className="flex-1 truncate text-ink">{d.student_name}</span>
                    <span className="font-semibold text-danger">{brl(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'success' | 'warning' | 'danger' }) {
  const bg: Record<typeof tone, string> = {
    primary: 'border-primary/20 bg-primary-soft/30',
    success: 'border-success/20 bg-success-soft/30',
    warning: 'border-warning/20 bg-warning-soft/30',
    danger: 'border-danger/20 bg-danger-soft/30',
  };
  const text: Record<typeof tone, string> = { primary: 'text-primary', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
  return (
    <div className={`rounded-xl border p-5 ${bg[tone]}`}>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${text[tone]}`}>{value}</p>
    </div>
  );
}
