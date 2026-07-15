import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { attendanceService, type TopAbsence } from '@/services/attendance';

const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

interface Props {
  classId: string;
}

export function AttendanceAlertsCard({ classId }: Props) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows]   = useState<TopAbsence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    attendanceService.topAbsences(classId, year, month, 5)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [classId, year, month]);

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <AlertTriangle size={16} className="text-danger" /> Ausências
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="rounded-lg border border-border p-1 hover:bg-canvas"
            title="Mês anterior"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="min-w-[7rem] text-center text-xs font-semibold text-ink">
            {PT_MONTHS[month - 1].slice(0, 3)} {year}
          </span>
          <button
            onClick={next}
            className="rounded-lg border border-border p-1 hover:bg-canvas"
            title="Próximo mês"
          >
            <ChevronRight size={13} />
          </button>
        </div>
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
