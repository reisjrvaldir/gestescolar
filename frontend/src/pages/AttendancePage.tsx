import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ClipboardCheck, Save, Check, Loader2, AlertTriangle,
  Lock, ChevronLeft, ChevronRight, CheckCircle2,
  Paperclip, FileText, Download, ShieldCheck, CalendarDays,
  Users, UserMinus, FileCheck2, BarChart3,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { AttendanceSummaryChart } from '@/components/attendance/AttendanceSummaryChart';
import { AttendanceAlertsCard } from '@/components/attendance/AttendanceAlertsCard';
import { ApprovalQueue } from '@/components/attendance/ApprovalQueue';
import { GuardianAttestations } from '@/components/attendance/GuardianAttestations';
import { classesService, type ClassSubject } from '@/services/classes';
import {
  attendanceService, type AttendanceStatus, type AttendanceRow, type CalendarDay,
  type SchoolEvent,
} from '@/services/attendance';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; short: string; on: string; off: string }[] = [
  { value: 'present',   label: 'Presença',         short: 'P', on: 'bg-success text-white',  off: 'text-ink-muted hover:bg-success-soft' },
  { value: 'absent',    label: 'Falta',             short: 'F', on: 'bg-danger text-white',   off: 'text-ink-muted hover:bg-danger-soft' },
  { value: 'justified', label: 'F. Justificada',    short: 'J', on: 'bg-warning text-white',  off: 'text-ink-muted hover:bg-warning-soft' },
  { value: 'attested',  label: 'Atestado Médico',   short: 'A', on: 'bg-primary text-white',  off: 'text-ink-muted hover:bg-primary-soft' },
];

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  present:   'bg-success-soft text-success font-bold',
  absent:    'bg-danger-soft text-danger font-bold',
  justified: 'bg-warning-soft text-warning font-bold',
  attested:  'bg-primary-soft text-primary font-bold',
  excused:   'bg-purple-soft text-purple font-bold',
};

