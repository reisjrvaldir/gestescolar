import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Loader2, Plus, RefreshCw, Save, Send, ChevronLeft, ChevronRight,
  MessageSquare, CheckCircle2, AlertTriangle, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import {
  lessonPlansService, mondayOf, weekLabel, WEEKDAYS, LESSON_PLAN_STATUS,
  type LessonPlan, type LessonPlanDetail, type LessonPlanOptions, type LessonPlanDay,
} from '@/services/lessonPlans';
import { useMe } from '@/auth/AuthGate';

/** Campos do bloco semanal, na ordem em que aparecem no formulário. */
const WEEK_FIELDS = [
  { key: 'objectives',  label: 'Objetivos de aprendizagem', hint: 'O que os alunos devem ser capazes de fazer ao fim da semana.' },
  { key: 'contents',    label: 'Conteúdos',                 hint: 'Temas e habilidades trabalhados.' },
  { key: 'methodology', label: 'Metodologia',               hint: 'Como a aula será conduzida.' },
  { key: 'resources',   label: 'Recursos',                  hint: 'Materiais, livros, equipamentos.' },
  { key: 'evaluation',  label: 'Avaliação',                 hint: 'Como a aprendizagem será verificada.' },
  { key: 'notes',       label: 'Observações',               hint: 'Adaptações, alunos com necessidades específicas, avisos.' },
] as const;

