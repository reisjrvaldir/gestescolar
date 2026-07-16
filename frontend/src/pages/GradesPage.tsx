import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Star, Save, Check, Loader2, AlertTriangle, Lock,
  Settings, PieChart, BarChart2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { classesService, type ClassSubject } from '@/services/classes';
import { gradesService, type GradeSettings, type GradeSummary, type BoletimData } from '@/services/grades';
import { api } from '@/lib/api';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';

const SUBJECTS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês'];
const PERIODS  = ['1ª Unidade', '2ª Unidade', '3ª Unidade', '4ª Unidade'];

function avg(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return (a + b) / 2;
}

function studentStatus(
  av1: number | null, av2: number | null, final: number | null,
  pg: number, fpg: number,
): 'pending' | 'approved' | 'recovery' | 'approved_final' | 'failed' {
  const m = avg(av1, av2);
  if (m === null) return 'pending';
  if (m >= pg) return 'approved';
  if (final === null) return 'recovery';
  return final >= fpg ? 'approved_final' : 'failed';
}

const STATUS_LABEL: Record<string, string> = {
  pending:        '—',
  approved:       'Aprovado',
  recovery:       'Recuperação',
  approved_final: 'Aprovado (Final)',
  failed:         'Reprovado',
};
const STATUS_CLS: Record<string, string> = {
  pending:        'bg-canvas text-ink-muted',
  approved:       'bg-success-soft text-success',
  recovery:       'bg-warning-soft text-warning',
  approved_final: 'bg-primary-soft text-primary',
  failed:         'bg-danger-soft text-danger',
};

function fmt(v: number | null): string {
  return v !== null && Number.isFinite(v) ? v.toFixed(1) : '—';
}

interface EntryState {
  student_id: string;
  student_name: string;
  registration_number?: string;
  av1: number | null;
  av2: number | null;
  final: number | null;
  av1av2Locked: boolean;
}

export function GradesPage() {
  const me = useMe();
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin';
  return <GradesView isAdmin={isAdmin} />;
}

