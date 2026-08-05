import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Loader2, Plus, RefreshCw, ChevronLeft, ChevronRight,
  Lightbulb, Trash2, X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  lessonPlansService, mondayOf, weekLabel, LESSON_PLAN_STATUS,
  type LessonPlan, type LessonPlanTheme,
} from '@/services/lessonPlans';
import { useMe } from '@/auth/AuthGate';

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function LessonPlansPage() {
  const me = useMe();
  const navigate = useNavigate();
  const canReview = ['coordinator', 'school_admin', 'superadmin'].includes(me?.role ?? '');

  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [themes, setThemes] = useState<LessonPlanTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulário de tema — inline na própria página, sem popup.
  const [addingTheme, setAddingTheme] = useState(false);
  const [themeTitle, setThemeTitle] = useState('');
  const [themeDesc, setThemeDesc] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, t] = await Promise.all([
        lessonPlansService.list({ week_start: week }),
        lessonPlansService.themes(week),
      ]);
      setPlans(p);
      setThemes(t);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível carregar os planejamentos.');
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  async function saveTheme() {
    if (!themeTitle.trim()) { setError('Informe o título do tema.'); return; }
    setBusy(true);
    setError(null);
    try {
      await lessonPlansService.addTheme(week, themeTitle.trim(), themeDesc.trim() || undefined);
      // Relê a lista: o POST não devolve o nome do autor (viria de um join).
      setThemes(await lessonPlansService.themes(week));
      setThemeTitle('');
      setThemeDesc('');
      setAddingTheme(false);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar o tema.');
    } finally {
      setBusy(false);
    }
  }

  async function removeTheme(id: string) {
    setBusy(true);
    try {
      await lessonPlansService.removeTheme(id);
      setThemes(themes.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível remover o tema.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Planejamento de aulas"
        subtitle={canReview
          ? 'Defina os temas da semana e acompanhe os planejamentos dos professores.'
          : 'Registre o planejamento da sua semana e envie para a coordenação.'}
        actions={
          !canReview ? (
            <button className="btn-primary" onClick={() => navigate(`/app/lesson-plans/new?week=${week}`)}>
              <Plus size={16} /> Novo plano
            </button>
          ) : undefined
        }
      />

      {/* Navegação por semana */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
          <button className="btn-ghost px-2 py-1.5" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Semana anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[9.5rem] px-2 text-center text-sm font-semibold text-ink">{weekLabel(week)}</span>
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

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</div>
      )}

      {/* ── Temas da semana ── */}
      <section className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Lightbulb size={16} className="text-warning" /> Temas desta semana
          </h2>
          {canReview && !addingTheme && (
            <button className="btn-outline" onClick={() => setAddingTheme(true)}>
              <Plus size={15} /> Adicionar tema
            </button>
          )}
        </div>

        {themes.length === 0 && !addingTheme ? (
          <p className="text-sm text-ink-subtle">
            {canReview
              ? 'Nenhum tema definido. Adicione um tema para orientar o planejamento dos professores.'
              : 'A coordenação ainda não definiu temas para esta semana.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {themes.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl bg-canvas px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm text-ink-muted">{t.description}</p>}
                  {t.created_by_name && (
                    <p className="mt-1 text-xs text-ink-subtle">por {t.created_by_name}</p>
                  )}
                </div>
                {canReview && (
                  <button
                    className="btn-ghost shrink-0 px-2 py-1 text-danger"
                    onClick={() => removeTheme(t.id)}
                    disabled={busy}
                    aria-label={`Remover tema ${t.title}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Formulário inline — parte da página, não um popup */}
        {addingTheme && (
          <div className="mt-3 space-y-3 rounded-xl border border-border p-3.5">
            <div>
              <label className="label" htmlFor="tema-titulo">Título do tema</label>
              <input
                id="tema-titulo"
                className="input"
                placeholder="Ex.: Semana da Água"
                value={themeTitle}
                onChange={(e) => setThemeTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="tema-desc">Orientação (opcional)</label>
              <textarea
                id="tema-desc"
                className="input min-h-[4rem] resize-y"
                placeholder="O que os professores devem contemplar no planejamento."
                value={themeDesc}
                onChange={(e) => setThemeDesc(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost"
                onClick={() => { setAddingTheme(false); setThemeTitle(''); setThemeDesc(''); }}
                disabled={busy}
              >
                <X size={15} /> Cancelar
              </button>
              <button className="btn-primary" onClick={saveTheme} disabled={busy || !themeTitle.trim()}>
                {busy && <Loader2 size={15} className="animate-spin" />} Salvar tema
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Planos ── */}
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
          {!canReview && (
            <button className="btn-primary mx-auto mt-5" onClick={() => navigate(`/app/lesson-plans/new?week=${week}`)}>
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
                onClick={() => navigate(`/app/lesson-plans/${p.id}`)}
                className="card p-4 text-left transition-shadow hover:shadow-card-hover"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{p.class_name}</p>
                    <p className="truncate text-sm text-ink-muted">{p.subject_name ?? 'Todas as matérias'}</p>
                  </div>
                  <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                </div>
                {canReview && <p className="truncate text-xs text-ink-subtle">Prof. {p.teacher_name}</p>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
