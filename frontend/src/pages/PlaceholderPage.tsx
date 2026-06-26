import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="Módulo em construção — será implementado na próxima fase." />
      <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <Construction size={26} />
        </div>
        <p className="text-sm font-medium text-ink">Em breve</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Esta tela faz parte do roadmap de reconstrução do GestEscolar v2.
        </p>
      </div>
    </>
  );
}