function GradesView({ isAdmin }: { isAdmin: boolean }) {
  const location = useLocation();
  const isBoletimRoute = location.pathname.endsWith('/boletim');
  const [classes, setClasses]   = useState<SchoolClass[]>([]);
  const [classId, setClassId]   = useState('');
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [subject, setSubject]   = useState(SUBJECTS[0]);
  const [period, setPeriod]     = useState(PERIODS[0]);
  const [entries, setEntries]   = useState<Record<string, EntryState>>({});
  const [locked, setLocked]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);
  const [toast, setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [loading, setLoading]   = useState(true);

  // Configurações de nota
  const [settings, setSettings] = useState<GradeSettings>({ passing_grade: 7.0, final_passing_grade: 5.0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<GradeSettings>({ passing_grade: 7.0, final_passing_grade: 5.0 });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Painel direito
  const [summary, setSummary]           = useState<GradeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Boletim
  const [boletim, setBoletim]           = useState<BoletimData | null>(null);
  const [boletimLoading, setBoletimLoading] = useState(false);

  useEffect(() => {
    Promise.all([classesService.list(), gradesService.getSettings()]).then(([c, s]) => {
      setClasses(c);
      if (c.length > 0) setClassId(c[0].id);
      setSettings(s);
      setSettingsForm(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!classId) { setClassSubjects([]); return; }
    classesService.subjects(classId).then((subs) => {
      setClassSubjects(subs);
      setSubject(subs.length > 0 ? subs[0].name : SUBJECTS[0]);
    }).catch(() => setClassSubjects([]));
  }, [classId]);

  const loadContext = useCallback(async () => {
    if (!classId) return;
    const [stuRes, gradeResult] = await Promise.all([
      api.get<{ ok: boolean; data: Student[] }>(`/students?class_id=${classId}`),
      gradesService.forContext(classId, subject, period),
    ]);
    const gradeMap: Record<string, { av1: number | null; av2: number | null; final: number | null }> = {};
    for (const g of gradeResult.rows) {
      gradeMap[g.student_id] = { av1: g.av1, av2: g.av2, final: g.final_grade };
    }
    const seeded: Record<string, EntryState> = {};
    for (const s of stuRes.data) {
      const g = gradeMap[s.id] ?? { av1: null, av2: null, final: null };
      seeded[s.id] = {
        student_id: s.id,
        student_name: s.name,
        registration_number: s.registration_number,
        av1: g.av1, av2: g.av2, final: g.final,
        av1av2Locked: gradeResult.locked,
      };
    }
    setEntries(seeded);
    setLocked(gradeResult.locked);
    setToast(null);
  }, [classId, subject, period]);

  useEffect(() => { loadContext(); }, [loadContext]);

  useEffect(() => {
    if (isBoletimRoute || !classId) return;
    setSummaryLoading(true);
    gradesService.summary(classId, period).then(setSummary).finally(() => setSummaryLoading(false));
  }, [isBoletimRoute, classId, period]);

  useEffect(() => {
    if (!isBoletimRoute || !classId) return;
    setBoletimLoading(true);
    gradesService.boletim(classId).then(setBoletim).finally(() => setBoletimLoading(false));
  }, [isBoletimRoute, classId]);

  function setField(studentId: string, field: 'av1' | 'av2' | 'final', raw: string) {
    const n = raw === '' ? null : Math.max(0, Math.min(10, Number(raw)));
    if (raw !== '' && !Number.isFinite(n)) return;
    setEntries((e) => ({ ...e, [studentId]: { ...e[studentId], [field]: n } }));
    setToast(null);
  }

  const studentList = Object.values(entries);
  const pg  = settings.passing_grade;
  const fpg = settings.final_passing_grade;

  const readOnly = locked && !isAdmin;
  const canSave  = studentList.length > 0 && (!locked || isAdmin);

  const recoveryStudents = studentList.filter((e) => {
    const s = studentStatus(e.av1, e.av2, e.final, pg, fpg);
    return s === 'recovery' || s === 'approved_final' || s === 'failed';
  });
  const hasFinalPhase = recoveryStudents.length > 0;

  async function save() {
    setSaving(true);
    try {
      const batch = studentList.map((e) => ({
        student_id: e.student_id,
        ...(e.av1 !== null ? { av1: e.av1 } : {}),
        ...(e.av2 !== null ? { av2: e.av2 } : {}),
      }));
      await gradesService.saveBatch(classId, subject, period, batch);
      setLocked(true);
      setEntries((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) next[k] = { ...next[k], av1av2Locked: true };
        return next;
      });
      setToast({ type: 'success', msg: `AV1/AV2 salvas para ${period} — ${subject}` });
    } catch (err: any) {
      const msg = err?.code === 'already_locked'
        ? 'AV1/AV2 já lançadas. Somente a gestão pode alterá-las.'
        : err?.message ?? 'Erro ao salvar notas';
      setToast({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  }

  async function saveFinal() {
    setSavingFinal(true);
    try {
      const batch = recoveryStudents
        .filter((e) => e.final !== null)
        .map((e) => ({ student_id: e.student_id, final: e.final! }));
      if (batch.length === 0) { setToast({ type: 'error', msg: 'Nenhuma nota final preenchida.' }); return; }
      await gradesService.saveBatch(classId, subject, period, batch);
      setToast({ type: 'success', msg: `Prova Final salva — ${batch.length} aluno(s)` });
      await loadContext();
    } catch (err: any) {
      setToast({ type: 'error', msg: err?.message ?? 'Erro ao salvar prova final.' });
    } finally {
      setSavingFinal(false);
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      await gradesService.saveSettings(settingsForm);
      setSettings(settingsForm);
      setSettingsOpen(false);
    } catch { setToast({ type: 'error', msg: 'Erro ao salvar configurações.' }); }
    finally { setSettingsSaving(false); }
  }

  // Boletim pivot
  const boletimPivot = useMemo(() => {
    if (!boletim) return null;
    const subjects = [...new Set(boletim.grades.map((g) => g.subject))].sort();
    const periods  = [...new Set(boletim.grades.map((g) => g.period))].sort();
    const map: Record<string, Record<string, { av1: number | null; av2: number | null; final: number | null }>> = {};
    for (const g of boletim.grades) {
      const key = `${g.subject}||${g.period}`;
      if (!map[g.student_id]) map[g.student_id] = {};
      if (!map[g.student_id][key]) map[g.student_id][key] = { av1: null, av2: null, final: null };
      if (g.assessment_type === 'av1')   map[g.student_id][key].av1   = g.grade;
      if (g.assessment_type === 'av2')   map[g.student_id][key].av2   = g.grade;
      if (g.assessment_type === 'final') map[g.student_id][key].final = g.grade;
    }
    return { subjects, periods, map };
  }, [boletim]);

  // Donut helper
  function Donut({ data }: { data: { label: string; value: number; color: string }[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <p className="py-4 text-center text-xs text-ink-muted">Nenhuma nota lançada para este período.</p>;
    const R = 44; const C = 2 * Math.PI * R;
    let acc = 0;
    return (
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 110 110" className="h-28 w-28 -rotate-90">
          {data.filter(d => d.value > 0).map((d) => {
            const dash = (d.value / total) * C;
            const off  = acc; acc += dash;
            return <circle key={d.label} cx="55" cy="55" r={R} fill="none" stroke={d.color}
              strokeWidth="16" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-off} />;
          })}
        </svg>
        <div className="w-full space-y-1">
          {data.filter(d => d.value > 0).map(d => (
            <div key={d.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-muted">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                {d.label}
              </span>
              <span className="font-bold text-ink">{d.value} <span className="font-normal text-ink-subtle">({((d.value/total)*100).toFixed(0)}%)</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-ink-muted">
      <Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span>
    </div>
  );

  const subjectList = classSubjects.length > 0 ? classSubjects.map(s => s.name) : SUBJECTS;

  return (
    <>
      <PageHeader
        title={isBoletimRoute ? 'Boletim' : 'Lançar Notas'}
        subtitle={isBoletimRoute ? 'Visualize o desempenho dos alunos por disciplina e período.' : 'Lance e acompanhe as notas dos alunos por disciplina e unidade.'}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                className="btn-outline flex items-center gap-1.5"
                onClick={() => { setSettingsForm(settings); setSettingsOpen(true); }}
              >
                <Settings size={15} /> Configurações
              </button>
            )}
            {!isBoletimRoute && !readOnly && !locked && (
              <button className="btn-primary flex items-center gap-2" onClick={save}
                disabled={!canSave || saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando…' : 'Salvar AV1/AV2'}
              </button>
            )}
            {!isBoletimRoute && isAdmin && locked && (
              <button className="btn-primary flex items-center gap-2" onClick={save}
                disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Salvando…' : 'Salvar Alteração'}
              </button>
            )}
          </div>
        }
      />

      {/* =================== LANÇAR NOTAS =================== */}
      {!isBoletimRoute && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">

          {/* Coluna principal 70% */}
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
                {isAdmin ? 'AV1/AV2 encerradas pelo professor. Como gestor, pode substituí-las.' : 'AV1/AV2 encerradas. Somente a gestão pode alterar.'}
              </div>
            )}

            {/* Filtros */}
            <div className="card p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">Turma</label>
                  <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Disciplina</label>
                  <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
                    {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Período (Unidade)</label>
                  <select className="input" value={period} onChange={e => setPeriod(e.target.value)}>
                    {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-ink-muted border-t border-border pt-2.5">
                <div className="flex items-center gap-2">
                  <span>Nota mínima de aprovação: <strong className="text-ink">{settings.passing_grade.toFixed(1)}</strong></span>
                  <span>·</span>
                  <span>Mínimo na Final: <strong className="text-ink">{settings.final_passing_grade.toFixed(1)}</strong></span>
                </div>
                {isAdmin && (
                  <button
                    className="text-primary hover:underline font-semibold"
                    onClick={() => { setSettingsForm(settings); setSettingsOpen(true); }}
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de notas */}
            <div className="card overflow-hidden">
              {studentList.length === 0 ? (
                <EmptyState icon={Star} title="Nenhum aluno nesta turma" description="Vincule alunos a esta turma para lançar notas." />
              ) : (
                <>
                  {/* Cabeçalho */}
                  <div className="grid grid-cols-[1fr_7rem_7rem_6rem_8rem] gap-x-3 border-b border-border bg-canvas px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    <span>Aluno</span>
                    <span className="text-center">AV1</span>
                    <span className="text-center">AV2</span>
                    <span className="text-center">Média</span>
                    <span className="text-center">Status</span>
                  </div>

                  <div className="divide-y divide-border">
                    {studentList.map((entry) => {
                      const m  = avg(entry.av1, entry.av2);
                      const st = studentStatus(entry.av1, entry.av2, entry.final, pg, fpg);
                      const inRecovery = st === 'recovery' || st === 'approved_final' || st === 'failed';
                      const isLocked   = entry.av1av2Locked && !isAdmin;

                      return (
                        <div key={entry.student_id} className="hover:bg-canvas">
                          {/* Linha principal AV1/AV2 */}
                          <div className="grid grid-cols-[1fr_7rem_7rem_6rem_8rem] items-center gap-x-3 px-4 py-3">
                            {/* Nome */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                {entry.student_name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">{entry.student_name}</p>
                                {entry.registration_number && <p className="text-[11px] text-ink-subtle">Mat. {entry.registration_number}</p>}
                              </div>
                            </div>

                            {/* AV1 */}
                            <div className="flex justify-center">
                              {isLocked ? (
                                <span className={`text-sm font-bold ${entry.av1 !== null && entry.av1 >= pg ? 'text-success' : entry.av1 !== null && entry.av1 < 5 ? 'text-danger' : 'text-warning'}`}>
                                  {fmt(entry.av1)}
                                </span>
                              ) : (
                                <input type="number" min={0} max={10} step={0.1}
                                  className="input w-20 text-center text-sm font-semibold"
                                  value={entry.av1 !== null ? entry.av1 : ''}
                                  onChange={e => setField(entry.student_id, 'av1', e.target.value)} />
                              )}
                            </div>

                            {/* AV2 */}
                            <div className="flex justify-center">
                              {isLocked ? (
                                <span className={`text-sm font-bold ${entry.av2 !== null && entry.av2 >= pg ? 'text-success' : entry.av2 !== null && entry.av2 < 5 ? 'text-danger' : 'text-warning'}`}>
                                  {fmt(entry.av2)}
                                </span>
                              ) : (
                                <input type="number" min={0} max={10} step={0.1}
                                  className="input w-20 text-center text-sm font-semibold"
                                  value={entry.av2 !== null ? entry.av2 : ''}
                                  onChange={e => setField(entry.student_id, 'av2', e.target.value)} />
                              )}
                            </div>

                            {/* Média */}
                            <div className="flex justify-center">
                              <span className={`text-sm font-bold ${m !== null && m >= pg ? 'text-success' : m !== null && m < 5 ? 'text-danger' : m !== null ? 'text-warning' : 'text-ink-muted'}`}>
                                {fmt(m)}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="flex justify-center">
                              <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[st]}`}>
                                {STATUS_LABEL[st]}
                              </span>
                            </div>
                          </div>

                          {/* Linha da Prova Final (só se em recuperação) */}
                          {inRecovery && (
                            <div className="flex items-center gap-4 border-t border-border/50 bg-warning-soft/20 px-4 py-2.5">
                              <span className="text-xs font-semibold text-warning">Prova Final</span>
                              <div className="flex items-center gap-2">
                                <input type="number" min={0} max={10} step={0.1}
                                  className="input w-20 text-center text-sm font-semibold"
                                  placeholder="—"
                                  value={entry.final !== null ? entry.final : ''}
                                  onChange={e => setField(entry.student_id, 'final', e.target.value)} />
                                {entry.final !== null && (
                                  <span className={`text-xs font-bold ${entry.final >= fpg ? 'text-success' : 'text-danger'}`}>
                                    {entry.final >= fpg ? '✓ Aprovado' : '✗ Reprovado'}
                                  </span>
                                )}
                              </div>
                              {entry.final !== null && (
                                <span className={`ml-auto rounded-xl px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[st]}`}>
                                  {STATUS_LABEL[st]}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Rodapé: Prova Final */}
            {!readOnly && studentList.length > 0 && hasFinalPhase && (
              <div className="flex items-center justify-between rounded-xl border border-warning/40 bg-warning-soft px-4 py-3">
                <span className="text-sm text-warning font-medium">
                  {recoveryStudents.length} aluno(s) em recuperação — lance a Prova Final.
                </span>
                <button className="inline-flex items-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-white hover:bg-warning/90 disabled:opacity-50"
                  onClick={saveFinal} disabled={savingFinal}>
                  {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {savingFinal ? 'Salvando…' : 'Salvar Prova Final'}
                </button>
              </div>
            )}
          </div>

          {/* Coluna lateral 30% */}
          <div className="space-y-4">
            {/* Gráfico pizza */}
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <PieChart size={16} className="text-primary" /> Resumo — {period}
              </div>
              {summaryLoading ? (
                <div className="flex justify-center py-6 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
              ) : summary ? (
                <Donut data={[
                  { label: 'Aprovados',         value: summary.statusCounts.approved,       color: '#00B894' },
                  { label: 'Aprovados (Final)',  value: summary.statusCounts.approved_final, color: '#3B82F6' },
                  { label: 'Recuperação',        value: summary.statusCounts.recovery,       color: '#F59E0B' },
                  { label: 'Reprovados',         value: summary.statusCounts.failed,         color: '#EF4444' },
                ]} />
              ) : null}
            </div>

            {/* Desempenho por disciplina */}
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                <BarChart2 size={16} className="text-primary" /> Desempenho por disciplina
              </div>
              {summaryLoading ? (
                <div className="flex justify-center py-6 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
              ) : !summary || summary.bySubject.length === 0 ? (
                <p className="py-4 text-center text-xs text-ink-muted">Nenhuma nota lançada.</p>
              ) : (
                <div className="space-y-3">
                  {summary.bySubject.map(s => (
                    <div key={s.subject}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{s.subject}</span>
                        <span className={`font-bold ${s.avg >= pg ? 'text-success' : s.avg < 5 ? 'text-danger' : 'text-warning'}`}>
                          {s.avg.toFixed(1)} — {(s.passing_rate * 100).toFixed(0)}% aprovados
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-canvas overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${s.passing_rate >= 0.7 ? 'bg-success' : s.passing_rate >= 0.5 ? 'bg-warning' : 'bg-danger'}`}
                          style={{ width: `${(s.passing_rate * 100).toFixed(0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================== BOLETIM =================== */}
      {isBoletimRoute && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Turma</label>
                <select className="input" value={classId} onChange={e => setClassId(e.target.value)}>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {boletimLoading ? (
            <div className="flex justify-center py-12 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
          ) : !boletim || boletim.students.length === 0 ? (
            <div className="card"><EmptyState icon={Star} title="Nenhuma nota lançada" description="As notas aparecem aqui conforme forem lançadas." /></div>
          ) : boletimPivot && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-canvas">
                      <th className="sticky left-0 bg-canvas px-4 py-3 text-left font-semibold text-ink whitespace-nowrap" rowSpan={2}>Aluno</th>
                      {boletimPivot.subjects.map(subj => (
                        <th key={subj} colSpan={boletimPivot.periods.length}
                          className="border-l border-border px-2 py-1.5 text-center font-bold text-ink">
                          {subj}
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b border-border bg-canvas">
                      {boletimPivot.subjects.flatMap(subj =>
                        boletimPivot.periods.map(per => (
                          <th key={`${subj}||${per}`} className="border-l border-border px-2 py-1.5 text-center font-medium text-ink-muted whitespace-nowrap">
                            {per.replace('ª Unidade', 'U')}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {boletim.students.map(stu => {
                      return (
                        <tr key={stu.id} className="hover:bg-canvas">
                          <td className="sticky left-0 bg-white px-4 py-2.5 hover:bg-canvas whitespace-nowrap">
                            <p className="font-medium text-ink">{stu.name}</p>
                            {stu.registration_number && <p className="text-[10px] text-ink-subtle">{stu.registration_number}</p>}
                          </td>
                          {boletimPivot.subjects.flatMap(subj =>
                            boletimPivot.periods.map(per => {
                              const g = boletimPivot.map[stu.id]?.[`${subj}||${per}`];
                              const m = g ? avg(g.av1, g.av2) : null;
                              const st = g ? studentStatus(g.av1, g.av2, g.final, pg, fpg) : 'pending';
                              return (
                                <td key={`${subj}||${per}`} className="border-l border-border px-2 py-2.5 text-center">
                                  {m !== null ? (
                                    <div>
                                      <span className={`inline-block rounded-lg px-2 py-0.5 font-bold ${STATUS_CLS[st]}`}>
                                        {m.toFixed(1)}
                                      </span>
                                      {g?.final !== null && g?.final !== undefined && (
                                        <div className="mt-0.5 text-[10px] text-ink-muted">F:{g.final.toFixed(1)}</div>
                                      )}
                                    </div>
                                  ) : <span className="text-ink-subtle">—</span>}
                                </td>
                              );
                            })
                          )}
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

      {/* Modal de configurações */}
      <Modal
        open={settingsOpen}
        title="Configurações de Avaliação"
        onClose={() => setSettingsOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setSettingsOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Defina as notas mínimas utilizadas para calcular aprovação nesta escola.</p>
          <div>
            <label className="label">Nota mínima de aprovação (AV1/AV2)</label>
            <input type="number" min={0} max={10} step={0.5} className="input"
              value={settingsForm.passing_grade}
              onChange={e => setSettingsForm(f => ({ ...f, passing_grade: Number(e.target.value) }))} />
            <p className="mt-1 text-xs text-ink-muted">Ex.: 6.0 ou 7.0. Média abaixo desse valor vai para a Prova Final.</p>
          </div>
          <div>
            <label className="label">Nota mínima na Prova Final</label>
            <input type="number" min={0} max={10} step={0.5} className="input"
              value={settingsForm.final_passing_grade}
              onChange={e => setSettingsForm(f => ({ ...f, final_passing_grade: Number(e.target.value) }))} />
            <p className="mt-1 text-xs text-ink-muted">Ex.: 5.0. Aluno que alcançar essa nota na Final é aprovado.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
