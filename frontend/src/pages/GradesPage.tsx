import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Star, Save, Check, Loader2, AlertTriangle, Lock,
  CheckCircle2, TrendingUp, TrendingDown, Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FinanceTabs } from '@/components/finance/FinanceTabs';
import { classesService, type ClassSubject } from '@/services/classes';
import { gradesService, type BoletimData } from '@/services/grades';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';

const SUBJECTS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês'];
const PERIODS  = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre'];

function gradeColor(v: number): string {
  if (!Number.isFinite(v)) return 'text-ink-muted';
  if (v >= 7) return 'text-success';
  if (v >= 5) return 'text-warning';
  return 'text-danger';
}

function gradeBg(v: number): string {
  if (!Number.isFinite(v)) return 'bg-canvas';
  if (v >= 7) return 'bg-success-soft text-success';
  if (v >= 5) return 'bg-warning-soft text-warning';
  return 'bg-danger-soft text-danger';
}

interface EntryState {
  student_id: string;
  student_name: string;
  registration_number?: string;
  grade: number;
  confirmed: boolean;
}

export function GradesPage() {
  const me = useMe();
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin';
  return <GradesView isAdmin={isAdmin} />;
}

function GradesView({ isAdmin }: { isAdmin: boolean }) {
  const TABS = [
    { key: 'notas',   label: 'Lançar Notas' },
    { key: 'boletim', label: 'Boletim'       },
  ];

  const [tab, setTab]                   = useState('notas');
  const [classes, setClasses]           = useState<SchoolClass[]>([]);
  const [classId, setClassId]           = useState('');
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [subject, setSubject]           = useState(SUBJECTS[0]);
  const [period, setPeriod]             = useState(PERIODS[0]);
  const [entries, setEntries]           = useState<Record<string, EntryState>>({});
  const [locked, setLocked]             = useState(false);
  const [saving, setSaving]             = useState(false);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [boletim, setBoletim]           = useState<BoletimData | null>(null);
  const [boletimLoading, setBoletimLoading] = useState(false);

  useEffect(() => {
    classesService.list().then((c) => {
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!classId) { setClassSubjects([]); return; }
    classesService.subjects(classId).then((subs) => {
      setClassSubjects(subs);
      if (subs.length > 0) setSubject(subs[0].name);
      else setSubject(SUBJECTS[0]);
    }).catch(() => setClassSubjects([]));
  }, [classId]);

  const loadContext = useCallback(async () => {
    if (!classId) return;
    const [stuRes, gradeResult] = await Promise.all([
      api.get<{ ok: boolean; data: Student[] }>(`/students?class_id=${classId}`),
      gradesService.forContext(classId, subject, period),
    ]);
    const gradeMap: Record<string, number> = {};
    for (const g of gradeResult.rows) gradeMap[g.student_id] = g.grade;

    const seeded: Record<string, EntryState> = {};
    for (const s of stuRes.data) {
      seeded[s.id] = {
        student_id: s.id,
        student_name: s.name,
        registration_number: s.registration_number,
        grade: gradeMap[s.id] ?? NaN,
        confirmed: gradeResult.locked,
      };
    }
    setEntries(seeded);
    setLocked(gradeResult.locked);
    setToast(null);
  }, [classId, subject, period]);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (tab !== 'boletim' || !classId) return;
    setBoletimLoading(true);
    gradesService.boletim(classId).then(setBoletim).finally(() => setBoletimLoading(false));
  }, [tab, classId]);

  function setGradeValue(studentId: string, value: string) {
    if (locked && !isAdmin) return;
    const n = value === '' ? NaN : Math.max(0, Math.min(10, Number(value)));
    setEntries((e) => ({ ...e, [studentId]: { ...e[studentId], grade: n, confirmed: false } }));
    setToast(null);
  }

  function confirm(studentId: string) {
    const entry = entries[studentId];
    if (!Number.isFinite(entry.grade)) {
      setToast({ type: 'error', msg: `Digite a nota de ${entry.student_name.split(' ')[0]} antes de confirmar.` });
      return;
    }
    setEntries((e) => ({ ...e, [studentId]: { ...e[studentId], confirmed: true } }));
  }

  const studentList = Object.values(entries);
  const gradeValues = studentList.map((e) => e.grade).filter(Number.isFinite);
  const avg         = gradeValues.length > 0 ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length : NaN;
  const passing     = gradeValues.filter((v) => v >= 7).length;
  const recovery    = gradeValues.filter((v) => v >= 5 && v < 7).length;
  const failing     = gradeValues.filter((v) => v < 5).length;
  const highest     = gradeValues.length > 0 ? Math.max(...gradeValues) : NaN;
  const lowest      = gradeValues.length > 0 ? Math.min(...gradeValues) : NaN;
  const notFilled   = studentList.filter((e) => !Number.isFinite(e.grade)).length;
  const allConfirmed = studentList.length > 0 && studentList.every((e) => e.confirmed);
  const unconfirmedCount = studentList.filter((e) => !e.confirmed).length;

  const readOnly = locked && !isAdmin;
  const canSave  = allConfirmed && (!locked || isAdmin);

  async function save() {
    setSaving(true);
    try {
      const batch = studentList
        .filter((e) => Number.isFinite(e.grade))
        .map((e) => ({ student_id: e.student_id, grade: e.grade }));
      await gradesService.saveBatch(classId, subject, period, batch);
      setLocked(true);
      setEntries((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = { ...next[k], confirmed: true };
        return next;
      });
      setToast({ type: 'success', msg: `Notas salvas — ${batch.length} aluno(s) em ${subject}, ${period}` });
    } catch (err: any) {
      const msg = err?.code === 'already_locked'
        ? 'Notas já lançadas. Somente a gestão pode alterá-las.'
        : err?.message ?? 'Erro ao salvar notas';
      setToast({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }

  // Pivot para o boletim: subjects[], periods[], grade[student][subject+period]
  const boletimPivot = useMemo(() => {
    if (!boletim) return null;
    const subjects = [...new Set(boletim.grades.map((g) => g.subject))].sort();
    const periods  = [...new Set(boletim.grades.map((g) => g.period))].sort();
    const map: Record<string, Record<string, number>> = {};
    for (const g of boletim.grades) {
      if (!map[g.student_id]) map[g.student_id] = {};
      map[g.student_id][`${g.subject}||${g.period}`] = g.grade;
    }
    return { subjects, periods, map };
  }, [boletim]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Avaliações"
        subtitle="Lance e edite as notas dos alunos por turma, disciplina e período."
        actions={
          tab === 'notas' && !readOnly ? (
            <button
              className="btn-primary flex items-center gap-2"
              onClick={save}
              disabled={!canSave || saving}
              title={!allConfirmed ? `${unconfirmedCount} aluno(s) aguardando confirmação` : undefined}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : toast?.type === 'success' ? <Check size={16} /> : <Save size={16} />}
              {saving ? 'Salvando…' : toast?.type === 'success' ? 'Salvo!' : 'Salvar notas'}
            </button>
          ) : undefined
        }
      />

      <FinanceTabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ===================== LANÇAR NOTAS ===================== */}
      {tab === 'notas' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
          {/* Coluna principal (70%) */}
          <div className="min-w-0 space-y-4">
            {toast && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}>
                {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
                {toast.msg}
              </div>
            )}

            {locked && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                isAdmin ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary'
              }`}>
                <Lock size={16} />
                {isAdmin
                  ? 'Notas encerradas pelo professor. Como gestor, você pode substituí-las.'
                  : 'Notas encerradas. Somente a gestão pode fazer alterações.'}
              </div>
            )}

            {/* Filtros */}
            <div className="card p-4">
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
            </div>

            {/* Lista de alunos */}
            <div className="card overflow-hidden">
              {studentList.length === 0 ? (
                <EmptyState icon={Star} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para lançar notas." />
              ) : (
                <div className="divide-y divide-border">
                  {studentList.map((entry) => (
                    <div key={entry.student_id} className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap ${entry.confirmed ? 'bg-success-soft/20' : 'hover:bg-canvas'}`}>
                      {/* Avatar + nome */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                          {entry.student_name.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{entry.student_name}</p>
                          {entry.registration_number && (
                            <p className="text-[11px] text-ink-subtle">Matrícula {entry.registration_number}</p>
                          )}
                        </div>
                      </div>

                      {/* Nota + confirmar */}
                      <div className="flex shrink-0 items-center gap-2">
                        {entry.confirmed ? (
                          <span className={`rounded-xl px-4 py-1.5 text-sm font-bold ${gradeBg(entry.grade)}`}>
                            {Number.isFinite(entry.grade) ? entry.grade.toFixed(1) : '—'}
                          </span>
                        ) : (
                          <>
                            <input
                              type="number" min={0} max={10} step={0.1}
                              className={`input w-20 text-center font-semibold ${gradeColor(entry.grade)}`}
                              value={Number.isFinite(entry.grade) ? entry.grade : ''}
                              onChange={(e) => setGradeValue(entry.student_id, e.target.value)}
                              disabled={readOnly}
                            />
                            {!readOnly && (
                              <button
                                onClick={() => confirm(entry.student_id)}
                                disabled={!Number.isFinite(entry.grade)}
                                className="shrink-0 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary"
                              >
                                Confirmar
                              </button>
                            )}
                          </>
                        )}
                        {entry.confirmed && <CheckCircle2 size={18} className="shrink-0 text-success" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rodapé */}
            {!readOnly && studentList.length > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-canvas px-4 py-3">
                <span className="text-sm text-ink-muted">
                  {allConfirmed
                    ? 'Todas as notas confirmadas. Clique em Salvar para encerrar.'
                    : `${unconfirmedCount} aluno(s) aguardando confirmação.`}
                </span>
                <button className="btn-primary flex items-center gap-2" onClick={save} disabled={!canSave || saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? 'Salvando…' : 'Salvar notas'}
                </button>
              </div>
            )}
          </div>

          {/* Coluna lateral (30%) — estatísticas */}
          <div>
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <TrendingUp size={16} className="text-primary" /> Estatísticas da turma
              </div>
              <p className="text-xs text-ink-muted">{subject} · {period}</p>

              {gradeValues.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">Nenhuma nota lançada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {/* Média */}
                  <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
                    <span className="text-xs text-ink-muted">Média da turma</span>
                    <span className={`text-base font-bold ${gradeColor(avg)}`}>{avg.toFixed(1)}</span>
                  </div>

                  {/* Aprovados / Recuperação / Abaixo */}
                  <div className="flex items-center justify-between rounded-lg bg-success-soft px-3 py-2">
                    <span className="text-xs text-success font-medium">Aprovados (≥7)</span>
                    <span className="text-sm font-bold text-success">{passing}</span>
                  </div>
                  {recovery > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-warning-soft px-3 py-2">
                      <span className="text-xs text-warning font-medium">Recuperação (5–6,9)</span>
                      <span className="text-sm font-bold text-warning">{recovery}</span>
                    </div>
                  )}
                  {failing > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2">
                      <span className="text-xs text-danger font-medium">Reprovados (&lt;5)</span>
                      <span className="text-sm font-bold text-danger">{failing}</span>
                    </div>
                  )}

                  {/* Maior / menor */}
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border px-3 py-2 text-center">
                      <p className="text-[10px] text-ink-subtle">Maior</p>
                      <p className="text-sm font-bold text-success">{highest.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2 text-center">
                      <p className="text-[10px] text-ink-subtle">Menor</p>
                      <p className="text-sm font-bold text-danger">{lowest.toFixed(1)}</p>
                    </div>
                  </div>

                  {/* Não lançados */}
                  {notFilled > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">
                      <Users size={13} />
                      {notFilled} aluno(s) sem nota lançada
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== BOLETIM ===================== */}
      {tab === 'boletim' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Turma</label>
                <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {boletimLoading ? (
            <div className="flex justify-center py-12 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
          ) : !boletim || boletim.students.length === 0 ? (
            <div className="card">
              <EmptyState icon={Star} title="Nenhuma nota lançada" description="As notas da turma aparecerão aqui conforme forem lançadas." />
            </div>
          ) : boletimPivot && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas">
                      <th className="sticky left-0 bg-canvas px-4 py-3 text-left font-semibold text-ink">Aluno</th>
                      {boletimPivot.subjects.flatMap((subj) =>
                        boletimPivot.periods.map((per) => (
                          <th key={`${subj}||${per}`} className="px-2 py-3 text-center text-xs font-semibold text-ink-muted whitespace-nowrap">
                            <span className="block font-bold text-ink">{subj.slice(0, 4)}.</span>
                            <span>{per.replace('º Bimestre', 'B')}</span>
                          </th>
                        ))
                      )}
                      <th className="px-3 py-3 text-center text-xs font-bold text-ink">Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {boletim.students.map((stu) => {
                      const stuGrades = boletimPivot.subjects.flatMap((subj) =>
                        boletimPivot.periods.map((per) => boletimPivot.map[stu.id]?.[`${subj}||${per}`])
                      ).filter((v): v is number => Number.isFinite(v));
                      const stuAvg = stuGrades.length > 0 ? stuGrades.reduce((a, b) => a + b, 0) / stuGrades.length : NaN;

                      return (
                        <tr key={stu.id} className="hover:bg-canvas">
                          <td className="sticky left-0 bg-white px-4 py-2.5 hover:bg-canvas">
                            <p className="font-medium text-ink whitespace-nowrap">{stu.name}</p>
                            {stu.registration_number && <p className="text-[11px] text-ink-subtle">{stu.registration_number}</p>}
                          </td>
                          {boletimPivot.subjects.flatMap((subj) =>
                            boletimPivot.periods.map((per) => {
                              const g = boletimPivot.map[stu.id]?.[`${subj}||${per}`];
                              return (
                                <td key={`${subj}||${per}`} className="px-2 py-2.5 text-center">
                                  {Number.isFinite(g) ? (
                                    <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-bold ${gradeBg(g!)}`}>
                                      {g!.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-ink-subtle">—</span>
                                  )}
                                </td>
                              );
                            })
                          )}
                          <td className="px-3 py-2.5 text-center">
                            {Number.isFinite(stuAvg) ? (
                              <span className={`text-sm font-bold ${gradeColor(stuAvg)}`}>{stuAvg.toFixed(1)}</span>
                            ) : <span className="text-ink-subtle">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
