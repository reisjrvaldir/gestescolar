import { useEffect, useState } from 'react';
import { Shield, Download, Trash2, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHero } from '@/components/ui/PageHero';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  listRequests, requestExport, requestDeletion, listConsents,
  type LgpdRequest, type ConsentEntry,
} from '@/services/lgpd';
import { fmtTimestamp } from '@/lib/dates';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/consentVersions';

const PURPOSE_LABEL: Record<string, string> = {
  signup: 'Cadastro inicial',
  reconsent: 'Atualização de termos',
};

export function LgpdPage() {
  const [requests, setRequests] = useState<LgpdRequest[]>([]);
  const [consents, setConsents] = useState<ConsentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [reqs, cons] = await Promise.all([listRequests(), listConsents()]);
      setRequests(reqs);
      setConsents(cons);
    } catch (e) { console.error(e); }
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

  const latestConsent = consents[0] ?? null;
  const termsUpToDate = !latestConsent || (
    latestConsent.terms_version === CURRENT_TERMS_VERSION &&
    latestConsent.privacy_version === CURRENT_PRIVACY_VERSION
  );

  return (
    <>
      <PageHero
        title="Meus Dados (LGPD)"
        subtitle="Gerencie seus dados pessoais conforme a Lei Geral de Proteção de Dados."
        icon={Shield}
      />

      {latestConsent && !termsUpToDate && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink">
          <strong>Termos atualizados.</strong> Uma nova versão dos documentos está disponível. Por favor, leia os{' '}
          <Link to="/termos" target="_blank" className="font-medium text-primary underline">Termos de Uso</Link>{' '}
          e a{' '}
          <Link to="/privacidade" target="_blank" className="font-medium text-primary underline">Política de Privacidade</Link>{' '}
          atualizados.
        </div>
      )}

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

      {/* Consentimentos registrados */}
      <div className="card mb-6 overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success" />
            <h3 className="text-sm font-semibold text-ink">Consentimentos registrados</h3>
          </div>
        </div>
        {consents.length === 0 ? (
          <div className="px-4 py-5 text-sm text-ink-muted">
            Nenhum registro de aceite encontrado.{' '}
            <span className="text-ink-subtle">
              Usuários criados antes de 01/01/2026 não possuem registro retroativo.
            </span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Data/hora</th>
                <th className="px-4 py-3">Termos de Uso</th>
                <th className="px-4 py-3">Política de Privacidade</th>
                <th className="px-4 py-3">Finalidade</th>
              </tr>
            </thead>
            <tbody>
              {consents.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-ink">{fmtTimestamp(c.accepted_at)}</td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1">
                      <FileText size={13} className="text-ink-subtle" />
                      <Link to="/termos" target="_blank" className="text-primary hover:underline">
                        v{c.terms_version}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1">
                      <FileText size={13} className="text-ink-subtle" />
                      <Link to="/privacidade" target="_blank" className="text-primary hover:underline">
                        v{c.privacy_version}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {PURPOSE_LABEL[c.purpose] ?? c.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Histórico de solicitações LGPD */}
      <div className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Histórico de solicitações LGPD</h3>
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
                  <td className="px-4 py-3 text-ink-muted">{fmtTimestamp(r.created_at)}</td>
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
