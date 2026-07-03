import { useNavigate } from 'react-router-dom';
import {
  Plus, Package, Send, TrendingUp, Activity, LifeBuoy, type LucideIcon,
} from 'lucide-react';

interface Action { key: string; title: string; desc: string; icon: LucideIcon; to?: string; onClick?: () => void }

interface Props { onToast?: (msg: string) => void }

export function QuickActions({ onToast }: Props) {
  const navigate = useNavigate();
  const actions: Action[] = [
    { key: 'nova-escola',     title: 'Nova escola',        desc: 'Cadastrar uma escola manualmente',   icon: Plus,       to: '/saas/escolas' },
    { key: 'criar-plano',     title: 'Criar plano',        desc: 'Adicionar novo plano SaaS',          icon: Package,    to: '/saas/config/planos' },
    { key: 'enviar-comunicado', title: 'Enviar comunicado', desc: 'Notificar todas as escolas',        icon: Send,       onClick: () => onToast?.('Envio de comunicado — disponível em breve.') },
    { key: 'relatorio',       title: 'Relatório financeiro', desc: 'Ver receitas, MRR, ARR e churn',   icon: TrendingUp, to: '/saas/receitas' },
    { key: 'logs',            title: 'Logs do sistema',    desc: 'Auditoria e eventos críticos',       icon: Activity,   to: '/saas/logs-acesso' },
    { key: 'suporte',         title: 'Suporte',            desc: 'Chamados e contato rápido',          icon: LifeBuoy,   to: '/saas/suporte' },
  ];

  return (
    <section aria-labelledby="acoes-rapidas-saas">
      <h3 id="acoes-rapidas-saas" className="mb-3 text-sm font-bold text-ink">Ações rápidas</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              onClick={() => (a.to ? navigate(a.to) : a.onClick?.())}
              className="card group flex flex-col items-start gap-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary group-hover:bg-primary group-hover:text-white">
                <Icon size={18} />
              </div>
              <p className="text-sm font-semibold text-ink">{a.title}</p>
              <p className="text-xs text-ink-muted">{a.desc}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
