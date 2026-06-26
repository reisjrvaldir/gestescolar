import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';

export function FinalCTA() {
  return (
    <section id="contato" className="mx-auto max-w-6xl px-4 py-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-purple px-6 py-14 text-center shadow-card-hover">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-56 w-56 rounded-full bg-purple/30 blur-2xl" />
        <div className="relative">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white">
            <Rocket size={28} />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Leve sua escola para o próximo nível</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">
            Mais organização, eficiência e resultados com o GestEscolar.
          </p>
          <Link
            to="/login"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-bold text-primary shadow-card transition hover:bg-white/90"
          >
            Solicitar demonstração
          </Link>
        </div>
      </div>
    </section>
  );
}
