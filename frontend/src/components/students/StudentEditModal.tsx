import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Upload, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { studentsService, type UpdateStudent } from '@/services/students';
import { resizeImageToDataUrl } from '@/lib/image';
import type { SchoolClass, Student } from '@/types/models';
import type { SchoolPlan } from '@/services/schoolPlans';
import { brl } from '@/lib/fees';
import { studentEditFormSchema, type StudentEditFormValues } from '@/lib/schemas';
import { applyServerErrors } from '@/hooks/useFormErrors';

type EditFields = StudentEditFormValues;

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

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
  const [loadingFull, setLoadingFull] = useState(true);
  const [photo, setPhoto] = useState<string | null>(student.photo_url ?? null);
  const [photoTouched, setPhotoTouched] = useState(false);
  const uid = useId();
  const fId = (f: string) => `${uid}-${f}`;

  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors } } = useForm<EditFields>({
    resolver: zodResolver(studentEditFormSchema),
    // Preenche já com o que temos (mascarado se necessário) — o useEffect abaixo
    // substitui pelos valores reais assim que o /full retornar.
    defaultValues: {
      name: student.name ?? '',
      cpf: (student.cpf ?? '').includes('*') ? '' : (student.cpf ?? ''),
      rg:  (student.rg  ?? '').includes('*') ? '' : (student.rg  ?? ''),
      birth_date: student.birth_date ? student.birth_date.slice(0, 10) : '',
      blood_type: (student.blood_type ?? '') as '' | typeof BLOOD_TYPES[number],
      naturality: student.naturality ?? '',
      father_name: student.father_name ?? '',
      mother_name: student.mother_name ?? '',
      class_id: student.class_id ?? '',
      plan_id: student.plan_id ?? '',
    },
  });

  // Busca dados completos (sem máscara) para pré-popular o formulário — sem
  // isso, CPF/RG etc. abririam vazios só porque a listagem devolve mascarado.
  useEffect(() => {
    let active = true;
    setLoadingFull(true);
    studentsService.getFull(student.id)
      .then((full) => {
        if (!active) return;
        reset({
          name: full.name ?? '',
          cpf: full.cpf ?? '',
          rg: full.rg ?? '',
          birth_date: full.birth_date ? full.birth_date.slice(0, 10) : '',
          blood_type: (full.blood_type ?? '') as '' | typeof BLOOD_TYPES[number],
          naturality: full.naturality ?? '',
          father_name: full.father_name ?? '',
          mother_name: full.mother_name ?? '',
          class_id: full.class_id ?? '',
          plan_id: full.plan_id ?? '',
        });
      })
      .catch((e: any) => {
        if (active) setError(e?.message ?? 'Não foi possível carregar os dados do aluno.');
      })
      .finally(() => { if (active) setLoadingFull(false); });
    return () => { active = false; };
  }, [student.id, reset]);

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
      if (!applyServerErrors(e, setFieldError)) {
        setError(e?.message ?? 'Falha ao salvar as alterações.');
      }
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
        {error && <div role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
        {loadingFull && (
          <div className="flex items-center gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary">
            <Loader2 size={14} className="animate-spin" /> Carregando dados do aluno…
          </div>
        )}

        {/* Foto */}
        <div className="flex items-center gap-4">
          {photo ? (
            <div className="relative">
              <img src={photo} alt="" className="h-20 w-20 rounded-full border-2 border-border object-cover" />
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoTouched(true); }}
                className="absolute -right-1 -top-1 rounded-full bg-danger p-1 text-white"
                aria-label="Remover foto"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
              {initials(student.name)}
            </div>
          )}
          <div>
            <label className="btn-outline inline-flex cursor-pointer items-center gap-1.5 text-sm">
              <Upload size={14} aria-hidden="true" /> {photo ? 'Trocar foto' : 'Enviar foto'}
              <input type="file" accept="image/*" className="hidden" aria-label="Selecionar foto do aluno" onChange={onPhoto} />
            </label>
            <p className="mt-1.5 text-xs text-ink-muted">Redimensionada automaticamente (256px).</p>
          </div>
        </div>

        {/* Dados */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor={fId('name')} className="label">Nome completo *</label>
            <input id={fId('name')} className="input" autoComplete="name" maxLength={120} {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor={fId('cpf')} className="label">CPF</label>
            <input id={fId('cpf')} className="input" placeholder="000.000.000-00" inputMode="numeric" maxLength={14} autoComplete="off" {...register('cpf')} />
          </div>
          <div>
            <label htmlFor={fId('rg')} className="label">RG</label>
            <input id={fId('rg')} className="input" autoComplete="off" {...register('rg')} />
          </div>
          <div>
            <label htmlFor={fId('birth_date')} className="label">Data de nascimento</label>
            <input id={fId('birth_date')} type="date" className="input" autoComplete="bday" {...register('birth_date')} />
          </div>
          <div>
            <label htmlFor={fId('blood_type')} className="label">Tipo sanguíneo</label>
            <select id={fId('blood_type')} className="input" {...register('blood_type')}>
              <option value="">—</option>
              {BLOOD_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={fId('naturality')} className="label">Naturalidade</label>
            <input id={fId('naturality')} className="input" placeholder="Ex.: Salvador - BA" autoComplete="off" {...register('naturality')} />
          </div>
          <div>
            <label htmlFor={fId('father_name')} className="label">Nome do pai</label>
            <input id={fId('father_name')} className="input" autoComplete="off" {...register('father_name')} />
          </div>
          <div>
            <label htmlFor={fId('mother_name')} className="label">Nome da mãe</label>
            <input id={fId('mother_name')} className="input" autoComplete="off" {...register('mother_name')} />
          </div>
          <div>
            <label htmlFor={fId('class_id')} className="label">Turma</label>
            <select id={fId('class_id')} className="input" {...register('class_id')}>
              <option value="">— Sem turma —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={fId('plan_id')} className="label">Plano (mensalidade)</label>
            <select id={fId('plan_id')} className="input" {...register('plan_id')}>
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
