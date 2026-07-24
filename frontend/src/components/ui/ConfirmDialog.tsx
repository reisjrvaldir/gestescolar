import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { useSubmitOnce } from '@/lib/useSubmitOnce';

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onClose,
}: Props) {
  const { run, submitting } = useSubmitOnce(async () => {
    await onConfirm();
    onClose();
  });

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={submitting}>{cancelLabel}</button>
          <button
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={() => void run()}
            disabled={submitting}
          >
            {submitting ? 'Processando…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary'}`}>
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
    </Modal>
  );
}
