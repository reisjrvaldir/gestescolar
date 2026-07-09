import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Save, Check, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type ClassSubject } from '@/services/classes';
import { attendanceService, type AttendanceStatus } from '@/services/attendance';
import { api } from '@/lib/api';
import type { SchoolClass, Student } from '@/types/models';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_BTN: Record<AttendanceStatus, { label: string; on: string; off: string }> = {
  present:   { label: 'P',  on: 'bg-success text-white',  off: 'text-ink-muted hover:bg-success-soft' },
  absent:    { label: 'F',  on: 'bg-danger text-white',   off: 'text-ink-muted hover:bg-danger-soft' },
  justified: { label: 'J',  on: 'bg-warning text-white',  off: 'text-ink-muted hover:bg-warning-soft' },
};

interface EntryState {
  student_id: string;
  student_name: string;
  status: AttendanceStatus;
  justification?: string;
}

export function AttendancePage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [subjectId, setSubjectId] = useState(''); // '' = chamada por dia
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    classesService.list().then((c) => {
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
      setLoading(false);
    });
  }, []);

  // Matérias da turma (para chamada por aula). Muda a turma → recarrega e volta p/ "por dia".
  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(''); return; }
    setSubjectId('');
    classesService.subjects(classId).then(setSubjects).catch(() => setSubjects([]));
  }, [classId]);

  const loadContext = useCallback(async () => {
    if (!classId) return;
    const [stuRes, attRows] = await Promise.all([
      api.get<{ ok: boolean; data: Student[] }>(`/students?class_id=${classId}`),
      attendanceService.forContext(classId, date, subjectId || undefined),
    ]);
    const existingMap: Record<string, EntryState> = {};
    for (const a of attRows) {
      existingMap[a.student_id] = {
        student_id: a.student_id,
        student_name: a.student_name,
        status: a.status,
        justification: a.justification,
      };
    }
    const seeded: Record<string, EntryState> = {};
    for (const s of stuRes.data) {
      seeded[s.id] = existingMap[s.id] ?? {
        student_id: s.id,
        student_name: s.name,
        status: 'present' as AttendanceStatus,
      };
    }
    setEntries(seeded);
    setToast(null);
  }, [classId, date, subjectId]);

  useEffect(() => { loadContext(); }, [loadContext]);

  function setStatus(id: string, status: AttendanceStatus) {
    setEntries((e) => ({ ...e, [id]: { ...e[id], status } }));
    setToast(null);
  }
  function setJustification(id: string, justification: string) {
    setEntries((e) => ({ ...e, [id]: { ...e[id], justification } }));
    setToast(null);
  }

  function markAll(status: AttendanceStatus) {
    setEntries((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = { ...next[k], status };
      return next;
    });
    setToast(null);
  }

  async function save() {
    setSaving(true);
    try {
      const batch = Object.values(entries).map((e) => ({
        student_id: e.student_id,
        status: e.status,
        justification: e.justification,
      }));
      await attendanceService.saveBatch(classId, date, batch, subjectId || undefined);
      setToast({ type: 'success', msg: `Chamada salva — ${batch.length} aluno(s) registrado(s)` });
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao salvar chamada' });
    } finally {
      setSaving(false);
    }
  }

  const studentList = Object.values(entries);
  const present = studentList.filter((e) => e.status === 'present').length;
  const absent = studentList.filter((e) => e.status === 'absent').length;
  const justified = studentList.filter((e) => e.status === 'justified').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Chamada"
        subtitle="Registre a frequência da turma por data."
        actions={
          <button className="btn-primary" onClick={save} disabled={studentList.length === 0 || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : toast?.type === 'success' ? <Check size={16} /> : <Save size={16} />}
            {saving ? 'Salvando…' : toast?.type === 'success' ? 'Salvo!' : 'Salvar chamada'}
          </button>
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
        {studentList.length > 0 && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <span className="text-xs text-ink-muted mr-1 self-center">Marcar todos:</span>
            <button className="rounded-lg bg-success-soft px-3 py-1 text-xs font-semibold text-success hover:bg-success/20" onClick={() => markAll('present')}>Presentes</button>
            <button className="rounded-lg bg-danger-soft px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/20" onClick={() => markAll('absent')}>Falta</button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {studentList.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para fazer a chamada." />
        ) : (
          <div className="divide-y divide-border">
            {studentList.map((entry) => (
              <div key={entry.student_id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-canvas sm:flex-nowrap">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {entry.student_name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                  </div>
                  <span className="truncate font-medium text-ink">{entry.student_name}</span>
                </div>
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
                {entry.status !== 'present' && (
                  <input
                    className="input w-full sm:w-48"
                    placeholder="Justificativa"
                    value={entry.justification ?? ''}
                    onChange={(e) => setJustification(entry.student_id, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
