import { useEffect, useState } from 'react';
import { Shield, Download, Trash2, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { listRequests, requestExport, requestDeletion, type LgpdRequest } from '@/services/lgpd';

export function LgpdPage() {
  const [requests, setRequests] = useState<LgpdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setRequests(await listRequests()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function onExport() {
    setExporting(true);
    try {
      const result = await requestExport();
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
      await load();
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  }

  async function onDeletion() {
    if (!window.confirm('Tem certeza que deseja solicitar a exclusão dos seus dados? Esta ação não pode ser desfeita.')) return;
    try {
      await requestDeletion();
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Meus Dados (LGPD)"
        subtitle="Gerencie seus dados pessoais conforme a Lei Geral de Proteção de Dados."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Download size={20} className="text-primary" />
            <h3 className="font-semibold text-ink">Exportar meus dados</h3>
          </div>
          <p className="mb-4 text-sm text-ink-muted">
            Baixe uma cópia de todos os seus dados pessoais armazenados na plataforma.
          </p>
          <button className="btn-primary" onClick={onExport} disabled={exporting}>
            {exporting ? <><Loader2 size={16} className="animate-spin" /> Exportando…</> : <><Download size={16} /> Exportar dados</>}
          </button>
        </div>

        <div className="card p-6">
          <div className="mb-3 flex items-center gap-2">
            <Trash2 size={20} className="text-danger" />
            <h3 className="font-semibold text-ink">Solicitar exclusão</h3>
          </div>
          <p className="mb-4 text-sm text-ink-muted">
            Solicite a exclusão de todos os seus dados pessoais. Um administrador irá processar a solicitação.
          </p>
          <button className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90" onClick={onDeletion}>
            <span className="inline-flex items-center gap-1"><Trash2 size={16} /> Solicitar exclusão</span>
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Histórico de solicitações</h3>
        </div>
        {requests.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Nenhuma solicitação"
            description="Você ainda não fez nenhuma solicitação LGPD."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{r.type === 'export' ? 'Exportação' : 'Exclusão'}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={r.status === 'completed' ? 'success' : r.status === 'pending' ? 'warning' : 'primary'}>
                      {r.status === 'completed' ? 'Concluído' : r.status === 'pending' ? 'Pendente' : r.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
