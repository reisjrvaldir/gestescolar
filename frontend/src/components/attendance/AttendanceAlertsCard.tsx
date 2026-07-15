import { AlertTriangle, Loader2 } from 'lucide-react';
import type { TopAbsence } from '@/services/attendance';

interface Props {
  rows: TopAbsence[];
  loading: boolean;
}

export function AttendanceAlertsCard({ rows, loading }: Props) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <AlertTriangle size={16} className="text-danger" /> Alunos com mais faltas
      </div>
      {loading ? (
        <div className="flex justify-center py-8 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink-muted">Nenhuma falta registrada no período.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.student_id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-xs font-bold text-danger">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{r.student_name}</p>
                {r.class_name && <p className="truncate text-[11px] text-ink-subtle">{r.class_name}</p>}
              </div>
              <span className="shrink-0 rounded-lg bg-danger-soft px-2 py-1 text-xs font-bold text-danger">
                {r.absences} falta{r.absences !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-subtle">Entre em contato com os responsáveis para tratar a frequência.</p>
    </div>
  );
}
