import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Upload, Loader2, FileText, Clock, Check, X, Paperclip,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  attendanceService, type MyChild, type MyAttestation,
  type MyCalendarDay, type MySummary, type AttendanceStatus,
} from '@/services/attendance';
import { api } from '@/lib/api';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_INFO: Record<MyAttestation['status'], { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: 'Aguardando análise', cls: 'bg-warning-soft text-warning', icon: Clock },
  approved: { label: 'Aprovado',           cls: 'bg-success-soft text-success', icon: Check },
  rejected: { label: 'Recusado',           cls: 'bg-danger-soft text-danger',   icon: X },
};

const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DAY_COLORS: Record<AttendanceStatus, string> = {
  present:   'bg-success-soft text-success',
  absent:    'bg-danger-soft text-danger',
  justified: 'bg-warning-soft text-warning',
  attested:  'bg-primary-soft text-primary',
  excused:   'bg-primary-soft text-primary',
};

interface ChildStat {
  id: string;
  name: string;
  registration_number: string;
  monthly_fee: number;
  photo_url?: string;
  class_name?: string;
  class_year?: number;
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

export function GuardianAttestations() {
  const [children, setChildren] = useState<MyChild[]>([]);
  const [childStats, setChildStats] = useState<ChildStat | null>(null);
  const [items, setItems] = useState<MyAttestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calDays, setCalDays] = useState<MyCalendarDay[]>([]);
  const [summary, setSummary] = useState<MySummary | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([attendanceService.myChildren(), attendanceService.myAttestations()]);
      setChildren(c);
      setItems(a);
      if (c.length > 0 && !studentId) setStudentId(c[0].student_id);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  async function loadCalendar() {
    if (!studentId) return;
    try {
      const [cal, sum] = await Promise.all([
        attendanceService.myCalendar(studentId, calYear, calMonth),
        attendanceService.mySummary(studentId),
      ]);
      setCalDays(cal);
      setSummary(sum);
    } catch { /* */ }
  }

