import { forwardRef, useEffect, useState } from 'react';
import { maskBRLFromDigits, parseBRL } from '@/lib/money';

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
}

/** Input com máscara BR: digita "1000000" → mostra "10.000,00". */
export const BRLInput = forwardRef<HTMLInputElement, Props>(function BRLInput(
  { value, onValueChange, className, ...rest },
  ref,
) {
  const [text, setText] = useState(() => maskBRLFromDigits(String(Math.round((value || 0) * 100))));

  useEffect(() => {
    const external = maskBRLFromDigits(String(Math.round((value || 0) * 100)));
    if (parseBRL(external) !== parseBRL(text)) setText(external);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted">R$</span>
      <input
        ref={ref}
        inputMode="numeric"
        className="input pl-9"
        value={text}
        onChange={(e) => {
          const masked = maskBRLFromDigits(e.target.value);
          setText(masked);
          onValueChange(parseBRL(masked));
        }}
        {...rest}
      />
    </div>
  );
});
