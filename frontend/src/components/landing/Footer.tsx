import { GraduationCap, Instagram, Linkedin, Youtube, MessageCircle, Mail, MapPin } from 'lucide-react';

const COLS = [
  { title: 'Produto', links: ['Funcionalidades', 'Como funciona', 'Planos', 'Integrações', 'Segurança'] },
  { title: 'Empresa', links: ['Sobre nós', 'Blog', 'Carreiras', 'Política de Privacidade', 'Termos de Uso'] },
  { title: 'Suporte', links: ['Central de Ajuda', 'Tutorial', 'Status do Sistema', 'Contato'] },
];

export function Footer() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {/* marca */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary"><GraduationCap size={20} /></div>
              <span className="text-lg font-extrabold">GestEscolar</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed">
              Plataforma completa para gestão escolar, financeira e acadêmica. Mais tempo para educar, menos tempo com burocracia.
            </p>
            <div className="mt-5 flex gap-3">
              {[Instagram, Linkedin, Youtube].map((Icon, i) => (
                <a key={i} href="#" aria-label="rede social" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20">
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h3 className="text-sm font-bold text-white">{c.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {c.links.map((l) => <li key={l}><a href="#" className="transition hover:text-white">{l}</a></li>)}
              </ul>
            </div>
          ))}

          {/* fale conosco */}
          <div>
            <h3 className="text-sm font-bold text-white">Fale conosco</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center gap-2"><MessageCircle size={15} /> (11) 90000-0000</li>
              <li className="flex items-center gap-2"><Mail size={15} /> contato@gestescolar.com.br</li>
              <li className="flex items-center gap-2"><MapPin size={15} /> São Paulo, SP</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © 2026 GestEscolar. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
