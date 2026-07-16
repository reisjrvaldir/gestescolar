import { useEffect, useState, useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown, Award, BarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { gradesService, type MyBoletimData } from '@/services/grades';
import { api } from '@/lib/api';

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function fmt(v: number | null | undefined): string {
  return v !== null && v !== undefined && Number.isFinite(v) ? v.toFixed(1) : '—';
}

const STATUS_LABEL: Record<string, string> = {
  pending:        'Andamento',
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

interface ChildStat {
  id: string;
  name: string;
  registration_number: string;
  monthly_fee: number;
  photo_url?: string;
  class_name?: string;
  class_year?: number;
}

export function GuardianBoletim() {
  const [data, setData] = useState<MyBoletimData | null>(null);
  const [childStats, setChildStats] = useState<ChildStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [boletim, dash] = await Promise.all([
          gradesService.myBoletim(),
          api.get<{ ok: boolean; data: any }>('/dashboard/stats'),
        ]);
        setData(boletim);
        if (boletim.students.length > 0) {
          setSelectedStudent(boletim.students[0].id);
          const child = dash.data.children?.find((c: any) => c.id === boletim.students[0].id);
          if (child) setChildStats(child);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedStudent || !data) return;
    async function loadChild() {
      try {
        const dash = await api.get<{ ok: boolean; data: any }>('/dashboard/stats');
        const child = dash.data.children?.find((c: any) => c.id === selectedStudent);
        if (child) setChildStats(child);
      } catch { /* */ }
    }
    loadChild();
  }, [selectedStudent]);

  const settings = data?.settings ?? { passing_grade: 7, final_passing_grade: 5 };
  const student = data?.students.find(s => s.id === selectedStudent);

  // Group grades by subject for selected student
  const gradesBySubject = useMemo(() => {
    if (!data || !selectedStudent) return {};
    const map: Record<string, Record<string, { av1: number | null; av2: number | null; final: number | null }>> = {};
    for (const g of data.grades) {
      if (g.student_id !== selectedStudent) continue;
      if (!map[g.subject]) map[g.subject] = {};
      if (!map[g.subject][g.period]) map[g.subject][g.period] = { av1: null, av2: null, final: null };
      map[g.subject][g.period][g.assessment_type] = g.grade;
    }
    return map;
  }, [data, selectedStudent]);

  const subjects = Object.keys(gradesBySubject).sort();
  const periods = useMemo(() => {
    const set = new Set<string>();
    if (data) for (const g of data.grades) if (g.student_id === selectedStudent) set.add(g.period);
    return Array.from(set).sort();
  }, [data, selectedStudent]);

  // Compute per-subject avg across all periods
  const subjectAvgs = useMemo(() => {
    const result: Record<string, { avg: number; periods: number[]; status: string }> = {};
    for (const subj of subjects) {
      const unitAvgs: number[] = [];
      for (const per of periods) {
        const g = gradesBySubject[subj]?.[per];
        if (g && g.av1 !== null && g.av2 !== null) {
          unitAvgs.push((g.av1 + g.av2) / 2);
        }
      }
      const avg = unitAvgs.length > 0 ? unitAvgs.reduce((a, b) => a + b, 0) / unitAvgs.length : 0;
      let status = 'pending';
      if (unitAvgs.length === periods.length && periods.length > 0) {
        status = avg >= settings.passing_grade ? 'approved' : 'recovery';
      } else if (unitAvgs.length > 0) {
        status = avg >= settings.passing_grade ? 'approved' : 'pending';
      }
      result[subj] = { avg, periods: unitAvgs, status };
    }
    return result;
  }, [gradesBySubject, subjects, periods, settings]);

  // Ranking
  const rankingInfo = useMemo(() => {
    if (!data || !selectedStudent || !student?.class_id) return null;
    const classRanking = data.ranking.filter(r => r.class_id === student.class_id);
    const pos = classRanking.findIndex(r => r.student_id === selectedStudent);
    if (pos === -1) return null;
    return { position: pos + 1, total: classRanking.length };
  }, [data, selectedStudent, student]);

  // Evolution
  const evolution = useMemo(() => {
    if (periods.length < 2) return null;
    const allPeriodAvgs: number[] = [];
    for (const per of periods) {
      const avgs: number[] = [];
      for (const subj of subjects) {
        const g = gradesBySubject[subj]?.[per];
        if (g && g.av1 !== null && g.av2 !== null) avgs.push((g.av1 + g.av2) / 2);
      }
      if (avgs.length > 0) allPeriodAvgs.push(avgs.reduce((a, b) => a + b, 0) / avgs.length);
    }
    if (allPeriodAvgs.length < 2) return null;
    const last = allPeriodAvgs[allPeriodAvgs.length - 1];
    const prev = allPeriodAvgs[allPeriodAvgs.length - 2];
    return { last, prev, diff: last - prev };
  }, [gradesBySubject, subjects, periods]);

  // Frequency from dashboard stats
  const freqPercent = childStats
    ? Math.round((childStats as any).present_month / Math.max(1, (childStats as any).present_month + (childStats as any).absent_month) * 100)
    : 0;

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  if (!data || data.students.length === 0) {
    return (
      <>
        <PageHeader title="Boletim" subtitle="Notas e desempenho acadêmico" />
        <div className="card"><EmptyState icon={BarChart2} title="Nenhum aluno vinculado" description="Não encontramos alunos vinculados a este responsável." /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Boletim" subtitle="Notas e desempenho acadêmico do(s) seu(s) filho(s)." />

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
            {data.students.length > 1 && (
              <select className="input w-auto" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* Grades table 70% */}
        <div className="card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Notas por disciplina</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-canvas/50">
                  <th className="px-4 py-3 text-left font-semibold text-ink-muted">Disciplina</th>
                  {periods.map(p => (
                    <th key={p} className="px-3 py-3 text-center font-semibold text-ink-muted">{p}</th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-ink-muted">Média Geral</th>
                  <th className="px-3 py-3 text-center font-semibold text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjects.length === 0 ? (
                  <tr><td colSpan={periods.length + 3} className="px-4 py-8 text-center text-ink-subtle">Nenhuma nota lançada.</td></tr>
                ) : (
                  subjects.map((subj) => {
                    const sa = subjectAvgs[subj];
                    return (
                      <tr key={subj} className="hover:bg-canvas/30">
                        <td className="px-4 py-3 font-medium text-ink">{subj}</td>
                        {periods.map((per) => {
                          const g = gradesBySubject[subj]?.[per];
                          const unitAvg = g && g.av1 !== null && g.av2 !== null ? (g.av1 + g.av2) / 2 : null;
                          return (
                            <td key={per} className="px-3 py-3 text-center">
                              <span className={`font-mono font-semibold ${unitAvg !== null && unitAvg < settings.passing_grade ? 'text-danger' : 'text-ink'}`}>
                                {fmt(unitAvg)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className={`font-mono text-lg font-extrabold ${sa.avg >= settings.passing_grade ? 'text-success' : sa.avg > 0 ? 'text-danger' : 'text-ink-muted'}`}>
                            {sa.periods.length > 0 ? fmt(sa.avg) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[sa.status]}`}>
                            {STATUS_LABEL[sa.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right sidebar 30% */}
        <div className="space-y-4">
          {/* Resumo e Insights */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Resumo e Insights</h3>
            <div className="space-y-3">
              {/* Ranking */}
              {rankingInfo && (
                <div className="flex items-center gap-3 rounded-xl bg-primary-soft p-3">
                  <Award size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-bold text-primary">{rankingInfo.position}º lugar</p>
                    <p className="text-xs text-primary/70">entre {rankingInfo.total} alunos da turma</p>
                  </div>
                </div>
              )}
              {!rankingInfo && (
                <div className="rounded-xl bg-canvas p-3 text-center text-xs text-ink-subtle">Ranking ainda não disponível.</div>
              )}

              {/* Evolução */}
              {evolution && (
                <div className={`flex items-center gap-3 rounded-xl p-3 ${evolution.diff >= 0 ? 'bg-success-soft' : 'bg-danger-soft'}`}>
                  {evolution.diff >= 0 ? <TrendingUp size={20} className="text-success" /> : <TrendingDown size={20} className="text-danger" />}
                  <div>
                    <p className={`text-sm font-bold ${evolution.diff >= 0 ? 'text-success' : 'text-danger'}`}>
                      {evolution.diff >= 0 ? 'Evolução positiva' : 'Queda no desempenho'}
                    </p>
                    <p className={`text-xs ${evolution.diff >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
                      Média anterior: {fmt(evolution.prev)} → Atual: {fmt(evolution.last)}
                    </p>
                  </div>
                </div>
              )}

              {/* Frequência */}
              <div className="flex items-center justify-between rounded-xl bg-canvas p-3">
                <span className="text-sm text-ink-muted">Frequência no mês</span>
                <span className={`text-lg font-extrabold ${freqPercent >= 75 ? 'text-success' : 'text-danger'}`}>{freqPercent}%</span>
              </div>
            </div>
          </div>

          {/* Parecer Pedagógico */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Parecer Pedagógico</h3>
            <p className="text-sm text-ink-subtle">Nenhum parecer registrado ainda.</p>
          </div>
        </div>
      </div>
    </>
  );
}
