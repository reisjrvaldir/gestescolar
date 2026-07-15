import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, FileText, Clock, Check, X, Paperclip } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { attendanceService, type MyChild, type MyAttestation } from '@/services/attendance';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const STATUS_INFO: Record<MyAttestation['status'], { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: 'Aguardando análise', cls: 'bg-warning-soft text-warning', icon: Clock },
  approved: { label: 'Aprovado',           cls: 'bg-success-soft text-success', icon: Check },
  rejected: { label: 'Recusado',           cls: 'bg-danger-soft text-danger',   icon: X },
};

export function GuardianAttestations() {
  const [children, setChildren] = useState<MyChild[]>([]);
  const [items, setItems] = useState<MyAttestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [c, a] = await Promise.all([attendanceService.myChildren(), attendanceService.myAttestations()]);
      setChildren(c);
      setItems(a);
      if (c.length > 0 && !studentId) setStudentId(c[0].student_id);
    } catch { /* silencioso */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    setError(null);
    setFile(null);
    if (children.length > 0) setStudentId(children[0].student_id);
    setDate(new Date().toISOString().slice(0, 10));
    setOpen(true);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Envie apenas arquivos PDF.'); return; }
    if (f.size > 5 * 1024 * 1024) { setError('O PDF deve ter no máximo 5 MB.'); return; }
    setError(null);
    setFile(f);
  }

  async function submit() {
    if (!studentId || !file) { setError('Selecione o aluno e o PDF do atestado.'); return; }
    setSending(true);
    setError(null);
    try {
      const b64 = await toBase64(file);
      await attendanceService.uploadMyAttestation({
        student_id: studentId,
        date,
        filename: file.name,
        file_size: file.size,
        file_data: b64,
      });
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao enviar o atestado. Tente novamente.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /><span className="ml-2">Carregando…</span></div>;
  }

  return (
    <>
      <PageHeader
        title="Presenças e Atestados"
        subtitle="Acompanhe a frequência e envie atestados médicos do(s) seu(s) filho(s)."
        actions={
          children.length > 0 ? (
            <button className="btn-primary" onClick={openModal}><Upload size={16} /> Enviar atestado</button>
          ) : undefined
        }
      />

      {children.length === 0 ? (
        <div className="card"><EmptyState icon={FileText} title="Nenhum aluno vinculado" description="Não encontramos alunos vinculados a este responsável." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm font-bold text-ink">Atestados enviados</div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-ink-muted">Nenhum atestado enviado ainda.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it) => {
                const info = STATUS_INFO[it.status];
                const Icon = info.icon;
                return (
                  <div key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{it.student_name}</p>
                      <p className="text-xs text-ink-muted">
                        {new Date(it.date + 'T12:00:00').toLocaleDateString('pt-BR')} · {it.filename}
                      </p>
                      {it.status === 'rejected' && it.review_note && (
                        <p className="mt-0.5 text-[11px] text-danger">Motivo: {it.review_note}</p>
                      )}
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${info.cls}`}>
                      <Icon size={12} /> {info.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal
        open={open}
        title="Enviar atestado médico"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn-primary" onClick={submit} disabled={sending || !file}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Enviar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <div className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
          <div>
            <label className="label">Aluno</label>
            <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {children.map((c) => <option key={c.student_id} value={c.student_id}>{c.student_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data da falta</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Arquivo PDF (máx. 5 MB)</label>
            <button type="button" className="btn-outline w-full justify-center" onClick={() => fileRef.current?.click()}>
              <Paperclip size={14} /> {file ? file.name : 'Selecionar PDF'}
            </button>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            {file && <p className="mt-1 text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</p>}
          </div>
          <p className="text-xs text-ink-subtle">
            O atestado ficará "Aguardando análise" até a gestão da escola aprovar ou recusar.
          </p>
        </div>
      </Modal>
    </>
  );
}
