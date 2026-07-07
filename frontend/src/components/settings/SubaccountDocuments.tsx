import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle, FileCheck2, FileClock, FileX2, FileUp } from 'lucide-react';
import { payoutService } from '@/services/payout';

interface DocGroup {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  status?: string; // NOT_SENT | PENDING | APPROVED | REJECTED
}

/** Lista e envio dos documentos exigidos para validação da subconta ASAAS. */
export function SubaccountDocuments() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DocGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const d = await payoutService.listDocuments();
      setGroups(Array.isArray(d?.data) ? d.data : []);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function onFile(group: DocGroup, file: File) {
    setUploading(group.id); setError(null);
    try {
      const b64 = await toBase64(file);
      await payoutService.uploadDocument(group.id, group.type ?? 'IDENTIFICATION', file.name, file.type || 'application/octet-stream', b64);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao enviar documento');
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-subtle">Documentos para validação</p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted"><Loader2 className="animate-spin" size={14} /> Carregando…</div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-xs text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-xs text-ink-muted">Nenhum documento pendente no momento.</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <DocRow key={g.id} group={g} uploading={uploading === g.id} onFile={onFile} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({ group, uploading, onFile }: { group: DocGroup; uploading: boolean; onFile: (g: DocGroup, f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const st = (group.status ?? 'NOT_SENT').toUpperCase();
  const icon = st === 'APPROVED' ? <FileCheck2 size={15} className="text-success" />
    : st === 'REJECTED' ? <FileX2 size={15} className="text-danger" />
    : st === 'PENDING' ? <FileClock size={15} className="text-warning" />
    : <FileUp size={15} className="text-ink-subtle" />;
  const stLabel = st === 'APPROVED' ? 'Aprovado' : st === 'REJECTED' ? 'Rejeitado' : st === 'PENDING' ? 'Em análise' : 'Pendente';

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-2 text-xs">
        {icon}
        <div>
          <p className="font-semibold text-ink">{group.title ?? group.type ?? 'Documento'}</p>
          <p className="text-ink-muted">{stLabel}</p>
        </div>
      </div>
      {st !== 'APPROVED' && (
        <>
          <button type="button" className="btn-outline text-xs" onClick={() => ref.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" size={14} /> : <FileUp size={14} />} {uploading ? 'Enviando…' : 'Enviar'}
          </button>
          <input
            ref={ref}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(group, f); e.target.value = ''; }}
          />
        </>
      )}
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
