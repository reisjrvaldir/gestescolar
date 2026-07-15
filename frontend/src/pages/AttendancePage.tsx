import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardCheck, Save, Check, Loader2, AlertTriangle,
  Lock, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type ClassSubject } from '@/services/classes';
import { attendanceService, type AttendanceStatus, type CalendarDay } from '@/services/attendance';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_BTN: Record<AttendanceStatus, { label: string; on: string; off: string }> = {
  present:   { label: 'P', on: 'bg-success text-white',  off: 'text-ink-muted hover:bg-success-soft' },
  absent:    { label: 'F', on: 'bg-danger text-white',   off: 'text-ink-muted hover:bg-danger-soft' },
  justified: { label: 'J', on: 'bg-warning text-white',  off: 'text-ink-muted hover:bg-warning-soft' },
};

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  present:   'bg-success-soft text-success font-bold',
  absent:    'bg-danger-soft text-danger font-bold',
  justified: 'bg-warning-soft text-warning font-bold',
};

interface EntryState {
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  justification?: string;
  confirmed: boolean;
}

const PT_MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

export function AttendancePage() {
  const me = useMe();
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin';

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

  // Painel de histórico por dia
  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [calLoading, setCalLoading] = useState(false);

  useEffect(() => {
    classesService.list().then((c) => {
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(''); return; }
    setSubjectId('');
    classesService.subjects(classId).then(setSubjects).catch(() => setSubjects([]));
  }, [classId]);

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
        status: a.status,
        justification: a.justification,
        confirmed: true,
      };
    }
    const seeded: Record<string, EntryState> = {};
    for (const s of stuRes.data) {
      seeded[s.id] = existingMap[s.id] ?? {
        student_id: s.id,
        student_name: s.name,
        status: 'present' as AttendanceStatus,
        confirmed: false,
      };
    }
    setEntries(seeded);
    setLocked(attResult.locked);
    setToast(null);
  }, [classId, date, subjectId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  // Carrega histórico quando abre o painel
  useEffect(() => {
    if (!showCalendar || !classId) return;
    setCalLoading(true);
    attendanceService.calendar(classId, calYear, calMonth)
      .then(setCalDays)
      .finally(() => setCalLoading(false));
  }, [showCalendar, classId, calYear, calMonth]);

  function setStatus(id: string, status: AttendanceStatus) {
    if (locked && !isAdmin) return;
    setEntries((e) => ({ ...e, [id]: { ...e[id], status, confirmed: false } }));
    setToast(null);
  }

  function setJustification(id: string, justification: string) {
    if (locked && !isAdmin) return;
    setEntries((e) => ({ ...e, [id]: { ...e[id], justification } }));
  }

  function confirm(id: string) {
    setEntries((e) => ({ ...e, [id]: { ...e[id], confirmed: true } }));
  }

  function markAll(status: AttendanceStatus) {
    if (locked && !isAdmin) return;
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = { ...next[k], status, confirmed: false };
      return next;
    });
    setToast(null);
  }

  function confirmAll() {
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = { ...next[k], confirmed: true };
      return next;
    });
  }

  const studentList = Object.values(entries);
  const present = studentList.filter((e) => e.status === 'present').length;
  const absent = studentList.filter((e) => e.status === 'absent').length;
  const justified = studentList.filter((e) => e.status === 'justified').length;
  const allConfirmed = studentList.length > 0 && studentList.every((e) => e.confirmed);
  const unconfirmedCount = studentList.filter((e) => !e.confirmed).length;

  async function save() {
    setSaving(true);
    try {
      const batch = Object.values(entries).map((e) => ({
        student_id: e.student_id,
        status: e.status,
        justification: e.justification,
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

  return (
    <>
      <PageHeader
        title="Chamada"
        subtitle="Registre a frequência da turma por data."
        actions={
          <div className="flex items-center gap-2">
            <button
              className={`btn-secondary ${showCalendar ? 'bg-primary-soft text-primary' : ''}`}
              onClick={() => setShowCalendar(v => !v)}
            >
              <CalendarDays size={16} />
              Status por dia
            </button>
            {!readOnly && (
              <button
                className="btn-primary"
                onClick={save}
                disabled={!canSave || saving}
                title={!allConfirmed ? `${unconfirmedCount} aluno(s) ainda não confirmado(s)` : undefined}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : toast?.type === 'success' ? <Check size={16} /> : <Save size={16} />}
                {saving ? 'Salvando…' : toast?.type === 'success' ? 'Salvo!' : 'Salvar chamada'}
              </button>
            )}
          </div>
        }
      />

      {/* Painel de histórico por dia */}
      {showCalendar && classId && (
        <div className="card mb-6 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink">Chamadas registradas</h3>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-border p-1.5 hover:bg-canvas" onClick={prevMonth}><ChevronLeft size={14} /></button>
              <span className="text-sm font-medium text-ink">{PT_MONTHS[calMonth - 1]} {calYear}</span>
              <button className="rounded-lg border border-border p-1.5 hover:bg-canvas" onClick={nextMonth}><ChevronRight size={14} /></button>
            </div>
          </div>
          {calLoading ? (
            <div className="flex justify-center py-6 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
          ) : calDays.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-muted">Nenhuma chamada registrada neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-muted">
                    <th className="pb-2 pr-4 font-medium">Data</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 pr-4 font-medium text-success">Presentes</th>
                    <th className="pb-2 pr-4 font-medium text-danger">Faltas</th>
                    <th className="pb-2 font-medium text-warning">Justificadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {calDays.map((d) => {
                    const dt = new Date(d.date + 'T12:00:00');
                    const label = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                    return (
                      <tr key={d.date + (d.subject_id ?? '')} className="hover:bg-canvas">
                        <td className="py-2 pr-4 font-medium text-ink capitalize">{label}</td>
                        <td className="py-2 pr-4 text-ink-muted">{d.total}</td>
                        <td className="py-2 pr-4 text-success">{d.present}</td>
                        <td className="py-2 pr-4 text-danger">{d.absent}</td>
                        <td className="py-2 text-warning">{d.justified}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Aviso de chamada encerrada */}
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

      <div className="card mb-6 p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="label">Turma</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Matéria (opcional)</label>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Chamada por dia</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-2 py-1 font-semibold text-success">{present} P</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-2 py-1 font-semibold text-danger">{absent} F</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-warning-soft px-2 py-1 font-semibold text-warning">{justified} J</span>
            </div>
          </div>
        </div>
        {studentList.length > 0 && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-ink-muted self-center mr-1">Marcar todos:</span>
            <button className="rounded-lg bg-success-soft px-3 py-1 text-xs font-semibold text-success hover:bg-success/20" onClick={() => markAll('present')}>Presentes</button>
            <button className="rounded-lg bg-danger-soft px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/20" onClick={() => markAll('absent')}>Falta</button>
            {!allConfirmed && (
              <button className="ml-auto rounded-lg bg-primary-soft px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20" onClick={confirmAll}>
                Confirmar todos
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {studentList.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para fazer a chamada." />
        ) : (
          <div className="divide-y divide-border">
            {studentList.map((entry) => (
              <div key={entry.student_id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${entry.confirmed ? 'bg-success-soft/20' : 'hover:bg-canvas'}`}>
                {/* Avatar + nome */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {entry.student_name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                  </div>
                  <span className="truncate font-medium text-ink">{entry.student_name}</span>
                </div>

                {/* Botões P/F/J ou badge se confirmado */}
                {entry.confirmed ? (
                  <span className={`rounded-xl px-4 py-1.5 text-xs ${STATUS_BADGE[entry.status]}`}>
                    {STATUS_BTN[entry.status].label}
                  </span>
                ) : (
                  <div className="inline-flex rounded-xl border border-border p-0.5">
                    {(['present', 'absent', 'justified'] as AttendanceStatus[]).map((st) => (
                      <button
                        key={st}
                        onClick={() => setStatus(entry.student_id, st)}
                        className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                          entry.status === st ? STATUS_BTN[st].on : STATUS_BTN[st].off
                        }`}
                      >
                        {STATUS_BTN[st].label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Justificativa */}
                {entry.status !== 'present' && (
                  entry.confirmed ? (
                    entry.justification ? (
                      <span className="text-xs text-ink-muted italic">{entry.justification}</span>
                    ) : null
                  ) : (
                    <input
                      className="input w-full sm:w-48"
                      placeholder="Justificativa"
                      value={entry.justification ?? ''}
                      onChange={(e) => setJustification(entry.student_id, e.target.value)}
                    />
                  )
                )}

                {/* Botão confirmar ou ícone confirmado */}
                {!readOnly && (
                  entry.confirmed ? (
                    <CheckCircle2 size={18} className="shrink-0 text-success" />
                  ) : (
                    <button
                      onClick={() => confirm(entry.student_id)}
                      className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                    >
                      Confirmar
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé com contagem e salvar */}
      {!readOnly && studentList.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-canvas px-4 py-3">
          <span className="text-sm text-ink-muted">
            {allConfirmed
              ? 'Todos os alunos confirmados. Clique em Salvar para encerrar a chamada.'
              : `${unconfirmedCount} aluno(s) aguardando confirmação.`}
          </span>
          <button
            className="btn-primary"
            onClick={save}
            disabled={!canSave || saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando…' : 'Salvar chamada'}
          </button>
        </div>
      )}
    </>
  );
}
