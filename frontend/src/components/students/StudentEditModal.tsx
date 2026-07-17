import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { studentsService, type UpdateStudent } from '@/services/students';
import { resizeImageToDataUrl } from '@/lib/image';
import type { SchoolClass, Student } from '@/types/models';
import type { SchoolPlan } from '@/services/schoolPlans';
import { brl } from '@/lib/fees';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

interface EditFields {
  name: string;
  cpf: string;
  rg: string;
  birth_date: string;
  blood_type: string;
  naturality: string;
  father_name: string;
  mother_name: string;
  class_id: string;
  plan_id: string;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

export function StudentEditModal({
  student, classes, plans, onClose, onSaved,
}: {
  student: Student;
  classes: SchoolClass[];
  plans: SchoolPlan[];
  onClose: () => void;
  onSaved: (updated: Student) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(student.photo_url ?? null);
  const [photoTouched, setPhotoTouched] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<EditFields>({
    defaultValues: {
      name: student.name ?? '',
      cpf: (student.cpf ?? '').includes('*') ? '' : (student.cpf ?? ''),
      rg: student.rg ?? '',
      birth_date: student.birth_date ? student.birth_date.slice(0, 10) : '',
      blood_type: student.blood_type ?? '',
      naturality: student.naturality ?? '',
      father_name: student.father_name ?? '',
      mother_name: student.mother_name ?? '',
      class_id: student.class_id ?? '',
      plan_id: student.plan_id ?? '',
    },
  });

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Imagem muito grande (máx. 10MB).'); return; }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256, 0.8);
      setPhoto(dataUrl);
      setPhotoTouched(true);
    } catch {
      setError('Não foi possível processar a imagem.');
    }
  }

  async function onSubmit(data: EditFields) {
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateStudent = {
        name: data.name,
        cpf: data.cpf || undefined,
        rg: data.rg || undefined,
        birth_date: data.birth_date || undefined,
        blood_type: data.blood_type || undefined,
        naturality: data.naturality || undefined,
        father_name: data.father_name || undefined,
        mother_name: data.mother_name || undefined,
        class_id: data.class_id || undefined,
        plan_id: data.plan_id || undefined,
      };
      // Só envia a foto se foi trocada (evita reenviar o base64 existente).
      if (photoTouched && photo) payload.photo_url = photo;
      const updated = await studentsService.update(student.id, payload);
      onSaved({ ...student, ...updated, photo_url: photoTouched && photo ? photo : student.photo_url });
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={`Editar — ${student.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary flex items-center gap-2" form="student-edit-form" type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="student-edit-form" className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {error && <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

        {/* Foto */}
        <div className="flex items-center gap-4">
          {photo ? (
            <div className="relative">
              <img src={photo} alt="" className="h-20 w-20 rounded-full border-2 border-border object-cover" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoTouched(true); }}
                className="absolute -right-1 -top-1 rounded-full bg-danger p-1 text-white"
                title="Remover foto"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
              {initials(student.name)}
            </div>
          )}
          <div>
            <label className="btn-outline inline-flex cursor-pointer items-center gap-1.5 text-sm">
              <Upload size={14} /> {photo ? 'Trocar foto' : 'Enviar foto'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            </label>
            <p className="mt-1.5 text-xs text-ink-muted">Redimensionada automaticamente (256px).</p>
          </div>
        </div>

        {/* Dados */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome completo *</label>
            <input className="input" {...register('name', { required: 'Informe o nome' })} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">CPF</label>
            <input className="input" placeholder="000.000.000-00" {...register('cpf')} />
          </div>
          <div>
            <label className="label">RG</label>
            <input className="input" {...register('rg')} />
          </div>
          <div>
            <label className="label">Data de nascimento</label>
            <input type="date" className="input" {...register('birth_date')} />
          </div>
          <div>
            <label className="label">Tipo sanguíneo</label>
            <select className="input" {...register('blood_type')}>
              <option value="">—</option>
              {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Naturalidade</label>
            <input className="input" placeholder="Ex.: Salvador - BA" {...register('naturality')} />
          </div>
          <div>
            <label className="label">Nome do pai</label>
            <input className="input" {...register('father_name')} />
          </div>
          <div>
            <label className="label">Nome da mãe</label>
            <input className="input" {...register('mother_name')} />
          </div>
          <div>
            <label className="label">Turma</label>
            <select className="input" {...register('class_id')}>
              <option value="">— Sem turma —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Plano (mensalidade)</label>
            <select className="input" {...register('plan_id')}>
              <option value="">— Manter atual —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(Number(p.monthly_fee))}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-subtle">Trocar o plano recalcula a mensalidade nas próximas cobranças geradas.</p>
      </form>
    </Modal>
  );
}
