import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { classesService } from '@/services/classes';
import { chargesService, type NewAdhocCharge } from '@/services/charges';
import type { SchoolClass } from '@/types/models';
import { adhocChargeSchema } from '@/lib/schemas';
import { applyServerErrors } from '@/hooks/useFormErrors';
import type { z } from 'zod';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { studentsCount: number; invoicesCreated: number }) => void;
  onError: (message: string) => void;
}

type FormFields = z.input<typeof adhocChargeSchema>;

/** Cria uma cobrança avulsa (festa, material, evento...) para todos os alunos
 *  ou para uma turma específica — gera uma fatura PIX por aluno vinculado. */
export function AdhocChargeModal({ open, onClose, onCreated, onError }: Props) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch, setError, formState: { errors } } = useForm<FormFields>({
    resolver: zodResolver(adhocChargeSchema),
    defaultValues: { scope: 'all' },
  });
  const scope = watch('scope');
  const uid = useId();
  const fId = (f: string) => `${uid}-${f}`;

  useEffect(() => {
    if (open) classesService.list().then(setClasses).catch(() => setClasses([]));
  }, [open]);

  async function onSubmit(data: FormFields) {
    setSaving(true);
    try {
      const payload: NewAdhocCharge = {
        title: data.title,
        description: data.description || undefined,
        amount: Number(data.amount),
        due_date: data.due_date,
        scope: data.scope,
        class_id: data.scope === 'class' ? data.class_id : undefined,
      };
      const result = await chargesService.create(payload);
      onCreated({ studentsCount: result.students_count, invoicesCreated: result.invoices_created });
      reset({ scope: 'all' });
      onClose();
    } catch (e: any) {
      if (!applyServerErrors(e, setError)) {
        onError(e?.message ?? 'Erro ao criar cobrança avulsa.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Nova cobrança avulsa"
      onClose={() => { reset({ scope: 'all' }); onClose(); }}
      footer={
        <>
          <button className="btn-outline" onClick={() => { reset({ scope: 'all' }); onClose(); }}>Cancelar</button>
          <button className="btn-primary" form="adhoc-charge-form" type="submit" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />} Criar cobrança
          </button>
        </>
      }
    >
      <form id="adhoc-charge-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <p className="text-xs text-ink-muted">
          Use para cobranças fora da mensalidade — festas, materiais, eventos. Uma cobrança PIX
          individual será gerada para cada aluno do escopo escolhido, visível no portal do responsável.
        </p>
        <div>
          <label htmlFor={fId('title')} className="label">Título *</label>
          <input id={fId('title')} className="input" placeholder="Ex.: Festa Junina 2026" maxLength={200} {...register('title')} />
          {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
        </div>
        <div>
          <label htmlFor={fId('description')} className="label">Descrição</label>
          <input id={fId('description')} className="input" placeholder="Detalhes da cobrança (opcional)" {...register('description')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={fId('amount')} className="label">Valor por aluno (R$) *</label>
            <input id={fId('amount')} type="number" step="0.01" min="0.01" className="input" placeholder="50.00" inputMode="decimal" {...register('amount', { valueAsNumber: true })} />
            {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
          </div>
          <div>
            <label htmlFor={fId('due_date')} className="label">Vencimento *</label>
            <input id={fId('due_date')} type="date" className="input" {...register('due_date')} />
            {errors.due_date && <p className="mt-1 text-xs text-danger">{errors.due_date.message}</p>}
          </div>
        </div>
        <div>
          <label htmlFor={fId('scope')} className="label">Vincular a *</label>
          <select id={fId('scope')} className="input" {...register('scope')}>
            <option value="all">Todos os alunos</option>
            <option value="class">Uma turma específica</option>
          </select>
        </div>
        {scope === 'class' && (
          <div>
            <label htmlFor={fId('class_id')} className="label">Turma *</label>
            <select id={fId('class_id')} className="input" {...register('class_id')}>
              <option value="">Selecione…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.class_id && <p className="mt-1 text-xs text-danger">{errors.class_id.message}</p>}
          </div>
        )}
      </form>
    </Modal>
  );
}
