import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

// Seleção curada — cobre os usos mais comuns em mensagens escolares
// (recados, avisos, reações) sem depender de biblioteca externa.
const EMOJIS = [
  '😀', '😂', '🙂', '😉', '😍', '🤗', '🤔', '😮', '😢', '😴',
  '👍', '👎', '👏', '🙏', '💪', '✋', '👋', '🤝', '✅', '❌',
  '⭐', '🎉', '🎈', '📚', '✏️', '📅', '⏰', '📌', '💡', '❤️',
  '🔥', '👏', '🏆', '🎓', '📢', '⚠️', '❓', '❗', '💯', '🙌',
];

interface Props {
  onSelect: (emoji: string) => void;
  /** 'up' (padrão) para barras fixas no rodapé; 'down' dentro de modais/scroll. */
  direction?: 'up' | 'down';
}

export function EmojiPicker({ onSelect, direction = 'up' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-muted hover:bg-canvas hover:text-ink"
        title="Inserir emoji"
        onClick={() => setOpen(o => !o)}
      >
        <Smile size={18} />
      </button>
      {open && (
        <div
          className={`absolute right-0 z-20 grid w-64 grid-cols-8 gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl
            ${direction === 'up' ? 'bottom-11' : 'top-11'}`}
        >
          {EMOJIS.map((e, i) => (
            <button
              key={`${e}-${i}`}
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-canvas"
              onClick={() => { onSelect(e); setOpen(false); }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
