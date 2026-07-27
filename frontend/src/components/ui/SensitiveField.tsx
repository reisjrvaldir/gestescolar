import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { personalDataService } from '@/services/personalData';
import type { EntityType, SensitiveFieldName } from '@/services/personalData';

interface Props {
  /** Rótulo exibido à esquerda (igual ao Row padrão). */
  label: string;
  /** Valor já mascarado vindo da API (ex.: "***.***.***-09"). */
  maskedValue?: string | null;
  entityType: EntityType;
  entityId: string;
  field: SensitiveFieldName;
  /** true apenas para perfis que podem revelar (school_admin, financial, superadmin). */
  canReveal: boolean;
  /** Chamado com o valor real após revelação bem-sucedida (útil para propagar p/ botão copiar). */
  onReveal?: (value: string) => void;
}

/**
 * Substitui o componente Row para campos de dados pessoais sensíveis.
 * Mostra o valor mascarado por padrão; o botão "Revelar" exige justificativa
 * curta, chama o endpoint /personal-data/reveal e registra na trilha de
 * auditoria LGPD. Perfis sem permissão veem apenas o valor mascarado.
 */
export function SensitiveField({
  label, maskedValue, entityType, entityId, field, canReveal, onReveal,
}: Props) {
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const isRevealed = revealedValue !== null;
  const displayValue = isRevealed && visible ? revealedValue : (maskedValue || '—');
  const isMaskedDisplay = !isRevealed || !visible;

  function openModal() {
    setShowModal(true);
    setJustification('');
    setModalError(null);
  }

  function closeModal() {
    setShowModal(false);
    setJustification('');
    setModalError(null);
  }

  async function doReveal() {
    if (justification.trim().length < 10) {
      setModalError('Justificativa deve ter pelo menos 10 caracteres.');
      return;
    }
    setBusy(true);
    setModalError(null);
    try {
      const value = await personalDataService.reveal({
        entity_type: entityType,
        entity_id: entityId,
        field,
        justification: justification.trim(),
      });
      setRevealedValue(value);
      setVisible(true);
      onReveal?.(value);
      closeModal();
    } catch (e: any) {
      setModalError(e?.message ?? 'Erro ao revelar o dado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
        <span className="text-ink-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={
              isMaskedDisplay
                ? 'font-mono text-xs tracking-wider text-ink-muted'
                : 'font-medium text-ink'
            }
          >
            {displayValue}
          </span>

          {canReveal && !isRevealed && (
            <button
              onClick={openModal}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-soft"
              title="Revelar dado sensível"
            >
              <Eye size={11} /> Revelar
            </button>
          )}

          {canReveal && isRevealed && (
            <button
              onClick={() => setVisible((v) => !v)}
              className="rounded-lg p-0.5 text-ink-subtle transition-colors hover:text-ink"
              title={visible ? 'Ocultar' : 'Mostrar'}
            >
              {visible ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h4 className="mb-1 text-base font-bold text-ink">Revelar dado sensível</h4>
            <p className="mb-4 text-xs text-ink-muted">
              Informe o motivo de acesso para <strong>{label}</strong>.
              O acesso será registrado na trilha de auditoria LGPD.
            </p>
            <textarea
              className="input w-full resize-none text-sm"
              rows={3}
              placeholder="Ex.: Verificação de documento para matrícula, atualização cadastral…"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div className="mt-1 flex justify-between text-xs text-ink-subtle">
              <span>
                {justification.trim().length < 10
                  ? `Mín. 10 caracteres (faltam ${10 - justification.trim().length})`
                  : '✓ Justificativa válida'}
              </span>
              <span>{justification.length}/500</span>
            </div>
            {modalError && <p className="mt-2 text-xs text-danger">{modalError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-outline" onClick={closeModal} disabled={busy}>
                Cancelar
              </button>
              <button
                className="btn-primary flex items-center gap-1.5"
                onClick={doReveal}
                disabled={busy || justification.trim().length < 10}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