const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface EntryState {
  student_id: string;
  student_name: string;
  registration_number?: string;
  status: AttendanceStatus;
  justification?: string;
  confirmed: boolean;
  attestationFile?: File;
  attestationUploaded?: boolean;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AttendancePage() {
  const me = useMe();
  if (me?.role === 'guardian') return <GuardianAttestations />;
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin';
  const isTeacher = me?.role === 'teacher';
  return <TeacherAttendanceView isAdmin={isAdmin} isTeacher={isTeacher} />;
}

function TeacherAttendanceView({ isAdmin, isTeacher }: { isAdmin: boolean; isTeacher: boolean }) {
  const location = useLocation();
  const nav = useNavigate();
  const view = location.pathname.endsWith('/calendar') ? 'status' :
               location.pathname.endsWith('/approvals') ? 'aprovar' : 'chamada';
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([]);

  // Resumo diário da coluna lateral — calculado direto dos entries (sem fetch adicional)

  // Painel do dia — abre ao clicar num dia com chamada registrada no calendário
  const [dayModal, setDayModal] = useState<{ date: string; rows: AttendanceRow[] } | null>(null);
  const [dayModalLoading, setDayModalLoading] = useState(false);
  const [dayPdfMap, setDayPdfMap] = useState<Record<string, { loading: boolean; fileData: string | null }>>({});

  // Refs para file inputs (um por aluno)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const load = isTeacher ? classesService.mine() : classesService.list();
    load.then((c) => {
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
      setLoading(false);
    });
  }, [isTeacher]);

  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(''); return; }
    setSubjectId('');
    classesService.subjects(classId).then((allSubs) => {
      if (isTeacher) {
        const cls = classes.find((c) => c.id === classId);
        // Professor não-regente com matérias atribuídas: mostra só as dele
        if (cls && !cls.is_regente && cls.my_subject_ids?.length) {
          setSubjects(allSubs.filter((s) => cls.my_subject_ids!.includes(s.id)));
          return;
        }
      }
      setSubjects(allSubs);
    }).catch(() => setSubjects([]));
  }, [classId, isTeacher, classes]);

  const loadContext = useCallback(async () => {
    if (!classId) return;
    const [stuRes, attResult] = await Promise.all([
      api.get<{ ok: boolean; data: Student[] }>(`/students?class_id=${classId}`),
      attendanceService.forContext(classId, date, subjectId || undefined),
    ]);
    const existingMap: Record<string, EntryState> = {};
    for (const a of attResult.rows) {
      existingMap[a.student_id] = {
        student_id: a.student_id,
        student_name: a.student_name,
        registration_number: a.registration_number,
        status: a.status,
        justification: a.justification ?? undefined,
        confirmed: true,
        attestationUploaded: a.status === 'attested' || a.status === 'excused',
      };
    }
    const seeded: Record<string, EntryState> = {};
    for (const s of stuRes.data) {
      seeded[s.id] = existingMap[s.id] ?? {
        student_id: s.id,
        student_name: s.name,
        registration_number: s.registration_number,
        status: 'present',
        confirmed: false,
      };
    }
    setEntries(seeded);
    setLocked(attResult.locked);
    setToast(null);
  }, [classId, date, subjectId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (view !== 'status' || !classId) return;
    setCalLoading(true);
    Promise.all([
      attendanceService.calendar(classId, calYear, calMonth),
      attendanceService.schoolEvents(calYear, calMonth),
    ]).then(([days, events]) => {
      setCalDays(days);
      setSchoolEvents(events);
    }).finally(() => setCalLoading(false));
  }, [view, classId, calYear, calMonth]);

  // Mapa data → resumo, para lookup rápido na grade do calendário.
  const calByDate = useMemo(() => {
    const map: Record<string, CalendarDay> = {};
    for (const d of calDays) {
      const prev = map[d.date];
      map[d.date] = prev ? {
        date: d.date, subject_id: null,
        total: prev.total + d.total,
        present: prev.present + d.present,
        absent: prev.absent + d.absent,
        justified: prev.justified + d.justified,
        attested: prev.attested + d.attested,
        excused: prev.excused + d.excused,
      } : { ...d };
    }
    return map;
  }, [calDays]);

  // Mapa data → evento escolar (expande intervalos multi-dia)
  const eventByDate = useMemo(() => {
    const map: Record<string, SchoolEvent> = {};
    for (const ev of schoolEvents) {
      const start = new Date(ev.date_start + 'T12:00:00');
      const end   = ev.date_end ? new Date(ev.date_end + 'T12:00:00') : new Date(start);
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        map[d.toISOString().slice(0, 10)] = ev;
      }
    }
    return map;
  }, [schoolEvents]);

  // Matriz do mês (semanas de domingo a sábado, com padding dos meses vizinhos).
  const calWeeks = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells: { date: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: '', day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date: iso, day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) cells.push({ date: '', day: 0, inMonth: false });
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [calYear, calMonth]);

  function setStatus(id: string, status: AttendanceStatus) {
    if (locked && !isAdmin) return;
    setEntries((e) => ({ ...e, [id]: { ...e[id], status, confirmed: false, attestationFile: undefined } }));
    setToast(null);
  }

  function setJustification(id: string, justification: string) {
    if (locked && !isAdmin) return;
    setEntries((e) => ({ ...e, [id]: { ...e[id], justification: justification.slice(0, 100) } }));
  }

  function setAttestationFile(id: string, file: File | undefined) {
    setEntries((e) => ({ ...e, [id]: { ...e[id], attestationFile: file } }));
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function downloadAttestation(studentId: string, forDate: string = date) {
    setDownloadingId(studentId);
    try {
      const doc = await attendanceService.getAttestation(studentId, classId, forDate);
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${doc.file_data}`;
      link.download = doc.filename;
      link.click();
      return doc;
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao baixar o atestado.' });
      return null;
    } finally {
      setDownloadingId(null);
    }
  }

  // Clique num dia com chamada → abre painel detalhado do dia.
  // Dias sem chamada → navega para a aba Chamada naquela data.
  async function onCalendarDayClick(iso: string, info: CalendarDay | undefined) {
    if (!info) { setDate(iso); nav('/app/attendance'); return; }
    setDayModalLoading(true);
    setDayModal(null);
    setDayPdfMap({});
    try {
      const { rows } = await attendanceService.forContext(classId, iso);
      setDayModal({ date: iso, rows });
    } catch {
      setToast({ type: 'error', msg: 'Erro ao carregar a chamada deste dia.' });
    } finally {
      setDayModalLoading(false);
    }
  }

  async function toggleDayPdf(studentId: string, forDate: string) {
    // Já aberto → fecha
    if (dayPdfMap[studentId]?.fileData) {
      setDayPdfMap((m) => ({ ...m, [studentId]: { loading: false, fileData: null } }));
      return;
    }
    setDayPdfMap((m) => ({ ...m, [studentId]: { loading: true, fileData: null } }));
    try {
      const doc = await attendanceService.getAttestation(studentId, classId, forDate);
      setDayPdfMap((m) => ({ ...m, [studentId]: { loading: false, fileData: doc.file_data } }));
    } catch {
      setDayPdfMap((m) => ({ ...m, [studentId]: { loading: false, fileData: null } }));
      setToast({ type: 'error', msg: 'Erro ao carregar o PDF do atestado.' });
    }
  }

  function closeDayModal() { setDayModal(null); setDayPdfMap({}); }

  async function confirm(id: string) {
    const entry = entries[id];
    // Atestado precisa de arquivo antes de confirmar
    if (entry.status === 'attested' && !entry.attestationFile && !entry.attestationUploaded) {
      setToast({ type: 'error', msg: `Selecione o PDF do atestado para ${entry.student_name.split(' ')[0]} antes de confirmar.` });
      fileInputRefs.current[id]?.click();
      return;
    }
    // Faz upload do atestado agora (antes de salvar a chamada toda)
    if (entry.status === 'attested' && entry.attestationFile) {
      try {
        const b64 = await toBase64(entry.attestationFile);
        await attendanceService.uploadAttestation({
          student_id: id,
          class_id: classId,
          date,
          filename: entry.attestationFile.name,
          file_size: entry.attestationFile.size,
          file_data: b64,
        });
        setEntries((e) => ({ ...e, [id]: { ...e[id], confirmed: true, attestationUploaded: true } }));
      } catch (err: any) {
        console.error('[attestation upload]', err);
        const detail = err?.message ? ` (${err.message})` : '';
        setToast({ type: 'error', msg: `Erro ao enviar o atestado${detail}. Tente novamente.` });
      }
      return;
    }
    setEntries((e) => ({ ...e, [id]: { ...e[id], confirmed: true } }));
  }

  function markAll(status: AttendanceStatus) {
    if (locked && !isAdmin) return;
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = { ...next[k], status, confirmed: false, attestationFile: undefined };
      return next;
    });
    setToast(null);
  }

  function confirmAll() {
    // Verifica se há atestados sem arquivo
    const missing = Object.values(entries).filter(
      (e) => e.status === 'attested' && !e.attestationFile && !e.attestationUploaded
    );
    if (missing.length > 0) {
      setToast({ type: 'error', msg: `${missing.length} aluno(s) com Atestado Médico precisam ter o PDF enviado individualmente.` });
      return;
    }
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k].status !== 'attested' || next[k].attestationUploaded) {
          next[k] = { ...next[k], confirmed: true };
        }
      }
      return next;
    });
  }

  const studentList = Object.values(entries);
  const present   = studentList.filter((e) => e.status === 'present').length;
  const absent    = studentList.filter((e) => e.status === 'absent').length;
  const justified = studentList.filter((e) => e.status === 'justified').length;
  const attested  = studentList.filter((e) => e.status === 'attested').length;
  const excused   = studentList.filter((e) => e.status === 'excused').length;
  const allConfirmed = studentList.length > 0 && studentList.every((e) => e.confirmed);
  const unconfirmedCount = studentList.filter((e) => !e.confirmed).length;

  const dailySummary = { present, absent, justified, attested, excused };

  async function save() {
    setSaving(true);
    try {
      const batch = Object.values(entries).map((e) => ({
        student_id: e.student_id,
        status: e.status,
        justification: e.justification ?? undefined,
      }));
      await attendanceService.saveBatch(classId, date, batch, subjectId || undefined);
      setLocked(true);
      setToast({ type: 'success', msg: `Chamada encerrada — ${batch.length} aluno(s) registrado(s)` });
    } catch (err: any) {
      const msg = err?.code === 'already_locked'
        ? 'Chamada já encerrada. Somente a gestão pode alterá-la.'
        : err?.message ?? 'Erro ao salvar chamada';
      setToast({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  const canSave = allConfirmed && (!locked || isAdmin);
  const readOnly = locked && !isAdmin;

  function toastFor(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-primary-soft to-primary-soft/40 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
              {view === 'status' ? 'Frequência' : view === 'aprovar' ? 'Aprovar Atestados' : 'Chamada'}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {view === 'status'
                ? 'Visualize a frequência diária da turma no calendário mensal.'
                : view === 'aprovar'
                ? 'Revise e aprove atestados médicos enviados pelos responsáveis.'
                : 'Registre e acompanhe a presença dos alunos por turma e data de forma rápida e organizada.'}
            </p>
            {view === 'chamada' && !readOnly && (
              <button
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90"
                onClick={save}
                disabled={!canSave || saving}
                title={!allConfirmed ? `${unconfirmedCount} aluno(s) aguardando confirmação` : undefined}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando…' : 'Salvar chamada'}
              </button>
            )}
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-white/40 text-primary shadow-inner">
              {view === 'status' ? <CalendarDays size={64} /> : view === 'aprovar' ? <ShieldCheck size={64} /> : <ClipboardCheck size={64} />}
            </div>
          </div>
        </div>
      </div>

      {/* ===================== APROVAR ATESTADOS (só gestão) ===================== */}
      {view === 'aprovar' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-4 py-2.5 text-sm font-medium text-primary">
            <ShieldCheck size={16} />
            Ao aprovar, a falta do dia vira "Abono por Atestado". Ao recusar, ela permanece como falta.
          </div>
          <ApprovalQueue onToast={toastFor} />
        </div>
      )}

      {/* ===================== STATUS POR DIA (calendário) ===================== */}
      {view === 'status' && (
        <div className="space-y-3">
          {/* Filtros + navegação */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select className="input max-w-[200px]" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-border p-1.5 hover:bg-canvas" onClick={prevMonth}><ChevronLeft size={14} /></button>
              <span className="min-w-[9rem] text-center text-sm font-semibold text-ink">{PT_MONTHS[calMonth - 1]} {calYear}</span>
              <button className="rounded-lg border border-border p-1.5 hover:bg-canvas" onClick={nextMonth}><ChevronRight size={14} /></button>
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-success" />Chamada feita</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-primary-soft border border-primary/30" />Sem chamada</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-danger-soft border border-danger/30" />Feriado/Recesso</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-canvas border border-border" />Fim de semana</span>
          </div>

          {/* Grade do calendário */}
          <div className="card p-3">
            {calLoading ? (
              <div className="flex justify-center py-10 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
            ) : (
              <>
                {/* Cabeçalho dos dias da semana */}
                <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                  {PT_WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
                </div>
                {/* Células */}
                <div className="space-y-1">
                  {calWeeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-1">
                      {week.map((cell, ci) => {
                        if (!cell.inMonth) return <div key={ci} className="h-16 rounded-lg" />;

                        const info      = calByDate[cell.date];
                        const event     = eventByDate[cell.date];
                        const isToday   = cell.date === today();
                        const isPast    = cell.date < today();
                        const weekday   = new Date(cell.date + 'T12:00:00').getDay();
                        const isWeekend = weekday === 0 || weekday === 6;

                        // Cores por estado — prioridade: evento > chamada > dia-útil-sem-chamada > fds
                        const EVENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
                          holiday:  { bg: 'bg-danger-soft border-danger/30',   text: 'text-danger',   label: 'Feriado' },
                          recess:   { bg: 'bg-warning-soft border-warning/30', text: 'text-warning',  label: 'Recesso' },
                          exam:     { bg: 'bg-purple-soft border-purple/30',   text: 'text-purple',   label: 'Prova' },
                          meeting:  { bg: 'bg-accent-soft border-accent/30',   text: 'text-accent',   label: 'Reunião' },
                          event:    { bg: 'bg-cta-soft border-cta/30',         text: 'text-cta',      label: 'Evento' },
                        };

                        let cellBg   = 'bg-white border-border hover:bg-canvas';
                        let numColor = 'text-ink';
                        let eventLabel: string | null = null;

                        if (isWeekend) {
                          cellBg   = 'bg-canvas border-border/50 cursor-default';
                          numColor = 'text-ink-subtle';
                        } else if (event) {
                          const s  = EVENT_STYLE[event.event_type] ?? EVENT_STYLE.event;
                          cellBg   = `${s.bg} hover:opacity-90`;
                          numColor = s.text;
                          eventLabel = s.label;
                        } else if (info) {
                          cellBg   = 'bg-success-soft border-success/30 hover:bg-success/20';
                          numColor = 'text-success';
                        } else if (isPast && !isWeekend) {
                          cellBg   = 'bg-primary-soft border-primary/20 hover:bg-primary/20';
                          numColor = 'text-primary';
                        }

                        const todayRing = isToday ? 'ring-2 ring-primary ring-offset-1' : '';
                        const clickable = !isWeekend;

                        return (
                          <button
                            key={ci}
                            onClick={() => clickable && onCalendarDayClick(cell.date, info)}
                            disabled={!clickable}
                            className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-lg border text-xs transition-colors ${cellBg} ${todayRing} disabled:cursor-default`}
                            title={event ? event.title : info ? `${info.total} aluno(s) registrado(s)` : 'Sem chamada registrada'}
                          >
                            <span className={`text-base font-bold leading-none ${numColor}`}>{cell.day}</span>
                            {eventLabel && (
                              <span className={`mt-0.5 max-w-full truncate text-[9px] font-semibold leading-none ${numColor}`}>
                                {event?.title ? event.title.slice(0, 10) : eventLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'chamada' && (
        <>
          {/* ===== FILTRO BAR ===== */}
          <div className="mb-4 card p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div>
                <label className="label">Turma</label>
                <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Data</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Disciplina / Professor</label>
                <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Chamada geral</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
                  onClick={save}
                  disabled={!canSave || saving}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Salvando…' : 'Salvar chamada'}
                </button>
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

          {locked && (
            <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
              isAdmin ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'
            }`}>
              <Lock size={16} />
              {isAdmin
                ? 'Chamada encerrada pelo professor. Como gestor, você pode substituí-la.'
                : 'Chamada encerrada. Somente a gestão pode fazer alterações.'}
            </div>
          )}

          {/* ===== KPI CARDS ===== */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(() => {
              const total = studentList.length || 1;
              const freq = studentList.length > 0 ? Math.round((present / total) * 100) : 0;
              const kpis: { label: string; value: string; hint: string; icon: typeof Users; tone: 'success' | 'danger' | 'warning' | 'primary' }[] = [
                { label: 'Presentes', value: String(present), hint: `${Math.round((present / total) * 100)}% do total`, icon: Users, tone: 'success' },
                { label: 'Faltas', value: String(absent), hint: `${Math.round((absent / total) * 100)}% do total`, icon: UserMinus, tone: 'danger' },
                { label: 'Justificadas', value: String(justified + attested + excused), hint: `${Math.round(((justified + attested + excused) / total) * 100)}% do total`, icon: FileCheck2, tone: 'warning' },
                { label: 'Frequência da turma', value: `${freq}%`, hint: studentList.length > 0 ? `${total} aluno(s) na turma` : 'Sem dados', icon: BarChart3, tone: 'primary' },
              ];
              return kpis.map((k) => {
                const bg: Record<string, string> = { success: 'border-success/20 bg-success-soft/30', danger: 'border-danger/20 bg-danger-soft/30', warning: 'border-warning/20 bg-warning-soft/30', primary: 'border-primary/20 bg-primary-soft/30' };
                const ico: Record<string, string> = { success: 'bg-success-soft text-success', danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning', primary: 'bg-primary-soft text-primary' };
                const txt: Record<string, string> = { success: 'text-success', danger: 'text-danger', warning: 'text-warning', primary: 'text-primary' };
                return (
                  <div key={k.label} className={`flex items-start gap-4 rounded-xl border p-5 ${bg[k.tone]}`}>
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ico[k.tone]}`}>
                      <k.icon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-ink-muted">{k.label}</p>
                      <p className={`text-2xl font-extrabold ${txt[k.tone]}`}>{k.value}</p>
                      <p className="text-[11px] text-ink-subtle">{k.hint}</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
            {/* ===================== COLUNA ESQUERDA (70%) — CHAMADA ===================== */}
            <div className="min-w-0 space-y-4">
              {/* Tabela de alunos */}
              <div className="card overflow-hidden">
                {studentList.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para fazer a chamada." />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                            <th className="px-4 py-3">Aluno</th>
                            <th className="px-4 py-3">Turma / Série</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            {!readOnly && <th className="px-4 py-3 w-24" />}
                          </tr>
                        </thead>
                        <tbody>
                          {studentList.map((entry) => {
                            const cls = classes.find((c) => c.id === classId);
                            return (
                              <tr key={entry.student_id} className={`border-b border-border last:border-0 ${entry.confirmed ? 'bg-success-soft/20' : 'hover:bg-canvas'}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                      {entry.student_name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-ink">{entry.student_name}</p>
                                      {entry.registration_number && (
                                        <p className="truncate text-[11px] text-ink-subtle">Mat. {entry.registration_number}</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-ink-muted">{cls?.name ?? '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col items-center gap-2">
                                    {entry.confirmed ? (
                                      entry.status === 'excused' ? (
                                        <span className={`rounded-xl px-4 py-1.5 text-xs ${STATUS_BADGE.excused}`}>Abono</span>
                                      ) : (
                                        <span className={`rounded-xl px-4 py-1.5 text-xs ${STATUS_BADGE[entry.status]}`}>
                                          {STATUS_OPTIONS.find(s => s.value === entry.status)?.short}
                                        </span>
                                      )
                                    ) : (
                                      <div className="inline-flex rounded-xl border border-border p-0.5">
                                        {STATUS_OPTIONS.map((opt) => (
                                          <button
                                            key={opt.value}
                                            onClick={() => setStatus(entry.student_id, opt.value)}
                                            title={opt.label}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                                              entry.status === opt.value ? opt.on : opt.off
                                            }`}
                                          >
                                            {opt.short}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {/* Justificativa input */}
                                    {!entry.confirmed && entry.status === 'justified' && (
                                      <input
                                        className="input w-full max-w-[220px] text-xs"
                                        placeholder="Motivo (até 100 caracteres)"
                                        maxLength={100}
                                        value={entry.justification ?? ''}
                                        onChange={(e) => setJustification(entry.student_id, e.target.value)}
                                      />
                                    )}
                                    {entry.confirmed && entry.justification && entry.status === 'justified' && (
                                      <span className="text-xs text-ink-muted italic">{entry.justification}</span>
                                    )}
                                    {/* Atestado upload */}
                                    {!entry.confirmed && entry.status === 'attested' && (
                                      <div className="flex items-center gap-2">
                                        <input
                                          ref={(el) => { fileInputRefs.current[entry.student_id] = el; }}
                                          type="file"
                                          accept="application/pdf"
                                          className="hidden"
                                          onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            if (f.size > 5 * 1024 * 1024) {
                                              setToast({ type: 'error', msg: 'O PDF deve ter no máximo 5 MB.' });
                                              e.target.value = '';
                                              return;
                                            }
                                            setAttestationFile(entry.student_id, f);
                                          }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => fileInputRefs.current[entry.student_id]?.click()}
                                          className="flex items-center gap-1.5 rounded-lg border border-dashed border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft transition-colors"
                                        >
                                          <Paperclip size={13} />
                                          {entry.attestationFile ? entry.attestationFile.name : 'PDF'}
                                        </button>
                                      </div>
                                    )}
                                    {entry.confirmed && (entry.status === 'attested' || entry.status === 'excused') && entry.attestationUploaded && (
                                      <button
                                        type="button"
                                        onClick={() => downloadAttestation(entry.student_id)}
                                        disabled={downloadingId === entry.student_id}
                                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                                      >
                                        {downloadingId === entry.student_id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                        Baixar atestado
                                      </button>
                                    )}
                                  </div>
                                </td>
                                {!readOnly && (
                                  <td className="px-4 py-3 text-center">
                                    {entry.confirmed ? (
                                      <CheckCircle2 size={18} className="mx-auto text-success" />
                                    ) : (
                                      <button
                                        onClick={() => confirm(entry.student_id)}
                                        disabled={entry.status === 'attested' && !entry.attestationFile && !entry.attestationUploaded}
                                        className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        Confirmar
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Footer */}
                    <div className="border-t border-border px-4 py-3 text-xs text-ink-muted">
                      {allConfirmed
                        ? 'Todos os alunos confirmados.'
                        : `${unconfirmedCount} aluno(s) aguardando confirmação.`}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ===================== COLUNA DIREITA (30%) — RESUMO E AÇÕES ===================== */}
            <div className="space-y-4">
              <AttendanceSummaryChart summary={dailySummary} date={date} />

              {/* Ações rápidas */}
              {!readOnly && studentList.length > 0 && (
                <div className="card p-5">
                  <p className="mb-3 text-sm font-bold text-ink">Ações rápidas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-semibold text-success hover:bg-success-soft/40 transition-colors"
                      onClick={() => markAll('present')}
                    >
                      <Users size={20} />
                      Marcar todos presentes
                    </button>
                    <button
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-semibold text-danger hover:bg-danger-soft/40 transition-colors"
                      onClick={() => markAll('absent')}
                    >
                      <UserMinus size={20} />
                      Marcar todos faltas
                    </button>
                    {!allConfirmed && (
                      <button
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-3 text-center text-xs font-semibold text-primary hover:bg-primary-soft/40 transition-colors col-span-2"
                        onClick={confirmAll}
                      >
                        <CheckCircle2 size={20} />
                        Confirmar todos
                      </button>
                    )}
                  </div>
                </div>
              )}

              <AttendanceAlertsCard classId={classId} />
            </div>
          </div>
        </>
      )}

      {/* Painel do dia — lista completa de alunos + status + atestados */}
      <Modal
        open={!!dayModal || dayModalLoading}
        title={dayModal ? `Chamada — ${new Date(dayModal.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}` : 'Carregando…'}
        onClose={closeDayModal}
      >
        {dayModalLoading ? (
          <div className="flex justify-center py-10 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
        ) : dayModal && (
          <div className="space-y-4">
            {/* Chips de resumo */}
            {(() => {
              const r = dayModal.rows;
              const p = r.filter(x => x.status === 'present').length;
              const f = r.filter(x => x.status === 'absent').length;
              const j = r.filter(x => x.status === 'justified').length;
              const a = r.filter(x => x.status === 'attested').length;
              const ab = r.filter(x => x.status === 'excused').length;
              return (
                <div className="flex flex-wrap gap-2">
                  {p  > 0 && <span className="rounded-lg bg-success-soft px-3 py-1 text-xs font-bold text-success">{p} Presença{p !== 1 ? 's' : ''}</span>}
                  {f  > 0 && <span className="rounded-lg bg-danger-soft  px-3 py-1 text-xs font-bold text-danger">{f} Falta{f !== 1 ? 's' : ''}</span>}
                  {j  > 0 && <span className="rounded-lg bg-warning-soft px-3 py-1 text-xs font-bold text-warning">{j} Justificada{j !== 1 ? 's' : ''}</span>}
                  {a  > 0 && <span className="rounded-lg bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{a} Atestado{a !== 1 ? 's' : ''}</span>}
                  {ab > 0 && <span className="rounded-lg bg-purple-soft  px-3 py-1 text-xs font-bold text-purple">{ab} Abono{ab !== 1 ? 's' : ''}</span>}
                  <span className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-ink-muted">{r.length} aluno{r.length !== 1 ? 's' : ''}</span>
                </div>
              );
            })()}

            {/* Lista de alunos */}
            <div className="divide-y divide-border rounded-xl border border-border">
              {dayModal.rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-muted">Nenhum registro para este dia.</p>
              ) : dayModal.rows.map((row) => {
                const pdf = dayPdfMap[row.student_id];
                const hasAttest = row.status === 'attested' || row.status === 'excused';
                const badgeCls = STATUS_BADGE[row.status];
                const statusLabel = row.status === 'excused'
                  ? 'Abono por Atestado'
                  : STATUS_OPTIONS.find(o => o.value === row.status)?.label ?? row.status;

                return (
                  <div key={row.student_id}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                        {row.student_name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">{row.student_name}</p>
                        {row.registration_number && (
                          <p className="text-[11px] text-ink-subtle">Matrícula {row.registration_number}</p>
                        )}
                        {row.justification && row.status === 'justified' && (
                          <p className="mt-0.5 text-[11px] italic text-ink-muted">{row.justification}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-xl px-3 py-1 text-xs ${badgeCls}`}>{statusLabel}</span>
                        {hasAttest && (
                          <button
                            onClick={() => toggleDayPdf(row.student_id, dayModal.date)}
                            disabled={pdf?.loading}
                            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                          >
                            {pdf?.loading ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                            {pdf?.fileData ? 'Fechar' : 'Ver PDF'}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* PDF inline */}
                    {pdf?.fileData && (
                      <div className="border-t border-border px-4 pb-4 pt-3">
                        <iframe
                          src={`data:application/pdf;base64,${pdf.fileData}`}
                          title="Atestado médico"
                          className="h-[55vh] w-full rounded-xl border border-border"
                        />
                        <a
                          href={`data:application/pdf;base64,${pdf.fileData}`}
                          download={row.student_name + '_atestado.pdf'}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <Download size={12} /> Baixar PDF
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
