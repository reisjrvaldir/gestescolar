export interface FinanceTab {
  key: string;
  label: string;
}

interface Props {
  tabs: FinanceTab[];
  active: string;
  onChange: (key: string) => void;
}

/** Menu horizontal interno do módulo Financeiro. */
export function FinanceTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="Seções do financeiro">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
