import { useCallback, useEffect, useState } from 'react';
import { Star, Save, Check, Loader2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type ClassSubject } from '@/services/classes';
import { gradesService } from '@/services/grades';
import { api } from '@/lib/api';
import type { SchoolClass, Student } from '@/types/models';

// Fallback quando a turma ainda não tem matérias cadastradas.
const SUBJECTS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês'];
const PERIODS = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'];

function gradeColor(v: number): string {
  if (!Number.isFinite(v)) return '';
  if (v >= 7) return 'text-success';
  if (v >= 5) return 'text-warning';
  return 'text-danger';
}

export function GradesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
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

  // Matérias da turma → alimentam o select de disciplina.
  useEffect(() => {
    if (!classId) { setClassSubjects([]); return; }
    classesService.subjects(classId).then((subs) => {
      setClassSubjects(subs);
      if (subs.length > 0) setSubject(subs[0].name);
    }).catch(() => setClassSubjects([]));
  }, [classId]);

  const loadContext = useCallback(async () => {
    if (!classId) return;
    const [stuRes, gradeRows] = await Promise.all([
      api.get<{ ok: boolean; data: Student[] }>(`/students?class_id=${classId}`),
      gradesService.forContext(classId, subject, period),
    ]);
    setStudents(stuRes.data);
    const map: Record<string, number> = {};
    for (const g of gradeRows) map[g.student_id] = g.grade;
    setGrades(map);
    setToast(null);
  }, [classId, subject, period]);

  useEffect(() => { loadContext(); }, [loadContext]);

  function setGrade(studentId: string, value: string) {
    const n = value === '' ? NaN : Math.max(0, Math.min(10, Number(value)));
    setGrades((g) => ({ ...g, [studentId]: n }));
    setToast(null);
  }

  async function save() {
    setSaving(true);
    try {
      const batch = Object.entries(grades)
        .filter(([, v]) => Number.isFinite(v))
        .map(([student_id, grade]) => ({ student_id, grade }));
      await gradesService.saveBatch(classId, subject, period, batch);
      setToast({ type: 'success', msg: `Notas salvas — ${batch.length} aluno(s) em ${subject}, ${period}` });
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao salvar notas' });
    } finally {
      setSaving(false);
    }
  }

  const gradeValues = Object.values(grades).filter(Number.isFinite);
  const avg = gradeValues.length > 0 ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length : 0;
  const below = gradeValues.filter((v) => v < 7).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        subtitle="Lance e edite as notas dos alunos por turma, disciplina e período."
        actions={
          <button className="btn-primary" onClick={save} disabled={students.length === 0 || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : toast?.type === 'success' ? <Check size={16} /> : <Save size={16} />}
            {saving ? 'Salvando…' : toast?.type === 'success' ? 'Salvo!' : 'Salvar notas'}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Turma</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Disciplina</label>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {(classSubjects.length > 0 ? classSubjects.map((s) => s.name) : SUBJECTS).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Período</label>
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {gradeValues.length > 0 && (
          <div className="mt-3 flex gap-4 border-t border-border pt-3 text-sm">
            <span className="text-ink-muted">Média da turma: <strong className={gradeColor(avg)}>{avg.toFixed(1)}</strong></span>
            <span className="text-ink-muted">Lançados: <strong>{gradeValues.length}/{students.length}</strong></span>
            {below > 0 && <span className="text-danger font-semibold">{below} abaixo da média</span>}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {students.length === 0 ? (
          <EmptyState icon={Star} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para lançar notas." />
        ) : (
          <div className="divide-y divide-border">
            {students.map((s) => {
              const g = grades[s.id];
              const filled = Number.isFinite(g);
              return (
                <div key={s.id} className="flex items-center gap-4 px-4 py-3 hover:bg-canvas">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {s.name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-ink-muted">{s.registration_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number" min={0} max={10} step={0.1}
                      className="input w-20 text-center font-semibold"
                      value={filled ? g : ''}
                      onChange={(e) => setGrade(s.id, e.target.value)}
                    />
                    {filled && (
                      <span className={`text-sm font-bold ${gradeColor(g)}`}>
                        {g >= 7 ? '✓' : g >= 5 ? '!' : '✗'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
