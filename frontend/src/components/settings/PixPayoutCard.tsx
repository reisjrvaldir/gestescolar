import { useEffect, useState } from 'react';
import { Save, Check, Loader2, QrCode, Lock } from 'lucide-react';
import { payoutService, PIX_KEY_TYPE_LABELS, type PixKeyType } from '@/services/payout';

/** Card no perfil da escola: cadastro da chave PIX de recebimento (repasses).
 *  Regra de negócio: só disponível para escolas com plano ativo (pago). */
export function PixPayoutCard({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<PixKeyType>('CNPJ');
  const [key, setKey] = useState('');

  useEffect(() => {
    payoutService.get()
      .then((d) => {
        if (d.pix_key_type) setType(d.pix_key_type);
        if (d.pix_key) setKey(d.pix_key);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await payoutService.savePix(key.trim(), type);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-ink">
        <QrCode size={16} className="text-primary" /> Chave PIX para recebimento
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Onde a escola recebe os repasses das mensalidades.
      </p>
      {!active ? (
        <div className="flex items-start gap-2 rounded-lg bg-canvas p-3 text-xs text-ink-muted">
          <Lock size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
          <span>Disponível apenas com um <strong className="text-ink">plano ativo</strong>. Assine um plano para configurar seus recebimentos.</span>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-ink-muted">
          <Loader2 className="animate-spin" size={16} /> Carregando…
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Tipo de chave</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as PixKeyType)}>
              {(Object.keys(PIX_KEY_TYPE_LABELS) as PixKeyType[]).map((t) => (
                <option key={t} value={t}>{PIX_KEY_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Chave PIX</label>
            <input
              className="input"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="CNPJ, e-mail, telefone ou chave aleatória"
            />
          </div>
          <button type="button" className="btn-primary w-full" onClick={save} disabled={saving || !key.trim()}>
            {saved ? <Check size={16} /> : <Save size={16} />}{' '}
            {saved ? 'Salvo' : saving ? 'Salvando…' : 'Salvar chave PIX'}
          </button>
        </div>
      )}
    </div>
  );
}
