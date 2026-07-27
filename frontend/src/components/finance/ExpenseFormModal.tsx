import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BRLInput } from '@/components/ui/BRLInput';
import { useSubmitOnce } from '@/lib/useSubmitOnce';
import { brl } from '@/lib/money';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type NewExpense,
  type EditExpense,
} from '@/services/expenses';
import { expenseCreateSchema, expenseEditSchema } from '@/lib/schemas';

interface Props {
  open: boolean;
  expense: Expense | null; // null = criação
  onClose: () => void;
  onCreate: (data: NewExpense) => Promise<void>;
  onEdit: (id: string, data: EditExpense) => Promise<void>;
}

interface FormState {
  supplier_name: string;
  description: string;
  category: string;
  amount: number;
  due_date: string;
  installments: number;
  installment_mode: 'total' | 'each';
}

const EMPTY: FormState = {
  supplier_name: '',
  description: '',
  category: '',
  amount: 0,
  due_date: '',
  installments: 1,
  installment_mode: 'total',
};

export function ExpenseFormModal({ open, expense, onClose, onCreate, onEdit }: Props) {
  const isEdit = !!expense;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const uid = useId();
  const supplierNameId = `${uid}-supplier`;
  const descriptionId = `${uid}-description`;
  const categoryId = `${uid}-category`;
  const amountId = `${uid}-amount`;
  const dueDateId = `${uid}-due-date`;
  const installmentsId = `${uid}-installments`;
  const installmentModeId = `${uid}-installment-mode`;
  const errorId = `${uid}-error`;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    if (expense) {
      setForm({
        supplier_name: expense.supplier_name ?? '',
        description: expense.description ?? '',
        category: expense.category ?? '',
        amount: Number(expense.amount) || 0,
        due_date: expense.due_date ?? '',
        installments: 1,
        installment_mode: 'total',
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, expense]);

  const perInstallment =
    form.installments > 1 && form.installment_mode === 'total'
      ? form.amount / form.installments
      : form.amount;
  const grandTotal =
    form.installments > 1 && form.installment_mode === 'each'
      ? form.amount * form.installments
      : form.amount;

  const { run: submit, submitting } = useSubmitOnce(async () => {
    setError(null);
    setFieldErrors({});

    const raw = {
      supplier_name: form.supplier_name.trim(),
      description: form.description.trim() || undefined,
      category: form.category || undefined,
      amount: form.amount,
      due_date: form.due_date || undefined,
      installments: form.installments > 1 ? form.installments : undefined,
      installment_mode: form.installments > 1 ? form.installment_mode : undefined,
    };

    const schema = isEdit ? expenseEditSchema : expenseCreateSchema;
    const result = schema.safeParse(raw);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      setError(Object.values(errs)[0] ?? 'Dados inválidos');
      return;
    }

    if (isEdit && expense) {
      await onEdit(expense.id, result.data as EditExpense);
    } else {
      await onCreate(result.data as NewExpense);
    }
    onClose();
  });

  const handleClose = () => { if (!submitting) onClose(); };

  return (
    <Modal
      open={open}
      title={isEdit ? 'Editar despesa' : 'Nova despesa'}
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={handleClose} disabled={submitting}>Cancelar</button>
          <button
            type="button"
            className="btn-primary"
            aria-busy={submitting}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={supplierNameId} className="label">Fornecedor *</label>
          <input
            id={supplierNameId}
            className="input"
            placeholder="Ex.: Papelaria Central"
            maxLength={200}
            value={form.supplier_name}
            onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))}
            aria-describedby={fieldErrors.supplier_name ? `${supplierNameId}-err` : undefined}
          />
          {fieldErrors.supplier_name && <p id={`${supplierNameId}-err`} role="alert" className="mt-1 text-xs text-danger">{fieldErrors.supplier_name}</p>}
        </div>
        <div>
          <label htmlFor={descriptionId} className="label">Descrição</label>
          <input
            id={descriptionId}
            className="input"
            placeholder="Ex.: Material didático"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor={categoryId} className="label">Categoria</label>
          <select
            id={categoryId}
            className="input"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="">Selecione a categoria…</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={amountId} className="label">Valor *</label>
            <BRLInput id={amountId} value={form.amount} onValueChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
            {fieldErrors.amount && <p role="alert" className="mt-1 text-xs text-danger">{fieldErrors.amount}</p>}
          </div>
          <div>
            <label htmlFor={dueDateId} className="label">1º vencimento</label>
            <input
              id={dueDateId}
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
        </div>

        {!isEdit && (
          <fieldset className="rounded-lg border border-border bg-canvas/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <legend className="label mb-0 float-left">Parcelamento (cartão de crédito)</legend>
              <span className="text-xs text-ink-subtle">Deixe em 1 para lançamento único</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={installmentsId} className="label text-xs">Nº de parcelas</label>
                <input
                  id={installmentsId}
                  type="number"
                  min={1}
                  max={60}
                  className="input"
                  value={form.installments}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, installments: Math.max(1, Math.min(60, Number(e.target.value) || 1)) }))
                  }
                />
              </div>
              <div>
                <label htmlFor={installmentModeId} className="label text-xs">O valor informado é…</label>
                <select
                  id={installmentModeId}
                  className="input"
                  value={form.installment_mode}
                  disabled={form.installments <= 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, installment_mode: e.target.value as 'total' | 'each' }))
                  }
                >
                  <option value="total">…o TOTAL da compra (dividido em N)</option>
                  <option value="each">…o valor de CADA parcela</option>
                </select>
              </div>
            </div>
            {form.installments > 1 && form.amount > 0 && (
              <p className="mt-3 text-sm text-ink-muted">
                <strong className="text-ink">{form.installments}x</strong> de{' '}
                <strong className="text-ink">{brl(perInstallment)}</strong>{' '}
                — total <strong className="text-ink">{brl(grandTotal)}</strong>.
                Uma despesa será criada por parcela, com vencimento mensal a partir da data acima.
              </p>
            )}
          </fieldset>
        )}

        {error && <p id={errorId} role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
