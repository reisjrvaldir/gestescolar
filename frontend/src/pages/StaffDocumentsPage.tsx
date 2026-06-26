import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { FileText, Upload, Trash2, Download, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { staffDocumentsService, DOC_TYPE_LABELS, type StaffDocument, type DocType } from '@/services/staffDocuments';

const MAX = 2 * 1024 * 1024; // 2MB

function formatSize(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function StaffDocumentsPage() {
  const [docs, setDocs] = useState<StaffDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<{ data: string; name: string; size: number; mime: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ type: DocType; description: string }>();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setDocs(await staffDocumentsService.list()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX) {
      setError(`Arquivo excede o limite de 2MB (atual: ${formatSize(f.size)}).`);
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setFileData({
        data: String(reader.result).split(',')[1] ?? '', // strip data:...;base64,
        name: f.name,
        size: f.size,
        mime: f.type,
      });
    };
    reader.readAsDataURL(f);
  }

  async function onUpload(form: { type: DocType; description: string }) {
    if (!fileData) { setError('Selecione um arquivo'); return; }
    setUploading(true);
    setError(null);
    try {
      await staffDocumentsService.upload({
        type: form.type,
        filename: fileData.name,
        mime_type: fileData.mime,
        file_size: fileData.size,
        file_data: fileData.data,
        description: form.description || undefined,
      });
      setFileData(null);
      reset();
      setOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao enviar');
    } finally {
      setUploading(false);
    }
  }

  async function onDownload(id: string) {
    const full = await staffDocumentsService.get(id);
    const link = document.createElement('a');
    link.href = `data:${full.mime_type ?? 'application/octet-stream'};base64,${full.file_data}`;
    link.download = full.filename;
    link.click();
  }

  async function onRemove(id: string) {
    if (!window.confirm('Excluir este documento?')) return;
    await staffDocumentsService.remove(id);
    await load();
  }

  return (
    <>
      <PageHeader
        title="Meus Documentos"
        subtitle="Envie certificados, atestados médicos, certidões e outros documentos."
        actions={
          <button className="btn-primary" onClick={() => { setFileData(null); reset(); setOpen(true); }}>
            <Upload size={16} /> Enviar documento
          </button>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-ink-muted"><Loader2 className="animate-spin" size={16} /> Carregando…</div>
        ) : docs.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum documento" description="Envie seu primeiro documento." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase text-ink-subtle">
                <th className="px-4 py-3">Arquivo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Tamanho</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{d.filename}</p>
                    {d.description && <p className="text-xs text-ink-muted">{d.description}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge tone="primary">{DOC_TYPE_LABELS[d.type]}</StatusBadge></td>
                  <td className="px-4 py-3 text-ink-muted">{formatSize(d.file_size)}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(d.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-soft hover:text-primary" onClick={() => onDownload(d.id)} title="Baixar">
                        <Download size={15} />
                      </button>
                      <button className="rounded-lg p-1.5 text-ink-muted hover:bg-danger-soft hover:text-danger" onClick={() => onRemove(d.id)} title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} title="Enviar documento" onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" form="doc-form" type="submit" disabled={uploading || !fileData}>
              {uploading && <Loader2 size={14} className="animate-spin" />} Enviar
            </button>
          </>
        }>
        <form id="doc-form" className="space-y-4" onSubmit={handleSubmit(onUpload)}>
          <div>
            <label className="label">Arquivo * (máx. 2MB)</label>
            <button type="button" className="btn-outline w-full justify-center" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> {fileData ? fileData.name : 'Escolher arquivo'}
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
            {fileData && <p className="mt-1 text-xs text-ink-muted">{formatSize(fileData.size)} • {fileData.mime || 'desconhecido'}</p>}
          </div>
          <div>
            <label className="label">Tipo *</label>
            <select className="input" {...register('type', { required: true })}>
              <option value="certificado">Certificado</option>
              <option value="atestado">Atestado médico</option>
              <option value="certidao">Certidão</option>
              <option value="outro">Outro</option>
            </select>
            {errors.type && <p className="mt-1 text-xs text-danger">Selecione o tipo</p>}
          </div>
          <div>
            <label className="label">Descrição</label>
            <input className="input" placeholder="Opcional" {...register('description')} />
          </div>
        </form>
      </Modal>
    </>
  );
}
