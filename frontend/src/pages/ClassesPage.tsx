import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  School2, Plus, Trash2, Users, UserCog, Loader2, BookOpen,
  Search, Eye, MoreVertical, ChevronLeft, ChevronRight, LayoutGrid,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type NewClass, type ClassStudent } from '@/services/classes';
import { subjectsService, LEVEL_LABELS, LEVEL_ORDER, type Subject } from '@/services/subjects';
import { staffService } from '@/services/staff';
import { SHIFT_LABELS, type SchoolClass, type Staff } from '@/types/models';

const PAGE_SIZE = 6;

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');

function KpiMini({ label, value, icon: Icon, tone }: {
  label: string; value: string;
  icon: typeof Users;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const cls: Record<typeof tone, string> = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger:  'bg-danger-soft text-danger',
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-ink-muted">{label}</p>
        <p className="text-xl font-extrabold text-ink">{value}</p>
      </div>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${cls[tone]}`}>
        <Icon size={16} />
      </div>
    </div>
  );
}

export function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectTeacher, setSubjectTeacher] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [studentsFor, setStudentsFor] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Filters
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewClass>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [c, s, subs] = await Promise.all([classesService.list(), staffService.list(), subjectsService.list()]);
      setClasses(c);
      setTeachers(s.filter((t) => (t.role_type ?? t.role) === 'teacher'));
      setSubjects(subs);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // Distinct values for filter dropdowns
  const distinctYears = useMemo(() =>
    Array.from(new Set(classes.map((c) => c.year))).sort((a, b) => b - a), [classes]);

  /** Extrai a série do nome da turma: "9º Ano A" → "9º Ano" */
  const serieOf = (name: string) => name.replace(/\s*[A-Z]$/i, '').trim();

  /** Lista de séries extraídas dos nomes de turma para o dropdown */
  const distinctSeries = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      const serie = serieOf(c.name);
      if (serie) set.add(serie);
    });
    return Array.from(set).sort();
  }, [classes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classes
      .filter((c) => !yearFilter || c.year === Number(yearFilter))
      .filter((c) => !shiftFilter || c.shift === shiftFilter)
      .filter((c) => !levelFilter || c.level === levelFilter || serieOf(c.name) === levelFilter)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (c.teacher_name ?? '').toLowerCase().includes(q));
  }, [classes, query, yearFilter, shiftFilter, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [query, yearFilter, shiftFilter, levelFilter]);

  // KPIs
  const totalStudents = useMemo(() => classes.reduce((s, c) => s + (c.student_count ?? 0), 0), [classes]);
  const activeClasses = useMemo(() => classes.filter((c) => c.status === 'active').length, [classes]);
  const avgStudents = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;

  function openNew() {
    setEditing(null);
    setSelectedSubjects([]);
    setSubjectTeacher({});
    reset({ name: '', year: new Date().getFullYear(), shift: 'morning', level: '', teacher_id: '' });
    setOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    setSelectedSubjects(c.subject_ids ?? []);
    const map: Record<string, string> = {};
    for (const s of c.subjects ?? []) if (s.teacher_id) map[s.subject_id] = s.teacher_id;
    setSubjectTeacher(map);
    const teacherId = c.teacher_id ?? teachers.find((t) => t.name === c.teacher_name)?.id ?? '';
    reset({ name: c.name, year: c.year, shift: c.shift, level: c.level ?? '', teacher_id: teacherId });
    setOpen(true);
  }

  function closeModal() { reset(); setEditing(null); setSelectedSubjects([]); setSubjectTeacher({}); setOpen(false); }

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
    setSubjectTeacher((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  async function onSubmit(data: NewClass) {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...data,
        year: Number(data.year),
        teacher_id: data.teacher_id || undefined,
        subjects: selectedSubjects.map((sid) => ({ subject_id: sid, teacher_id: subjectTeacher[sid] || null })),
      };
      if (editing) {
        await classesService.update(editing.id, payload);
      } else {
        await classesService.create(payload);
      }
      await load();
      closeModal();
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string) {
    if (!confirm('Remover esta turma?')) return;
    await classesService.remove(id);
    await load();
  }

  async function openStudents(c: SchoolClass) {
    setStudentsFor(c);
    setLoadingStudents(true);
    try { setStudents(await classesService.students(c.id)); } catch (e) { console.error(e); setStudents([]); }
    setLoadingStudents(false);
  }

  const grouped = LEVEL_ORDER
    .map((lvl) => ({ lvl, items: subjects.filter((s) => s.level === lvl) }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Gestão de turmas</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Organize, acompanhe e gerencie todas as turmas da sua escola.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
              onClick={openNew}
            >
              <Plus size={18} /> Nova turma
            </button>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
              <School2 size={64} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna 70% — Lista ===== */}
        <div className="min-w-0 space-y-4">
          {/* Filtros */}
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Buscar</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input className="input pl-9" placeholder="Buscar turmas…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Ano letivo</label>
                <select className="input" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                  <option value="">Todos os anos</option>
                  {distinctYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Turno</label>
                <select className="input" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                  <option value="">Todos os turnos</option>
                  <option value="morning">Manhã</option>
                  <option value="afternoon">Tarde</option>
                  <option value="night">Noite</option>
                  <option value="full">Integral</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Nível / Série</label>
                <select className="input" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                  <option value="">Todas as séries</option>
                  {distinctSeries.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={School2}
                title="Nenhuma turma encontrada"
                description="Ajuste os filtros ou crie a primeira turma."
                action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Nova turma</button>}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                        <th className="px-4 py-3">Turma</th>
                        <th className="px-4 py-3">Ano / Série</th>
                        <th className="px-4 py-3">Turno</th>
                        <th className="px-4 py-3 text-center">Alunos</th>
                        <th className="px-4 py-3">Professor responsável</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((c) => (
                        <tr key={c.id} className="border-b border-border last:border-0 hover:bg-canvas">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                                <School2 size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-ink">{c.name}</p>
                                {c.level && (
                                  <span className="inline-block mt-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    {LEVEL_LABELS[c.level] ?? c.level}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{c.level ? LEVEL_LABELS[c.level] ?? c.level : '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{SHIFT_LABELS[c.shift]}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-ink">{c.student_count}</span>
                          </td>
                          <td className="px-4 py-3">
                            {c.teacher_name ? (
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                                  {initials(c.teacher_name)}
                                </div>
                                <span className="truncate text-ink">{c.teacher_name}</span>
                              </div>
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>
                              {c.status === 'active' ? 'Ativa' : 'Inativa'}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-muted hover:bg-primary-soft hover:text-primary"
                                onClick={() => openStudents(c)}
                                title="Ver alunos"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink"
                                onClick={() => openEdit(c)}
                                title="Editar"
                              >
                                <MoreVertical size={16} />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger"
                                onClick={() => onRemove(c.id)}
                                title="Remover"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-ink-muted">
                  <span>
                    Mostrando {(safePage - 1) * PAGE_SIZE + 1} a {Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} turma(s)
                  </span>
                  {totalPages > 1 && (
                    <div className="inline-flex items-center gap-1">
                      <button
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas disabled:opacity-30"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={`h-7 w-7 rounded-lg text-xs font-semibold ${
                            n === safePage ? 'bg-primary text-white' : 'text-ink-muted hover:bg-canvas'
                          }`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        className="rounded-lg p-1.5 text-ink-muted hover:bg-canvas disabled:opacity-30"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ===== Coluna 30% — Resumo ===== */}
        <div className="space-y-4">
          {/* Resumo das turmas */}
          <div className="card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <LayoutGrid size={16} className="text-primary" /> Resumo das turmas
            </div>
            <div className="grid grid-cols-2 gap-3">
              <KpiMini icon={School2} tone="primary" label="Total de turmas" value={classes.length.toString()} />
              <KpiMini icon={Users} tone="success" label="Total de alunos" value={totalStudents.toString()} />
              <KpiMini icon={UserCog} tone="warning" label="Média de alunos por turma" value={avgStudents.toString()} />
              <KpiMini icon={BookOpen} tone="danger" label="Turmas ativas" value={activeClasses.toString()} />
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="card p-5">
            <p className="mb-3 text-sm font-bold text-ink">Ações rápidas</p>
            <div className="space-y-1">
              <button
                className="flex w-full items-center justify-between rounded-xl p-3 text-left text-sm text-ink transition-colors hover:bg-canvas"
                onClick={openNew}
              >
                <span className="flex items-center gap-3">
                  <Users size={16} className="text-primary" /> Nova turma
                </span>
                <ChevronRight size={16} className="text-ink-subtle" />
              </button>
              <button
                className="flex w-full items-center justify-between rounded-xl p-3 text-left text-sm text-ink transition-colors hover:bg-canvas"
                onClick={openNew}
              >
                <span className="flex items-center gap-3">
                  <UserCog size={16} className="text-success" /> Alocar professores
                </span>
                <ChevronRight size={16} className="text-ink-subtle" />
              </button>
              <button
                className="flex w-full items-center justify-between rounded-xl p-3 text-left text-sm text-ink transition-colors hover:bg-canvas"
                onClick={openNew}
              >
                <span className="flex items-center gap-3">
                  <BookOpen size={16} className="text-warning" /> Gerenciar disciplinas
                </span>
                <ChevronRight size={16} className="text-ink-subtle" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de criar/editar turma */}
      <Modal
        open={open}
        title={editing ? 'Editar turma' : 'Nova turma'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal} disabled={saving}>Cancelar</button>
            <button className="btn-primary" form="class-form" type="submit" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />} {editing ? 'Salvar' : 'Criar turma'}
            </button>
          </>
        }
      >
        <form id="class-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="label">Nome da turma *</label>
            <input className="input" placeholder="Ex.: 5º Ano A" {...register('name', { required: 'Informe o nome' })} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Ano letivo *</label>
              <input type="number" className="input" {...register('year', { required: true })} />
            </div>
            <div>
              <label className="label">Turno *</label>
              <select className="input" {...register('shift', { required: true })}>
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noite</option>
                <option value="full">Integral</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nível</label>
              <input className="input" placeholder="Ex.: Fundamental I" {...register('level')} />
            </div>
            <div>
              <label className="label">Professor responsável</label>
              <select className="input" {...register('teacher_id')}>
                <option value="">— Selecione —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Matérias e professores da turma</label>
            <p className="mb-2 text-xs text-ink-subtle">
              Marque as matérias desta turma e, em cada uma, escolha o professor. Assim vários professores
              podem atuar na mesma turma (um por disciplina).
            </p>
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {grouped.length === 0 ? (
                <p className="text-xs text-ink-muted">Nenhuma matéria disponível.</p>
              ) : grouped.map((g) => (
                <div key={g.lvl}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-subtle">{LEVEL_LABELS[g.lvl] ?? g.lvl}</p>
                  <div className="space-y-1.5">
                    {g.items.map((s) => {
                      const checked = selectedSubjects.includes(s.id);
                      return (
                        <div key={s.id} className="flex items-center gap-2">
                          <label className="flex flex-1 items-center gap-2 text-sm text-ink">
                            <input type="checkbox" checked={checked} onChange={() => toggleSubject(s.id)} />
                            {s.name}
                          </label>
                          {checked && (
                            <select
                              className="input w-44 py-1 text-xs"
                              value={subjectTeacher[s.id] ?? ''}
                              onChange={(e) => setSubjectTeacher((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            >
                              <option value="">Professor…</option>
                              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de lista de alunos */}
      <Modal
        open={!!studentsFor}
        title={studentsFor ? `Alunos — ${studentsFor.name}` : 'Alunos'}
        onClose={() => setStudentsFor(null)}
        footer={<button className="btn-primary" onClick={() => setStudentsFor(null)}>Fechar</button>}
      >
        {loadingStudents ? (
          <div className="flex items-center gap-2 py-6 text-ink-muted"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : students.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Nenhum aluno nesta turma.</p>
        ) : (
          <ul className="divide-y divide-border">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="text-xs text-ink-subtle">{s.registration_number ?? '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
