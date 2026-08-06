import { api } from '@/lib/api';

/** draft → submitted → (changes_requested → submitted)* → approved */
export type LessonPlanStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved';

export const LESSON_PLAN_STATUS: Record<LessonPlanStatus, { label: string; tone: 'neutral' | 'primary' | 'warning' | 'success' }> = {
  draft:             { label: 'Rascunho',        tone: 'neutral' },
  submitted:         { label: 'Aguardando',      tone: 'primary' },
  changes_requested: { label: 'Ajuste pedido',   tone: 'warning' },
  approved:          { label: 'Aprovado',        tone: 'success' },
};

/** 1 = segunda … 5 = sexta (ISO, alinhado com o backend). */
export const WEEKDAYS = [
  { n: 1, label: 'Segunda', short: 'Seg' },
  { n: 2, label: 'Terça',   short: 'Ter' },
  { n: 3, label: 'Quarta',  short: 'Qua' },
  { n: 4, label: 'Quinta',  short: 'Qui' },
  { n: 5, label: 'Sexta',   short: 'Sex' },
] as const;

export interface LessonPlanDay {
  weekday: number;
  content?: string | null;
  activity?: string | null;
  homework?: string | null;
}

export interface LessonPlanComment {
  id: string;
  body: string;
  created_at: string;
  author_name: string;
  /** Papel de quem escreveu — usado para diferenciar a thread visualmente. */
  author_role?: string | null;
}

/** Papéis que revisam o planejamento (decidido com o usuário em 05/08/2026). */
export const REVIEWER_ROLES = ['coordinator', 'school_admin', 'superadmin'];

export const isReviewerRole = (role?: string | null) => REVIEWER_ROLES.includes(role ?? '');

export interface LessonPlan {
  id: string;
  class_id: string;
  class_name: string;
  /** Nulo = plano da turma inteira (professor regente). */
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id: string;
  teacher_name: string;
  week_start: string;
  status: LessonPlanStatus;
  objectives?: string | null;
  contents?: string | null;
  methodology?: string | null;
  resources?: string | null;
  evaluation?: string | null;
  notes?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonPlanDetail extends LessonPlan {
  days: LessonPlanDay[];
  comments: LessonPlanComment[];
}

export interface LessonPlanOptions {
  classes: { id: string; name: string; subjects: { id: string; name: string }[] }[];
  teachers: { id: string; name: string }[];
}

export interface LessonPlanInput {
  class_id: string;
  subject_id?: string | null;
  week_start: string;
  objectives?: string;
  contents?: string;
  methodology?: string;
  resources?: string;
  evaluation?: string;
  notes?: string;
  days?: LessonPlanDay[];
  teacher_id?: string;
}

/** Tema institucional da semana, definido pela coordenação. */
export interface LessonPlanTheme {
  id: string;
  week_start: string;
  title: string;
  description?: string | null;
  created_at: string;
  created_by_name?: string | null;
}

export interface LessonPlanFilters {
  status?: LessonPlanStatus;
  class_id?: string;
  teacher_id?: string;
  week_start?: string;
}

/** Segunda-feira da semana de `date`. Espelha mondayOf() do backend. */
export function mondayOf(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

/** "5 a 9 de ago" — rótulo curto da semana. */
export function weekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const d = (x: Date) => x.getUTCDate();
  const m = (x: Date) => x.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
  return m(start) === m(end)
    ? `${d(start)} a ${d(end)} de ${m(end)}`
    : `${d(start)} de ${m(start)} a ${d(end)} de ${m(end)}`;
}

export const lessonPlansService = {
  async list(filters: LessonPlanFilters = {}): Promise<LessonPlan[]> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    const suffix = q.toString() ? `?${q}` : '';
    const r = await api.get<{ data: LessonPlan[] }>(`/lesson-plans${suffix}`);
    return r.data;
  },

  async options(): Promise<LessonPlanOptions> {
    const r = await api.get<{ data: LessonPlanOptions }>('/lesson-plans/options');
    return r.data;
  },

  async get(id: string): Promise<LessonPlanDetail> {
    const r = await api.get<{ data: LessonPlanDetail }>(`/lesson-plans/${id}`);
    return r.data;
  },

  async create(input: LessonPlanInput): Promise<{ id: string }> {
    const r = await api.post<{ data: { id: string } }>('/lesson-plans', input);
    return r.data;
  },

  async update(id: string, input: Partial<LessonPlanInput>): Promise<void> {
    await api.put(`/lesson-plans/${id}`, input);
  },

  async submit(id: string): Promise<void> {
    await api.post(`/lesson-plans/${id}/submit`, {});
  },

  async review(id: string, decision: 'approve' | 'request_changes', note?: string): Promise<void> {
    await api.patch(`/lesson-plans/${id}/review`, { decision, note });
  },

  async comment(id: string, body: string): Promise<LessonPlanComment> {
    const r = await api.post<{ data: LessonPlanComment }>(`/lesson-plans/${id}/comments`, { body });
    return r.data;
  },

  // ── Temas da semana ──
  async themes(weekStart: string): Promise<LessonPlanTheme[]> {
    const r = await api.get<{ data: LessonPlanTheme[] }>(`/lesson-plans/themes?week_start=${weekStart}`);
    return r.data;
  },

  async addTheme(weekStart: string, title: string, description?: string): Promise<LessonPlanTheme> {
    const r = await api.post<{ data: LessonPlanTheme }>('/lesson-plans/themes', {
      week_start: weekStart, title, description,
    });
    return r.data;
  },

  async removeTheme(id: string): Promise<void> {
    await api.del(`/lesson-plans/themes/${id}`);
  },
};
