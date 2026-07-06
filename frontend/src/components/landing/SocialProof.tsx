import { Building2 } from 'lucide-react';
import { SOCIAL_PROOF } from '@/data/landing';

export function SocialProof() {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-center text-sm font-medium text-ink-muted">
          Solução ideal para escolas particulares, cursos e redes de ensino
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {SOCIAL_PROOF.map((name) => (
            <div key={name} className="flex items-center gap-1.5 text-ink-subtle">
              <Building2 size={16} />
              <span className="text-sm font-semibold">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