type FormState = Record<string, string>;

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function LessonPlansPage() {
  const me = useMe();
  const canReview = ['coordinator', 'school_admin', 'superadmin'].includes(me?.role ?? '');

  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [options, setOptions] = useState<LessonPlanOptions>({ classes: [], teachers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor
  const [editing, setEditing] = useState<LessonPlanDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [days, setDays] = useState<Record<number, LessonPlanDay>>({});
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o] = await Promise.all([
        lessonPlansService.list({ week_start: week }),
        lessonPlansService.options(),
      ]);
      setPlans(p);
      setOptions(o);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível carregar os planejamentos.');
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  const selectedClass = useMemo(
    () => options.classes.find((c) => c.id === classId),
    [options.classes, classId],
  );

  function resetEditor() {
    setEditing(null);
    setCreating(false);
    setForm({});
    setDays({});
    setClassId('');
    setSubjectId('');
    setComment('');
  }

  function openCreate() {
    resetEditor();
    setCreating(true);
    const first = options.classes[0];
    if (first) setClassId(first.id);
  }

  async function openPlan(id: string) {
    setBusy(true);
    try {
      const detail = await lessonPlansService.get(id);
      setEditing(detail);
      setCreating(false);
      setClassId(detail.class_id);
      setSubjectId(detail.subject_id ?? '');
      setForm(Object.fromEntries(WEEK_FIELDS.map((f) => [f.key, (detail as any)[f.key] ?? ''])));
      setDays(Object.fromEntries(detail.days.map((d) => [d.weekday, d])));
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível abrir o plano.');
    } finally {
      setBusy(false);
    }
  }

  const payload = () => ({
    class_id: classId,
    subject_id: subjectId || null,
    week_start: week,
    ...Object.fromEntries(WEEK_FIELDS.map((f) => [f.key, form[f.key] ?? ''])),
    days: WEEKDAYS.map((w) => ({ ...days[w.n], weekday: w.n })).filter(
      (d) => d.content || d.activity || d.homework,
    ),
  });

  async function save(thenSubmit = false) {
    if (!classId) { setError('Escolha a turma.'); return; }
    setBusy(true);
    setError(null);
    try {
      let id = editing?.id;
      if (id) {
        await lessonPlansService.update(id, payload());
      } else {
        id = (await lessonPlansService.create(payload())).id;
      }
      if (thenSubmit && id) await lessonPlansService.submit(id);
      resetEditor();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approve' | 'request_changes') {
    if (!editing) return;
    if (decision === 'request_changes' && !comment.trim()) {
      setError('Descreva o ajuste solicitado.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await lessonPlansService.review(editing.id, decision, comment.trim() || undefined);
      resetEditor();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível registrar a decisão.');
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!editing || !comment.trim()) return;
    setBusy(true);
    try {
      const c = await lessonPlansService.comment(editing.id, comment.trim());
      setEditing({ ...editing, comments: [...editing.comments, c] });
      setComment('');
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível comentar.');
    } finally {
      setBusy(false);
    }
  }

  const editorOpen = creating || !!editing;
  // Aprovado é definitivo para o professor; a coordenação ainda pode reabrir.
  const readOnly = !!editing && editing.status === 'approved' && !canReview;

  return (
    <>
      <PageHeader
        title="Planejamento de aulas"
        subtitle={canReview
          ? 'Acompanhe, comente e aprove os planejamentos semanais dos professores.'
          : 'Registre o planejamento da sua semana e envie para a coordenação.'}
        actions={
          <button className="btn-primary" onClick={openCreate} disabled={options.classes.length === 0}>
            <Plus size={16} /> Novo plano
          </button>
        }
      />

      {/* Navegação por semana */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          <button className="btn-ghost px-2 py-1.5" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[9.5rem] px-2 text-center text-sm font-semibold text-ink">
            {weekLabel(week)}
          </span>
          <button className="btn-ghost px-2 py-1.5" onClick={() => setWeek(shiftWeek(week, 1))} aria-label="Próxima semana">
            <ChevronRight size={16} />
          </button>
        </div>
        {week !== mondayOf(new Date()) && (
          <button className="btn-outline" onClick={() => setWeek(mondayOf(new Date()))}>Semana atual</button>
        )}
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && !editorOpen && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 className="animate-spin" size={22} /> <span className="ml-2">Carregando…</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="card p-10 text-center">
          <BookOpen size={28} className="mx-auto mb-3 text-ink-subtle" />
          <p className="font-semibold text-ink">Nenhum plano nesta semana</p>
          <p className="mt-1 text-sm text-ink-muted">
            {canReview
              ? 'Quando os professores enviarem, os planos aparecem aqui.'
              : 'Crie o planejamento da sua semana e envie para a coordenação.'}
          </p>
          {options.classes.length > 0 && (
            <button className="btn-primary mx-auto mt-5" onClick={openCreate}>
              <Plus size={16} /> Criar plano
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const st = LESSON_PLAN_STATUS[p.status];
            return (
              <button
                key={p.id}
                onClick={() => openPlan(p.id)}
                className="card p-4 text-left transition-shadow hover:shadow-card-hover"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{p.class_name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      {p.subject_name ?? 'Todas as matérias'}
                    </p>
                  </div>
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </div>
                {canReview && (
                  <p className="truncate text-xs text-ink-subtle">Prof. {p.teacher_name}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Editor / revisão ── */}
      <Modal
        open={editorOpen}
        onClose={resetEditor}
        title={creating ? 'Novo planejamento' : `${editing?.class_name ?? ''} · ${weekLabel(week)}`}
      >
        <div className="space-y-5">
          {error && (
            <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</div>
          )}

          {editing && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge tone={LESSON_PLAN_STATUS[editing.status].tone}>
                {LESSON_PLAN_STATUS[editing.status].label}
              </StatusBadge>
              <span className="text-ink-muted">Prof. {editing.teacher_name}</span>
              {editing.reviewer_name && (
                <span className="text-ink-subtle">· revisado por {editing.reviewer_name}</span>
              )}
            </div>
          )}

          {/* Turma e matéria */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="lp-class">Turma</label>
              <select
                id="lp-class"
                className="input"
                value={classId}
                disabled={!creating || readOnly}
                onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
              >
                <option value="">Selecione…</option>
                {options.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="lp-subject">Matéria</label>
              <select
                id="lp-subject"
                className="input"
                value={subjectId}
                disabled={!creating || readOnly}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Todas as matérias (regente)</option>
                {selectedClass?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-ink-subtle">
                Deixe em "todas" se você leciona tudo para esta turma.
              </p>
            </div>
          </div>

          {/* Bloco da semana */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink">A semana</h3>
            {WEEK_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label" htmlFor={`lp-${f.key}`}>{f.label}</label>
                <textarea
                  id={`lp-${f.key}`}
                  className="input min-h-[4.5rem] resize-y"
                  value={form[f.key] ?? ''}
                  readOnly={readOnly}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.hint}
                />
              </div>
            ))}
          </div>

          {/* Dia a dia */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-ink">Dia a dia</h3>
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
                      aria-label={`Conteúdo de ${w.label}`}
                      value={d.content ?? ''} readOnly={readOnly}
                      onChange={(e) => set('content', e.target.value)}
                    />
                    <textarea
                      className="input min-h-[3.5rem] resize-y" placeholder="Atividade"
                      aria-label={`Atividade de ${w.label}`}
                      value={d.activity ?? ''} readOnly={readOnly}
                      onChange={(e) => set('activity', e.target.value)}
                    />
                    <textarea
                      className="input min-h-[3.5rem] resize-y" placeholder="Tarefa de casa"
                      aria-label={`Tarefa de casa de ${w.label}`}
                      value={d.homework ?? ''} readOnly={readOnly}
                      onChange={(e) => set('homework', e.target.value)}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conversa */}
          {editing && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <MessageSquare size={15} /> Comentários
              </h3>
              {editing.comments.length === 0 ? (
                <p className="text-sm text-ink-subtle">Nenhum comentário ainda.</p>
              ) : (
                <div className="space-y-2">
                  {editing.comments.map((c) => (
                    <div key={c.id} className="rounded-xl bg-canvas px-3 py-2">
                      <p className="text-xs font-semibold text-ink">{c.author_name}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-muted">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="input min-h-[3.5rem] resize-y"
                placeholder={canReview ? 'Comentário ou ajuste solicitado…' : 'Responder à coordenação…'}
                aria-label="Novo comentário"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              {!canReview && (
                <button className="btn-outline" onClick={addComment} disabled={busy || !comment.trim()}>
                  <MessageSquare size={15} /> Comentar
                </button>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <button className="btn-ghost" onClick={resetEditor} disabled={busy}>
              <X size={15} /> Fechar
            </button>

            {canReview && editing ? (
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
      </Modal>
    </>
  );
}
