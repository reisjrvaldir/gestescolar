import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { School2, Plus, Trash2, Pencil, Users, Clock, UserCog, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { classesService, type NewClass } from '@/services/classes';
import { staffService } from '@/services/staff';
import { SHIFT_LABELS, type SchoolClass, type Staff } from '@/types/models';

export function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NewClass>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([classesService.list(), staffService.list()]);
      setClasses(c);
      setTeachers(s.filter((t) => (t.role_type ?? t.role) === 'teacher'));
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    reset({ name: '', year: new Date().getFullYear(), shift: 'morning', level: '', teacher_id: '' });
    setOpen(true);
  }

  function openEdit(c: SchoolClass) {
    setEditing(c);
    const teacherId = teachers.find((t) => t.name === c.teacher_name)?.id ?? '';
    reset({ name: c.name, year: c.year, shift: c.shift, level: c.level ?? '', teacher_id: teacherId });
    setOpen(true);
  }

  function closeModal() { reset(); setEditing(null); setOpen(false); }

  async function onSubmit(data: NewClass) {
    const payload = { ...data, year: Number(data.year), teacher_id: data.teacher_id || undefined };
    if (editing) {
      await classesService.update(editing.id, payload);
    } else {
      await classesService.create(payload);
    }
    await load();
    closeModal();
  }

  async function onRemove(id: string) {
    await classesService.remove(id);
    await load();
  }

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
                  <Users size={15} /> Alunos: <span className="font-medium text-ink">{c.student_count}</span>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>
                  {c.status === 'active' ? 'Ativa' : 'Inativa'}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? 'Editar turma' : 'Nova turma'}
        onClose={closeModal}
        footer={
          <>
            <button className="btn-outline" onClick={closeModal}>Cancelar</button>
            <button className="btn-primary" form="class-form" type="submit">{editing ? 'Salvar' : 'Criar turma'}</button>
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
        </form>
      </Modal>
    </>
  );
}
