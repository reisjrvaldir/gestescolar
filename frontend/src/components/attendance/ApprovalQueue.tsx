import { useEffect, useState } from 'react';
import { Loader2, FileText, Check, X, User, Download } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { attendanceService, type PendingApproval } from '@/services/attendance';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ApprovalQueue({ onToast }: { onToast: (type: 'success' | 'error', msg: string) => void }) {
  const [rows, setRows] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setRows(await attendanceService.pendingApprovals()); }
    catch { onToast('error', 'Erro ao carregar fila de aprovação.'); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function preview(row: PendingApproval) {
    setPreviewId(row.id);
    setPreviewPdf(null);
    try {
      const doc = await attendanceService.getAttestation(row.student_id, row.class_id, row.date);
      setPreviewPdf(doc.file_data);
    } catch {
      onToast('error', 'Erro ao carregar o PDF.');
    }
  }

  async function review(row: PendingApproval, action: 'approve' | 'reject') {
    setBusyId(row.id);
    try {
      await attendanceService.reviewAttestation(row.id, action);
      onToast('success', action === 'approve' ? 'Atestado aprovado — falta virou abono.' : 'Atestado recusado.');
      setPreviewId(null);
      setPreviewPdf(null);
      await load();
    } catch (err: any) {
      onToast('error', err?.message ?? 'Erro ao processar o atestado.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-10 text-ink-muted"><Loader2 size={20} className="animate-spin" /></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={FileText} title="Nenhum atestado pendente" description="Atestados enviados por professores ou responsáveis aparecerão aqui para análise." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{row.student_name}</p>
              <p className="text-xs text-ink-muted">
                {row.class_name ?? 'Sem turma'} · {new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                {row.uploaded_by_guardian && <span className="ml-1 text-primary">· enviado pelo responsável</span>}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-subtle">{row.filename} · {formatSize(row.file_size)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button className="btn-outline text-xs" onClick={() => preview(row)}>
                <FileText size={13} /> Ver PDF
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-semibold text-success hover:bg-success hover:text-white disabled:opacity-50"
                onClick={() => review(row, 'approve')}
                disabled={busyId === row.id}
              >
                {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-lg bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
                onClick={() => review(row, 'reject')}
                disabled={busyId === row.id}
              >
                {busyId === row.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Recusar
              </button>
            </div>
          </div>

          {previewId === row.id && (
            <div className="border-t border-border p-4">
              {!previewPdf ? (
                <div className="flex justify-center py-6 text-ink-muted"><Loader2 size={18} className="animate-spin" /></div>
              ) : (
                <div className="space-y-2">
                  <iframe src={`data:application/pdf;base64,${previewPdf}`} title="Atestado" className="h-[50vh] w-full rounded-xl border border-border" />
                  <a
                    href={`data:application/pdf;base64,${previewPdf}`}
                    download={row.filename}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Download size={13} /> Baixar PDF
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
