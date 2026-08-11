import { useId, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, title, onClose, children, footer }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // `onClose` normalmente chega como arrow function inline (`onClose={() => setX(false)}`),
  // então tem uma identidade NOVA a cada render do componente pai — inclusive a cada
  // tecla digitada em qualquer campo de dentro do modal (o estado do input muda no pai,
  // o pai re-renderiza, a prop troca de referência). Um ref sempre atualizado deixa o
  // handler de Escape chamar a versão mais recente sem precisar entrar nas deps do efeito.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const all = Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // Só depende de `open`: antes, `onClose` entrava aqui e — por trocar de
    // identidade a cada render do pai — reexecutava o efeito a cada tecla digitada
    // em QUALQUER input do modal. O efeito refoca o primeiro elemento focável ao
    // rodar, então cada letra digitada chutava o foco pro início do formulário —
    // exatamente o bug relatado: "digita uma letra e dá tab, não deixa escrever frase".
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-lg rounded-2xl bg-surface shadow-card-hover"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-canvas">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
