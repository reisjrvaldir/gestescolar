import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { classesService } from '@/services/classes';
import { chargesService, type NewAdhocCharge } from '@/services/charges';
import type { SchoolClass } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (result: { studentsCount: number; invoicesCreated: number }) => void;
  onError: (message: string) => void;
}

interface FormFields {
  title: string;
  description: string;
  amount: number;
  due_date: string;
  scope: 'all' | 'class';
  class_id: string;
}

/** Cria uma cobrança avulsa (festa, material, evento...) para todos os alunos
 *  ou para uma turma específica — gera uma fatura PIX por aluno vinculado. */
export function AdhocChargeModal({ open, onClose, onCreated, onError }: Props) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormFields>({
    defaultValues: { scope: 'all' },
  });
  const scope = watch('scope');

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
      onError(e?.message ?? 'Erro ao criar cobrança avulsa.');
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
          <label className="label">Título *</label>
          <input className="input" placeholder="Ex.: Festa Junina 2026" {...register('title', { required: 'Informe o título' })} />
          {errors.title && <p className="mt-1 text-xs text-danger">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label">Descrição</label>
          <input className="input" placeholder="Detalhes da cobrança (opcional)" {...register('description')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Valor por aluno (R$) *</label>
            <input type="number" step="0.01" min="0.01" className="input" placeholder="50.00" {...register('amount', { required: 'Informe o valor', min: { value: 0.01, message: 'Mínimo R$0,01' } })} />
            {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="label">Vencimento *</label>
            <input type="date" className="input" {...register('due_date', { required: 'Informe o vencimento' })} />
            {errors.due_date && <p className="mt-1 text-xs text-danger">{errors.due_date.message}</p>}
          </div>
        </div>
        <div>
          <label className="label">Vincular a *</label>
          <select className="input" {...register('scope')}>
            <option value="all">Todos os alunos</option>
            <option value="class">Uma turma específica</option>
          </select>
        </div>
        {scope === 'class' && (
          <div>
            <label className="label">Turma *</label>
            <select className="input" {...register('class_id', { required: scope === 'class' ? 'Selecione a turma' : false })}>
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
