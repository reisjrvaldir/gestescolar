import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Loader2, Save, Send, ArrowLeft, MessageSquare, CheckCircle2,
  AlertTriangle, Lightbulb,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  lessonPlansService, mondayOf, weekLabel, WEEKDAYS, LESSON_PLAN_STATUS,
  type LessonPlanDetail, type LessonPlanOptions, type LessonPlanDay, type LessonPlanTheme,
} from '@/services/lessonPlans';
import { useMe } from '@/auth/AuthGate';

const WEEK_FIELDS = [
  { key: 'objectives',  label: 'Objetivos de aprendizagem', hint: 'O que os alunos devem ser capazes de fazer ao fim da semana.' },
  { key: 'contents',    label: 'Conteúdos',                 hint: 'Temas e habilidades trabalhados.' },
  { key: 'methodology', label: 'Metodologia',               hint: 'Como a aula será conduzida.' },
  { key: 'resources',   label: 'Recursos',                  hint: 'Materiais, livros, equipamentos.' },
  { key: 'evaluation',  label: 'Avaliação',                 hint: 'Como a aprendizagem será verificada.' },
  { key: 'notes',       label: 'Observações',               hint: 'Adaptações, alunos com necessidades específicas, avisos.' },
] as const;

/**
 * Página única de criação, edição e revisão do plano.
 * `/app/lesson-plans/new` cria; `/app/lesson-plans/:id` abre o existente.
 */
