import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { School2, Plus, Trash2, Pencil, Users, Clock, UserCog, Loader2, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type NewClass, type ClassStudent } from '@/services/classes';
import { subjectsService, LEVEL_LABELS, LEVEL_ORDER, type Subject } from '@/services/subjects';
import { staffService } from '@/services/staff';
import { SHIFT_LABELS, type SchoolClass, type Staff } from '@/types/models';

export function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal de lista de alunos da turma.
  const [studentsFor, setStudentsFor] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

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

  function openNew() {
    setEditing(null);
    setSelectedSubjects([]);
    reset({ name: '', year: new Date().getFullYear(), shift: 'morning', level: '', teacher_id: '' });
    setOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    setSelectedSubjects(c.subject_ids ?? []);
    const teacherId = teachers.find((t) => t.name === c.teacher_name)?.id ?? '';
    reset({ name: c.name, year: c.year, shift: c.shift, level: c.level ?? '', teacher_id: teacherId });
    setOpen(true);
  }

  function closeModal() { reset(); setEditing(null); setSelectedSubjects([]); setOpen(false); }

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  }

  async function onSubmit(data: NewClass) {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...data, year: Number(data.year), teacher_id: data.teacher_id || undefined, subject_ids: selectedSubjects };
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
      <PageHeader
        title="Turmas"
        subtitle="Crie e organize as turmas da sua escola por ano, turno e nível."
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova turma
          </button>
        }
      />

      {classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={School2}
            title="Nenhuma turma criada"
            description="Crie a primeira turma para organizar seus alunos."
            action={<button className="btn-primary" onClick={openNew}><Plus size={16} /> Nova turma</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <School2 size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-ink">{c.name}</p>
                    <p className="text-xs text-ink-subtle">{c.level ?? '—'} · {c.year}</p>
                  </div>
                </div>
                <div className="inline-flex gap-1">
                  <button className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-soft hover:text-primary" onClick={() => openEdit(c)} title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(c.id)} title="Remover">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-ink-muted">
                  <Clock size={15} /> Turno: <span className="font-medium text-ink">{SHIFT_LABELS[c.shift]}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <UserCog size={15} /> Professor: <span className="font-medium text-ink">{c.teacher_name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <BookOpen size={15} /> Matérias: <span className="font-medium text-ink">{c.subject_ids?.length ?? 0}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>
                  {c.status === 'active' ? 'Ativa' : 'Inativa'}
                </StatusBadge>
                <button className="btn-outline text-xs" onClick={() => openStudents(c)}>
                  <Users size={14} /> Ver alunos ({c.student_count})
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <label className="label">Matérias da turma</label>
            <p className="mb-2 text-xs text-ink-subtle">Marque as matérias desta turma. Elas aparecem na chamada e nas avaliações.</p>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {grouped.length === 0 ? (
                <p className="text-xs text-ink-muted">Nenhuma matéria disponível.</p>
              ) : grouped.map((g) => (
                <div key={g.lvl}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-subtle">{LEVEL_LABELS[g.lvl] ?? g.lvl}</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {g.items.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={selectedSubjects.includes(s.id)}
                          onChange={() => toggleSubject(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
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
