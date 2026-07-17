import { useEffect, useState, useMemo } from 'react';
import { Loader2, Award, BarChart2, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  present_month?: number;
  absent_month?: number;
}

const FINAL = '__final__';

export function GuardianBoletim() {
  const [data, setData] = useState<MyBoletimData | null>(null);
  const [childStats, setChildStats] = useState<ChildStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('');

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
    (async () => {
      try {
        const dash = await api.get<{ ok: boolean; data: any }>('/dashboard/stats');
        const child = dash.data.children?.find((c: any) => c.id === selectedStudent);
        if (child) setChildStats(child);
      } catch { /* */ }
    })();
  }, [selectedStudent]);

  const settings = data?.settings ?? { passing_grade: 7, final_passing_grade: 5 };
  const student = data?.students.find((s) => s.id === selectedStudent);

  // Notas do aluno agrupadas por disciplina → unidade → {av1, av2, final}.
  const gradesBySubject = useMemo(() => {
    const map: Record<string, Record<string, { av1: number | null; av2: number | null; final: number | null }>> = {};
    if (!data || !selectedStudent) return map;
    for (const g of data.grades) {
      if (g.student_id !== selectedStudent) continue;
      (map[g.subject] ??= {});
      (map[g.subject][g.period] ??= { av1: null, av2: null, final: null });
      map[g.subject][g.period][g.assessment_type] = g.grade;
    }
    return map;
  }, [data, selectedStudent]);

  // Unidades (períodos) existentes nas notas da turma do aluno.
  const units = useMemo(() => {
    const set = new Set<string>();
    if (data) for (const g of data.grades) if (g.student_id === selectedStudent) set.add(g.period);
    return Array.from(set).sort();
  }, [data, selectedStudent]);

  // Todas as matérias da turma (mesmo sem nota) + qualquer disciplina com nota lançada.
  const subjects = useMemo(() => {
    const set = new Set<string>();
    if (student?.class_id && data?.class_subjects) {
      for (const cs of data.class_subjects) if (cs.class_id === student.class_id) set.add(cs.subject);
    }
    for (const s of Object.keys(gradesBySubject)) set.add(s);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [student, data, gradesBySubject]);

  // Seleciona a unidade padrão (última com nota, senão a primeira).
  useEffect(() => {
    if (units.length === 0) { setSelectedUnit(''); return; }
    if (!selectedUnit || (selectedUnit !== FINAL && !units.includes(selectedUnit))) {
      setSelectedUnit(units[units.length - 1]);
    }
  }, [units]);

  function unitMedia(subject: string, unit: string): number | null {
    const g = gradesBySubject[subject]?.[unit];
    if (g && g.av1 !== null && g.av2 !== null) return (g.av1 + g.av2) / 2;
    return null;
  }

  function unitStatus(media: number | null): string {
    if (media === null) return 'pending';
    return media >= settings.passing_grade ? 'approved' : 'recovery';
  }

  // Resultado final por disciplina: média das unidades + status de aprovação.
  function finalResult(subject: string): { medias: (number | null)[]; finalAvg: number | null; status: string } {
    const medias = units.map((u) => unitMedia(subject, u));
    const present = medias.filter((m): m is number => m !== null);
    const finalAvg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null;
    let status = 'pending';
    if (present.length === units.length && units.length > 0 && finalAvg !== null) {
      if (finalAvg >= settings.passing_grade) status = 'approved';
      else {
        // Nota de recuperação/final lançada em qualquer unidade.
        const finalGrade = units.map((u) => gradesBySubject[subject]?.[u]?.final).find((v) => v != null);
        if (finalGrade != null && finalGrade >= settings.final_passing_grade) status = 'approved_final';
        else status = 'failed';
      }
    } else if (finalAvg !== null && finalAvg >= settings.passing_grade) {
      status = 'approved';
    }
    return { medias, finalAvg, status };
  }

  // Ranking
  const rankingInfo = useMemo(() => {
    if (!data || !selectedStudent || !student?.class_id) return null;
    const classRanking = data.ranking.filter((r) => r.class_id === student.class_id);
    const pos = classRanking.findIndex((r) => r.student_id === selectedStudent);
    if (pos === -1) return null;
    return { position: pos + 1, total: classRanking.length };
  }, [data, selectedStudent, student]);

  // Evolução (média geral entre as duas últimas unidades)
  const evolution = useMemo(() => {
    if (units.length < 2) return null;
    const perUnitAvg = units.map((u) => {
      const ms = subjects.map((s) => unitMedia(s, u)).filter((m): m is number => m !== null);
      return ms.length > 0 ? ms.reduce((a, b) => a + b, 0) / ms.length : null;
    }).filter((m): m is number => m !== null);
    if (perUnitAvg.length < 2) return null;
    const last = perUnitAvg[perUnitAvg.length - 1];
    const prev = perUnitAvg[perUnitAvg.length - 2];
    return { last, prev, diff: last - prev };
  }, [units, subjects, gradesBySubject]);

  const freqPercent = childStats
    ? Math.round((childStats.present_month ?? 0) / Math.max(1, (childStats.present_month ?? 0) + (childStats.absent_month ?? 0)) * 100)
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

  const isFinal = selectedUnit === FINAL;
  const hasAllUnits = units.length >= 4;

  return (
    <>
      <PageHeader title="Boletim" subtitle="Notas e desempenho acadêmico do(s) seu(s) filho(s)." />

      {/* Cabeçalho do aluno */}
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
        {/* ============ 70% — Notas ============ */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">
              {isFinal ? 'Resultado final' : 'Notas por disciplina'}
            </h3>
            {/* Filtro de unidade */}
            {units.length > 0 && (
              <select className="input w-auto text-sm" value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value={FINAL}>Resultado final</option>
              </select>
            )}
          </div>

          {units.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma nota lançada ainda para esta turma.</p>
          ) : isFinal ? (
            /* ---- Resultado final: médias das unidades + média final + status ---- */
            <>
              {!hasAllUnits && (
                <div className="flex items-center gap-2 bg-warning-soft px-5 py-2.5 text-xs text-warning">
                  <AlertTriangle size={14} /> O resultado final é consolidado ao término das 4 unidades. Exibindo prévia com as unidades lançadas.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-canvas/50">
                      <th className="px-4 py-3 text-left font-semibold text-ink-muted">Disciplina</th>
                      {units.map((u) => <th key={u} className="px-3 py-3 text-center font-semibold text-ink-muted">{u}</th>)}
                      <th className="px-3 py-3 text-center font-semibold text-ink-muted">Média Final</th>
                      <th className="px-3 py-3 text-center font-semibold text-ink-muted">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {subjects.map((subj) => {
                      const fr = finalResult(subj);
                      return (
                        <tr key={subj} className="hover:bg-canvas/30">
                          <td className="px-4 py-3 font-medium text-ink">{subj}</td>
                          {fr.medias.map((m, i) => (
                            <td key={i} className="px-3 py-3 text-center">
                              <span className={`font-mono ${m !== null && m < settings.passing_grade ? 'text-danger' : 'text-ink'}`}>{fmt(m)}</span>
                            </td>
                          ))}
                          <td className="px-3 py-3 text-center">
                            <span className={`font-mono text-lg font-extrabold ${fr.finalAvg !== null ? (fr.finalAvg >= settings.passing_grade ? 'text-success' : 'text-danger') : 'text-ink-muted'}`}>
                              {fmt(fr.finalAvg)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[fr.status]}`}>{STATUS_LABEL[fr.status]}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            /* ---- Unidade selecionada: AV1, AV2, Média, Status ---- */
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-canvas/50">
                    <th className="px-4 py-3 text-left font-semibold text-ink-muted">Disciplina</th>
                    <th className="px-3 py-3 text-center font-semibold text-ink-muted">AV1</th>
                    <th className="px-3 py-3 text-center font-semibold text-ink-muted">AV2</th>
                    <th className="px-3 py-3 text-center font-semibold text-ink-muted">Média</th>
                    <th className="px-3 py-3 text-center font-semibold text-ink-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subjects.map((subj) => {
                    const g = gradesBySubject[subj]?.[selectedUnit];
                    const media = unitMedia(subj, selectedUnit);
                    const status = unitStatus(media);
                    return (
                      <tr key={subj} className="hover:bg-canvas/30">
                        <td className="px-4 py-3 font-medium text-ink">{subj}</td>
                        <td className="px-3 py-3 text-center font-mono text-ink">{fmt(g?.av1)}</td>
                        <td className="px-3 py-3 text-center font-mono text-ink">{fmt(g?.av2)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-mono text-base font-extrabold ${media !== null ? (media >= settings.passing_grade ? 'text-success' : 'text-danger') : 'text-ink-muted'}`}>
                            {fmt(media)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border px-5 py-2.5 text-[11px] text-ink-subtle">
            Média de aprovação: <strong>{settings.passing_grade.toFixed(1)}</strong> · Nota final de recuperação: <strong>{settings.final_passing_grade.toFixed(1)}</strong>
          </div>
        </div>

        {/* ============ 30% — Resumo ============ */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Resumo e Insights</h3>
            <div className="space-y-3">
              {rankingInfo ? (
                <div className="flex items-center gap-3 rounded-xl bg-primary-soft p-3">
                  <Award size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-bold text-primary">{rankingInfo.position}º lugar</p>
                    <p className="text-xs text-primary/70">entre {rankingInfo.total} alunos da turma</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-canvas p-3 text-center text-xs text-ink-subtle">Ranking ainda não disponível.</div>
              )}

              {evolution && (
                <div className={`flex items-center gap-3 rounded-xl p-3 ${evolution.diff >= 0 ? 'bg-success-soft' : 'bg-danger-soft'}`}>
                  {evolution.diff >= 0 ? <TrendingUp size={20} className="text-success" /> : <TrendingDown size={20} className="text-danger" />}
                  <div>
                    <p className={`text-sm font-bold ${evolution.diff >= 0 ? 'text-success' : 'text-danger'}`}>
                      {evolution.diff >= 0 ? 'Evolução positiva' : 'Queda no desempenho'}
                    </p>
                    <p className={`text-xs ${evolution.diff >= 0 ? 'text-success/70' : 'text-danger/70'}`}>
                      Unidade anterior: {fmt(evolution.prev)} → Atual: {fmt(evolution.last)}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl bg-canvas p-3">
                <span className="text-sm text-ink-muted">Frequência no mês</span>
                <span className={`text-lg font-extrabold ${freqPercent >= 75 ? 'text-success' : 'text-danger'}`}>{freqPercent}%</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
                <CheckCircle2 size={16} className="text-ink-subtle" />
                {units.length} unidade(s) lançada(s) · {subjects.length} disciplina(s) na turma
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">Parecer Pedagógico</h3>
            <p className="text-sm text-ink-subtle">Nenhum parecer registrado ainda.</p>
          </div>
        </div>
      </div>
    </>
  );
}