  async function loadChildStats() {
    if (!studentId) return;
    try {
      const r = await api.get<{ ok: boolean; data: any }>('/dashboard/stats');
      const child = r.data.children?.find((c: any) => c.id === studentId);
      if (child) setChildStats(child);
    } catch { /* */ }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCalendar(); loadChildStats(); }, [studentId, calYear, calMonth]);

  function prevMonth() {
    if (calMonth === 1) { setCalMonth(12); setCalYear(calYear - 1); }
    else setCalMonth(calMonth - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalMonth(1); setCalYear(calYear + 1); }
    else setCalMonth(calMonth + 1);
  }

  function openModal() {
    setError(null);
    setFile(null);
    if (children.length > 0) setStudentId(children[0].student_id);
    setDate(new Date().toISOString().slice(0, 10));
    setOpen(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Envie apenas arquivos PDF.'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('O PDF deve ter no máximo 5 MB.'); return; }
    setError(null);
    setFile(f);
  }

  async function submit() {
    if (!studentId || !file) { setError('Selecione o aluno e o PDF do atestado.'); return; }
    setSending(true);
    setError(null);
    try {
      const b64 = await toBase64(file);
      await attendanceService.uploadMyAttestation({
        student_id: studentId,
        date,
        filename: file.name,
        file_size: file.size,
        file_data: b64,
      });
      setOpen(false);
      await load();
      await loadCalendar();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao enviar o atestado. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  // Build calendar grid
  const calendarGrid = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1);
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const startWeekday = first.getDay();
    const dayMap: Record<string, AttendanceStatus> = {};
    for (const d of calDays) dayMap[d.date] = d.status;
    const cells: { day: number; date: string; status?: AttendanceStatus }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ day: 0, date: '' });
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: ds, status: dayMap[ds] });
    }
    return cells;
  }, [calDays, calYear, calMonth]);

  // Pie chart data
  const pieData = useMemo(() => {
    if (!summary) return [];
    return [
      { label: 'Presenças', value: summary.present, color: '#22c55e' },
      { label: 'Faltas', value: summary.absent, color: '#ef4444' },
      { label: 'Justificadas', value: summary.justified, color: '#eab308' },
      { label: 'Atestados', value: summary.attested + summary.excused, color: '#3b82f6' },
    ].filter(d => d.value > 0);
  }, [summary]);

  const totalPie = pieData.reduce((s, d) => s + d.value, 0);
  const freqPercent = summary && (summary.present + summary.justified + summary.excused + summary.attested) > 0
    ? Math.round(((summary.present + summary.justified + summary.excused + summary.attested) / (summary.present + summary.absent + summary.justified + summary.attested + summary.excused)) * 100)
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  if (children.length === 0) {
    return (
      <>
        <PageHeader title="Presenças" subtitle="Frequência e atestados" />
        <div className="card"><EmptyState icon={FileText} title="Nenhum aluno vinculado" description="Não encontramos alunos vinculados a este responsável." /></div>
      </>
    );
  }

  const absentsMonth = summary?.absent ?? 0;

  return (
    <>
      <PageHeader
        title="Presenças"
        subtitle="Frequência e atestados do(s) seu(s) filho(s)."
      />

      {/* Student header */}
      {childStats && (
        <div className="card mb-6 p-5">
          <div className="flex items-center gap-4">
            {childStats.photo_url ? (
              <img src={childStats.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
                {initials(childStats.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-ink">{childStats.name}</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span>Matrícula: <span className="font-mono font-semibold">{childStats.registration_number}</span></span>
                {childStats.class_name && <span>Turma: <strong>{childStats.class_name}</strong></span>}
                {childStats.class_year && <span>Ano letivo: <strong>{childStats.class_year}</strong></span>}
              </div>
            </div>
            {children.length > 1 && (
              <select className="input w-auto" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {children.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* 3 Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-ink-muted">Presenças no mês</p>
          <p className="mt-1 text-2xl font-extrabold text-success">{summary?.present ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink-muted">Faltas justificadas</p>
          <p className="mt-1 text-2xl font-extrabold text-warning">{(summary?.justified ?? 0) + (summary?.attested ?? 0) + (summary?.excused ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-ink-muted">Faltas s/ justificativa</p>
          <p className="mt-1 text-2xl font-extrabold text-danger">{summary?.absent ?? 0}</p>
        </div>
      </div>

      {/* Main content 70/30 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* Left: calendar + chart */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Calendar */}
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={prevMonth} className="rounded-lg p-1 hover:bg-canvas"><ChevronLeft size={18} /></button>
                <h3 className="text-sm font-bold text-ink">{PT_MONTHS[calMonth - 1]} {calYear}</h3>
                <button onClick={nextMonth} className="rounded-lg p-1 hover:bg-canvas"><ChevronRight size={18} /></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {PT_WEEKDAYS.map(w => <div key={w} className="py-1 font-semibold text-ink-muted">{w}</div>)}
                {calendarGrid.map((cell, i) => (
                  <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium mx-auto ${
                    cell.day === 0 ? '' : cell.status ? DAY_COLORS[cell.status] : 'text-ink-subtle'
                  }`}>
                    {cell.day > 0 ? cell.day : ''}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-success-soft" /> Presença</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-danger-soft" /> Falta</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-warning-soft" /> Justificada</span>
                <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-primary-soft" /> Atestado</span>
              </div>
            </div>

            {/* Pie chart */}
            <div className="card flex flex-col items-center justify-center p-5">
              <h3 className="mb-4 text-sm font-bold text-ink">Distribuição de frequência</h3>
              {totalPie === 0 ? (
                <p className="text-sm text-ink-subtle">Sem dados no mês.</p>
              ) : (
                <>
                  <svg viewBox="0 0 200 200" className="h-40 w-40">
                    {(() => {
                      let cumulative = 0;
                      return pieData.map((d, i) => {
                        const pct = d.value / totalPie;
                        const startAngle = cumulative * 360;
                        cumulative += pct;
                        const endAngle = cumulative * 360;
                        const largeArc = pct > 0.5 ? 1 : 0;
                        const r = 80;
                        const cx = 100, cy = 100;
                        const x1 = cx + r * Math.cos((startAngle - 90) * Math.PI / 180);
                        const y1 = cy + r * Math.sin((startAngle - 90) * Math.PI / 180);
                        const x2 = cx + r * Math.cos((endAngle - 90) * Math.PI / 180);
                        const y2 = cy + r * Math.sin((endAngle - 90) * Math.PI / 180);
                        if (pieData.length === 1) {
                          return <circle key={i} cx={cx} cy={cy} r={r} fill={d.color} opacity={0.8} />;
                        }
                        return (
                          <path key={i}
                            d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
                            fill={d.color} opacity={0.8}
                          />
                        );
                      });
                    })()}
                    <circle cx={100} cy={100} r={45} fill="var(--color-surface, white)" />
                    <text x={100} y={105} textAnchor="middle" className="text-lg font-bold" fill="var(--color-ink, #1a1a1a)" fontSize="24">{freqPercent}%</text>
                  </svg>
                  <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
                    {pieData.map((d) => (
                      <span key={d.label} className="flex items-center gap-1">
                        <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: d.color }} />
                        {d.label} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Button: enviar atestado */}
          <button className="btn-primary w-full justify-center" onClick={openModal}>
            <Upload size={16} /> Enviar atestado ou justificativa
          </button>
        </div>

        {/* Right sidebar 30% */}
        <div className="space-y-4">
          {/* Resumo de frequência */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Resumo de frequência</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-muted">Total de aulas</span><span className="font-bold text-ink">{summary?.total_school_days ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Presenças</span><span className="font-bold text-success">{summary?.present ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Faltas</span><span className="font-bold text-danger">{summary?.absent ?? 0}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Justificadas</span><span className="font-bold text-warning">{(summary?.justified ?? 0) + (summary?.attested ?? 0) + (summary?.excused ?? 0)}</span></div>
              <div className="flex justify-between border-t border-border pt-2"><span className="font-semibold text-ink">Frequência</span><span className="font-extrabold text-ink">{freqPercent}%</span></div>
            </div>
          </div>

          {/* Alerta de faltas */}
          {absentsMonth > 5 && (
            <div className="card border-danger/30 bg-danger-soft p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-bold text-danger">Alerta de faltas</p>
                  <p className="text-xs text-danger/80">Seu filho(a) possui {absentsMonth} faltas não justificadas neste mês. Considere enviar uma justificativa.</p>
                </div>
              </div>
            </div>
          )}

          {/* Acompanhamento de atestados */}
          <div className="card overflow-hidden">
            <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Atestados enviados</div>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-ink-subtle">Nenhum atestado enviado.</div>
            ) : (
              <div className="divide-y divide-border">
                {items.slice(0, 5).map((it) => {
                  const info = STATUS_INFO[it.status];
                  const Icon = info.icon;
                  return (
                    <div key={it.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">{it.student_name}</p>
                        <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${info.cls}`}>
                          <Icon size={10} /> {info.label}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted">
                        {new Date(it.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {it.filename}
                      </p>
                      {it.status === 'rejected' && it.review_note && (
                        <p className="mt-0.5 text-[11px] text-danger">Motivo: {it.review_note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal enviar atestado */}
      <Modal
        open={open}
        title="Enviar atestado ou justificativa"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={sending || !file}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Enviar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Aluno</label>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {children.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data da falta</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Arquivo PDF (máx. 5 MB)</label>
            <button type="button" className="btn-outline w-full justify-center" onClick={() => fileRef.current?.click()}>
              <Paperclip size={14} /> {file ? file.name : 'Selecionar PDF'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            {file && <p className="mt-1 text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          <p className="text-xs text-ink-subtle">
            O atestado ficará "Aguardando análise" até a gestão da escola aprovar ou recusar.
          </p>
        </div>
      </Modal>
    </>
  );
}