export function LessonPlanFormPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useMe();
  const canReview = ['coordinator', 'school_admin', 'superadmin'].includes(me?.role ?? '');
  const isNew = !id;

  const [week, setWeek] = useState(() => mondayOf(params.get('week') ?? new Date()));
  const [plan, setPlan] = useState<LessonPlanDetail | null>(null);
  const [options, setOptions] = useState<LessonPlanOptions>({ classes: [], teachers: [] });
  const [themes, setThemes] = useState<LessonPlanTheme[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<number, LessonPlanDay>>({});
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isNew) {
        const [o, t] = await Promise.all([
          lessonPlansService.options(),
          lessonPlansService.themes(week),
        ]);
        setOptions(o);
        setThemes(t);
        if (o.classes[0]) setClassId((c) => c || o.classes[0].id);
      } else {
        const d = await lessonPlansService.get(id!);
        setPlan(d);
        setWeek(d.week_start);
        setClassId(d.class_id);
        setSubjectId(d.subject_id ?? '');
        setForm(Object.fromEntries(WEEK_FIELDS.map((f) => [f.key, (d as any)[f.key] ?? ''])));
        setDays(Object.fromEntries(d.days.map((x) => [x.weekday, x])));
        setThemes(await lessonPlansService.themes(d.week_start));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível carregar.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, week]);

  useEffect(() => { load(); }, [load]);

  const selectedClass = useMemo(
    () => options.classes.find((c) => c.id === classId),
    [options.classes, classId],
  );

  // Aprovado é definitivo para o professor; a coordenação ainda pode reabrir.
  const readOnly = (!!plan && plan.status === 'approved' && !canReview) || (!isNew && canReview);

  const payload = () => ({
    class_id: classId,
    subject_id: subjectId || null,
    week_start: week,
    ...Object.fromEntries(WEEK_FIELDS.map((f) => [f.key, form[f.key] ?? ''])),
    days: WEEKDAYS.map((w) => ({ ...days[w.n], weekday: w.n }))
      .filter((d) => d.content || d.activity || d.homework),
  });

  async function save(thenSubmit = false) {
    if (!classId) { setError('Escolha a turma.'); return; }
    setBusy(true);
    setError(null);
    try {
      let planId = plan?.id;
      if (planId) {
        await lessonPlansService.update(planId, payload());
      } else {
        planId = (await lessonPlansService.create(payload())).id;
      }
      if (thenSubmit && planId) await lessonPlansService.submit(planId);
      navigate('/app/lesson-plans');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar.');
      setBusy(false);
    }
  }

  async function decide(decision: 'approve' | 'request_changes') {
    if (!plan) return;
    if (decision === 'request_changes' && !comment.trim()) {
      setError('Descreva o ajuste solicitado.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await lessonPlansService.review(plan.id, decision, comment.trim() || undefined);
      navigate('/app/lesson-plans');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível registrar a decisão.');
      setBusy(false);
    }
  }

  async function addComment() {
    if (!plan || !comment.trim()) return;
    setBusy(true);
    try {
      const c = await lessonPlansService.comment(plan.id, comment.trim());
      setPlan({ ...plan, comments: [...plan.comments, c] });
      setComment('');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível comentar.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-ink-muted">
        <Loader2 className="animate-spin" size={22} /> <span className="ml-2">Carregando…</span>
      </div>
    );
  }

  return (
    <>
      <Link to="/app/lesson-plans" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-primary">
        <ArrowLeft size={15} /> Voltar aos planejamentos
      </Link>

      <PageHeader
        title={isNew ? 'Novo planejamento' : `${plan?.class_name ?? ''} · ${plan?.subject_name ?? 'Todas as matérias'}`}
        subtitle={`Semana de ${weekLabel(week)}`}
        actions={plan ? (
          <div className="flex items-center gap-2">
            <StatusBadge tone={LESSON_PLAN_STATUS[plan.status].tone}>
              {LESSON_PLAN_STATUS[plan.status].label}
            </StatusBadge>
          </div>
        ) : undefined}
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</div>
      )}

      {plan && canReview && (
        <p className="mb-4 text-sm text-ink-muted">
          Professor: <strong className="font-semibold text-ink">{plan.teacher_name}</strong>
          {plan.reviewer_name && <span className="text-ink-subtle"> · revisado por {plan.reviewer_name}</span>}
        </p>
      )}

      {/* Temas definidos pela coordenação para esta semana */}
      {themes.length > 0 && (
        <section className="mb-6 rounded-2xl border border-warning/30 bg-warning-soft p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <Lightbulb size={16} className="text-warning" /> Temas desta semana
          </h2>
          <ul className="space-y-1.5">
            {themes.map((t) => (
              <li key={t.id} className="text-sm">
                <span className="font-semibold text-ink">{t.title}</span>
                {t.description && <span className="text-ink-muted"> — {t.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="space-y-6">
        {/* Turma e matéria */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">Turma e matéria</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="lp-class">Turma</label>
              <select
                id="lp-class" className="input" value={classId}
                disabled={!isNew}
                onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
              >
                <option value="">Selecione…</option>
                {isNew
                  ? options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                  : <option value={classId}>{plan?.class_name}</option>}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="lp-subject">Matéria</label>
              <select
                id="lp-subject" className="input" value={subjectId}
                disabled={!isNew}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Todas as matérias (regente)</option>
                {isNew
                  ? selectedClass?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                  : plan?.subject_id && <option value={plan.subject_id}>{plan.subject_name}</option>}
              </select>
              {isNew && (
                <p className="mt-1 text-xs text-ink-subtle">
                  Deixe em "todas" se você leciona tudo para esta turma.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Bloco da semana */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">A semana</h2>
          <div className="space-y-3">
            {WEEK_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`lp-${f.key}`}>{f.label}</label>
                <textarea
                  id={`lp-${f.key}`}
                  className="input min-h-[4.5rem] resize-y"
                  value={form[f.key] ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={readOnly ? '—' : f.hint}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Dia a dia */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">Dia a dia</h2>
          <div className="space-y-3">
            {WEEKDAYS.map((w) => {
              const d = days[w.n] ?? { weekday: w.n };
              const set = (k: keyof LessonPlanDay, v: string) =>
                setDays({ ...days, [w.n]: { ...d, weekday: w.n, [k]: v } });
              return (
                <div key={w.n} className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-sm font-semibold text-ink">{w.label}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <textarea
                      className="input min-h-[3.5rem] resize-y" placeholder="Conteúdo"
                      aria-label={`Conteúdo de ${w.label}`} value={d.content ?? ''}
                      readOnly={readOnly} onChange={(e) => set('content', e.target.value)}
                    />
                    <textarea
                      className="input min-h-[3.5rem] resize-y" placeholder="Atividade"
                      aria-label={`Atividade de ${w.label}`} value={d.activity ?? ''}
                      readOnly={readOnly} onChange={(e) => set('activity', e.target.value)}
                    />
                    <textarea
                      className="input min-h-[3.5rem] resize-y" placeholder="Tarefa de casa"
                      aria-label={`Tarefa de casa de ${w.label}`} value={d.homework ?? ''}
                      readOnly={readOnly} onChange={(e) => set('homework', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Conversa */}
        {plan && (
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
              <MessageSquare size={15} /> Comentários
            </h2>
            {plan.comments.length === 0 ? (
              <p className="text-sm text-ink-subtle">Nenhum comentário ainda.</p>
            ) : (
              <div className="space-y-2">
                {plan.comments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-canvas px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-ink">{c.author_name}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-muted">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
            <textarea
              className="input mt-3 min-h-[3.5rem] resize-y"
              placeholder={canReview ? 'Comentário ou ajuste solicitado…' : 'Responder à coordenação…'}
              aria-label="Novo comentário"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {!canReview && (
              <button className="btn-outline mt-2" onClick={addComment} disabled={busy || !comment.trim()}>
                <MessageSquare size={15} /> Comentar
              </button>
            )}
          </section>
        )}

        {/* Ações */}
        <div className="flex flex-wrap justify-end gap-2 pb-2">
          <button className="btn-ghost" onClick={() => navigate('/app/lesson-plans')} disabled={busy}>
            Cancelar
          </button>

          {canReview && plan ? (
            <>
              <button className="btn-outline" onClick={() => decide('request_changes')} disabled={busy}>
                <AlertTriangle size={15} /> Solicitar ajuste
              </button>
              <button className="btn-primary" onClick={() => decide('approve')} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Aprovar
              </button>
            </>
          ) : !readOnly ? (
            <>
              <button className="btn-outline" onClick={() => save(false)} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar rascunho
              </button>
              <button className="btn-primary" onClick={() => save(true)} disabled={busy}>
                <Send size={15} /> Enviar para coordenação
              </button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
