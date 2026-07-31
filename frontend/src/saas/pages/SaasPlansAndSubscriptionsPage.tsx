import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaasPlansConfigPage } from './SaasPlansConfigPage';
import { SaasSubscriptionsContent } from './SaasSubscriptionsContent';

type Tab = 'plans' | 'subscriptions';

/**
 * Super Admin: Planos e assinaturas com abas.
 * - Aba 1: Planos (CRUD de planos SaaS)
 * - Aba 2: Assinaturas (escolas que contrataram, view only)
 */
export function SaasPlansAndSubscriptionsPage() {
  const [tab, setTab] = useState<Tab>('plans');

  const tabClass = (t: Tab) =>
    `px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
      tab === t
        ? 'border-primary text-primary'
        : 'border-transparent text-ink-muted hover:text-ink'
    }`;

  return (
    <>
      <PageHeader
        title="Planos e assinaturas"
        subtitle="Configure os planos SaaS e acompanhe as assinaturas das escolas."
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-border">
        <button className={tabClass('plans')} onClick={() => setTab('plans')}>
          Planos
        </button>
        <button className={tabClass('subscriptions')} onClick={() => setTab('subscriptions')}>
          Assinaturas
        </button>
      </div>

      {/* Conteúdo */}
      {tab === 'plans' && <SaasPlansConfigPage />}
      {tab === 'subscriptions' && <SaasSubscriptionsContent />}
    </>
  );
}
