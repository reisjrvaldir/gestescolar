import type { LucideIcon } from 'lucide-react';

/**
 * Hero padrão do sistema (estilo "Gestão de ponto"): gradiente violeta,
 * título grande, subtítulo, ações e círculo de ícone à direita.
 */
export function PageHero({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0 max-w-xl flex-1">
          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-2">{actions}</div>}
          {children}
        </div>
        {Icon && (
          <div className="hidden shrink-0 sm:block">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/10 text-purple shadow-inner">
              <Icon size={64} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
