import { useEffect, useState } from 'react';
import { Loader2, FileText, Check, X, Download, History } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { attendanceService, type AttestationHistoryItem } from '@/services/attendance';

type Filter = 'reviewed' | 'approved' | 'rejected' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'reviewed', label: 'Aprovados + recusados' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Recusados' },
  { key: 'all',      label: 'Tudo (inclui pendentes)' },
];

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AttestationsHistory({ onToast }: { onToast: (type: 'success' | 'error', msg: string) => void }) {
  const [rows, setRows] = useState<AttestationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('reviewed');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pdfCache, setPdfCache] = useState<Record<string, string>>({});
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    attendanceService.attestationHistory(filter)
      .then(setRows)
      .catch(() => onToast('error', 'Erro ao carregar histórico de atestados.'))
      .finally(() => setLoading(false));
  }, [filter, onToast]);

  async function togglePdf(row: AttestationHistoryItem) {
    if (openId === row.id) { setOpenId(null); return; }
    setOpenId(row.id);
    if (pdfCache[row.id]) return;
    setPdfLoading(row.id);
    try {
      const doc = await attendanceService.getAttestation(row.student_id, row.class_id, row.date);
      setPdfCache((c) => ({ ...c, [row.id]: doc.file_data }));
    } catch {
      onToast('error', 'Erro ao carregar o PDF.');
      setOpenId(null);
    } finally {
      setPdfLoading(null);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <History size={16} className="text-primary" /> Histórico de atestados
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filter === f.key ? 'bg-primary text-white' : 'text-ink-muted hover:bg-canvas'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum atestado no período" description="Assim que houver decisões de aprovação/recusa, elas aparecerão aqui." />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const badgeCls =
              row.status === 'approved' ? 'bg-success-soft text-success' :
              row.status === 'rejected' ? 'bg-danger-soft text-danger' :
              'bg-warning-soft text-warning';
            const badgeLbl =
              row.status === 'approved' ? 'Aprovado' :
              row.status === 'rejected' ? 'Recusado' :
              'Em análise';
            const StatusIcon = row.status === 'approved' ? Check : row.status === 'rejected' ? X : FileText;
            return (
              <div key={row.id}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${badgeCls}`}>
                    <StatusIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{row.student_name}</p>
                    <p className="text-xs text-ink-muted">
                      {row.class_name ?? 'Sem turma'} · falta em {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-subtle">
                      Enviado {formatDate(row.uploaded_at)}
                      {row.reviewed_at && ` · decidido ${formatDate(row.reviewed_at)}`}
                      {row.reviewed_by_name && ` por ${row.reviewed_by_name}`}
                    </p>
                    {row.review_note && (
                      <p className="mt-0.5 text-[11px] italic text-ink-muted">Nota: {row.review_note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${badgeCls}`}>{badgeLbl}</span>
                    <button
                      onClick={() => togglePdf(row)}
                      disabled={pdfLoading === row.id}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-50"
                    >
                      {pdfLoading === row.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                      {openId === row.id && pdfCache[row.id] ? 'Fechar' : 'Ver PDF'}
                    </button>
                  </div>
                </div>
                {openId === row.id && pdfCache[row.id] && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <iframe
                      src={`data:application/pdf;base64,${pdfCache[row.id]}`}
                      title={`Atestado — ${row.student_name}`}
                      className="h-[55vh] w-full rounded-xl border border-border"
                    />
                    <a
                      href={`data:application/pdf;base64,${pdfCache[row.id]}`}
                      download={row.filename}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Download size={12} /> Baixar {row.filename}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
