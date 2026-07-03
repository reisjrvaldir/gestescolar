import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

/** Página-marcador para as seções do Super Admin ainda não implementadas.
 *  Reutilizada por Escolas, Vencimentos, Planos, Usuários, Financeiro etc.
 *  até que cada uma ganhe sua tela definitiva (fases posteriores). */
export function SaasPlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle ?? 'Em construção.'} />
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Hammer size={26} />
        </div>
        <h2 className="text-lg font-bold text-ink">Módulo em construção</h2>
        <p className="max-w-md text-sm text-ink-muted">
          Esta seção do Super Admin está sendo preparada nas próximas fases. O layout, a rota e a
          proteção de acesso já estão prontos — a UI final e os dados reais serão adicionados em breve.
        </p>
      </div>
    </>
  );
}
