import { useEffect, useState } from 'react';
import { Loader2, Check, AlertTriangle, Blocks, Info } from 'lucide-react';
import { settingsService } from '@/services/settings';
import { MODULE_CATALOG, isModuleEnabled, type EnabledModules, type ModuleKey } from '@shared/moduleCatalog';

/**
 * Painel "Módulos ativos" — desativa funcionalidades que a escola não usa.
 * Mudança some do menu lateral no próximo carregamento do /me (recarregar a página).
 */
export function ModulesManager() {
  const [modules, setModules] = useState<EnabledModules>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    settingsService.getModules()
      .then(setModules)
      .catch((e: any) => setError(e?.message ?? 'Não foi possível carregar os módulos.'))
      .finally(() => setLoading(false));
  }, []);

  function toggle(key: ModuleKey) {
    setModules((prev) => {
      const currentlyEnabled = isModuleEnabled(prev, key);
      const next = { ...prev };
      if (currentlyEnabled) next[key] = false; else delete next[key];
      return next;
    });
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await settingsService.updateModules(modules);
      setModules(updated);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-10 text-ink-muted">
        <Loader2 className="animate-spin" size={20} /> <span className="ml-2 text-sm">Carregando módulos…</span>
      </div>
    );
  }

  const disabledCount = MODULE_CATALOG.filter((m) => !isModuleEnabled(modules, m.key)).length;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Blocks size={18} className="text-primary" />
            <h3 className="text-base font-bold text-ink">Módulos ativos</h3>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Desativar um módulo esconde os itens correspondentes do menu de todos os usuários da escola.
            {disabledCount > 0 && (
              <span className="ml-1 font-semibold text-warning">{disabledCount} desativado(s).</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Salvando…' : 'Salvar módulos'}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      {savedAt && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs text-success">
          <Check size={14} /> Módulos atualizados. <span className="text-ink-muted">Peça aos usuários que recarreguem a página para o menu refletir.</span>
        </div>
      )}

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-soft/30 px-3 py-2 text-xs text-primary">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Módulos essenciais (Alunos, Turmas, Financeiro, Configurações, Faturas do responsável) ficam sempre visíveis e não podem ser desativados.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODULE_CATALOG.map((mod) => {
          const active = isModuleEnabled(modules, mod.key);
          return (
            <label
              key={mod.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                active ? 'border-primary/30 bg-primary-soft/20' : 'border-border bg-canvas'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                checked={active}
                onChange={() => toggle(mod.key)}
                aria-label={`Ativar ${mod.label}`}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${active ? 'text-ink' : 'text-ink-muted line-through'}`}>
                  {mod.label}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">{mod.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
