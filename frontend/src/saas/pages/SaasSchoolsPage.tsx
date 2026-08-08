import { useEffect, useMemo, useState } from 'react';
import {
  Search, RefreshCw, Loader2, CalendarClock, PauseCircle, PlayCircle,
  Users, GraduationCap, MoreHorizontal, Check, Pencil, CreditCard, AlertCircle, MinusCircle,
  Plus, Copy, KeyRound,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { fmtDate } from '@/lib/dates';
import {
  saasService, type SaasSchool, type SchoolDerivedStatus, type NewSchoolResult,
} from '@/services/saas';

const STATUS: Record<SchoolDerivedStatus, { tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral'; label: string }> = {
  ativa:     { tone: 'success', label: 'Ativa' },
  trial:     { tone: 'primary', label: 'Trial' },
  em_atraso: { tone: 'danger',  label: 'Em atraso' },
  suspensa:  { tone: 'warning', label: 'Suspensa' },
  cancelada: { tone: 'neutral', label: 'Cancelada' },
};

const FILTERS: { key: 'todas' | SchoolDerivedStatus; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'ativa', label: 'Ativas' },
  { key: 'trial', label: 'Trial' },
  { key: 'em_atraso', label: 'Em atraso' },
  { key: 'suspensa', label: 'Suspensas' },
  { key: 'cancelada', label: 'Canceladas' },
];

type ActionKind = 'extend' | 'suspend' | 'reactivate';

// Prontidão de pagamento embutido (subconta ASAAS + documentos).
function paymentInfo(s: SaasSchool): { tone: 'success' | 'warning' | 'neutral'; label: string; icon: typeof CreditCard } {
  if (s.payment_ready) return { tone: 'success', label: 'Apto a receber', icon: CreditCard };
  if (s.has_subaccount) {
    const st = s.payout_status ?? '';
    const label = st === 'under_review' ? 'Docs em análise'
      : st === 'pending' || st === '' ? 'Enviar documentos'
      : st === 'rejected' ? 'Docs recusados'
      : `Subconta: ${st}`;
    return { tone: 'warning', label, icon: AlertCircle };
  }
  return { tone: 'neutral', label: 'Sem subconta', icon: MinusCircle };
}

export function SaasSchoolsPage() {
  const [schools, setSchools] = useState<SaasSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todas' | SchoolDerivedStatus>('todas');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; school: SaasSchool } | null>(null);
  const [editing, setEditing] = useState<SaasSchool | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<NewSchoolResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSchools(await saasService.schools());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar as escolas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((s) => {
      if (filter !== 'todas' && s.derived_status !== filter) return false;
      if (!q) return true;
      return [s.name, s.cnpj, s.email, s.plan].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [schools, query, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: schools.length };
    for (const s of schools) c[s.derived_status] = (c[s.derived_status] ?? 0) + 1;
    return c;
  }, [schools]);

  function onDone(updated: SaasSchool, msg: string) {
    setSchools((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    setAction(null);
    showToast(msg);
  }

  return (
    <>
      <PageHeader
        title="Todas as escolas"
        subtitle="Gerencie todas as escolas cadastradas na plataforma"
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={load} title="Atualizar">
              <RefreshCw size={15} /> Atualizar
            </button>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus size={15} /> Nova escola
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          <Check size={16} /> {toast}
        </div>
      )}

      {/* Busca + filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, CNPJ, e-mail…"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key ? 'bg-primary text-white' : 'bg-surface text-ink-muted hover:bg-canvas border border-border'
              }`}
            >
              {f.label} <span className="opacity-70">({counts[f.key] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted">
          <Loader2 className="animate-spin" size={22} /> <span className="ml-2">Carregando escolas…</span>
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-danger">{error}</p>
          <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
        </div>
      ) : (
        <div className="card overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-3">Escola</th>
                  <th className="hidden px-5 py-3 md:table-cell">Plano</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Pagamento</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Cadastro</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Vencimento</th>
                  <th className="px-5 py-3 text-center">Usuários</th>
                  <th className="hidden px-5 py-3 sm:table-cell text-center">Alunos</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const st = STATUS[s.derived_status];
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-canvas">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{s.name}</p>
                        <p className="text-xs text-ink-subtle">{s.email || s.cnpj || '—'}</p>
                      </td>
                      <td className="hidden px-5 py-3 text-ink-muted md:table-cell">{s.plan}</td>
                      <td className="px-5 py-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                      <td className="px-5 py-3">
                        {(() => { const pi = paymentInfo(s); const Icon = pi.icon; return (
                          <span className="inline-flex items-center gap-1.5" title={pi.label}>
                            <Icon size={14} className={pi.tone === 'success' ? 'text-success' : pi.tone === 'warning' ? 'text-warning' : 'text-ink-subtle'} />
                            <StatusBadge tone={pi.tone}>{pi.label}</StatusBadge>
                          </span>
                        ); })()}
                      </td>
                      <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">{fmtDate(s.created_at)}</td>
                      <td className="hidden px-5 py-3 text-ink-muted lg:table-cell">
                        {s.trial_ends_at ? fmtDate(s.trial_ends_at) : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-ink-muted"><Users size={13} /> {s.users_count}</span>
                      </td>
                      <td className="hidden px-5 py-3 text-center sm:table-cell">
                        <span className="inline-flex items-center gap-1 text-ink-muted"><GraduationCap size={13} /> {s.students_count}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => setMenuFor(menuFor === s.id ? null : s.id)}
                            className="rounded-lg border border-border p-1.5 text-ink-muted hover:bg-canvas"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {menuFor === s.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-card-hover">
                                <button
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas"
                                  onClick={() => { setMenuFor(null); setEditing(s); }}
                                >
                                  <Pencil size={15} className="text-primary" /> Editar dados
                                </button>
                                <button
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas"
                                  onClick={() => { setMenuFor(null); setAction({ kind: 'extend', school: s }); }}
                                >
                                  <CalendarClock size={15} className="text-primary" /> Prorrogar acesso
                                </button>
                                {s.derived_status === 'suspensa' ? (
                                  <button
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-ink hover:bg-canvas"
                                    onClick={() => { setMenuFor(null); setAction({ kind: 'reactivate', school: s }); }}
                                  >
                                    <PlayCircle size={15} className="text-success" /> Reativar escola
                                  </button>
                                ) : (
                                  <button
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-canvas"
                                    onClick={() => { setMenuFor(null); setAction({ kind: 'suspend', school: s }); }}
                                  >
                                    <PauseCircle size={15} /> Suspender escola
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-ink-subtle">Nenhuma escola encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {action && (
        <ActionModal
          kind={action.kind}
          school={action.school}
          onClose={() => setAction(null)}
          onDone={onDone}
        />
      )}

      {editing && (
        <EditSchoolModal
          school={editing}
          onClose={() => setEditing(null)}
          onDone={(updated) => { onDone(updated, `Dados de ${updated.name} atualizados.`); setEditing(null); }}
        />
      )}

      {creating && (
        <NewSchoolModal
          onClose={() => setCreating(false)}
          onDone={(r) => { setCreating(false); setCreated(r); load(); }}
        />
      )}

      {created && (
        <CredentialsModal result={created} onClose={() => setCreated(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Nova escola — cria a escola e a conta do gestor de uma vez.
// Substitui o auto-cadastro público, fechado em 07/08/2026.
// ---------------------------------------------------------------------------
function NewSchoolModal({
  onClose, onDone,
}: {
  onClose: () => void;
  onDone: (r: NewSchoolResult) => void;
}) {
  const [schoolName, setSchoolName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [trialDays, setTrialDays] = useState(7);
  const [isPilot, setIsPilot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail.trim());
  const canSubmit = schoolName.trim().length >= 2 && adminName.trim().length >= 2 && emailOk;

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      onDone(await saasService.createSchool({
        school_name: schoolName.trim(),
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        cnpj: cnpj.trim() || undefined,
        phone: phone.trim() || undefined,
        trial_days: trialDays,
        is_pilot: isPilot,
      }));
    } catch (e: any) {
      setErr(e?.message ?? 'Não foi possível criar a escola.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Nova escola"
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={busy || !canSubmit}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Criar escola
          </button>
        </>
      }
    >
      {err && (
        <div role="alert" className="mb-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{err}</div>
      )}

      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="ns-school">Nome da escola</label>
          <input id="ns-school" className="input" value={schoolName}
                 onChange={(e) => setSchoolName(e.target.value)} placeholder="Colégio Exemplo" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ns-cnpj">CNPJ <span className="font-normal text-ink-subtle">(opcional)</span></label>
            <input id="ns-cnpj" className="input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ns-phone">Telefone <span className="font-normal text-ink-subtle">(opcional)</span></label>
            <input id="ns-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <p className="mb-3 text-[13px] font-semibold text-ink">Gestor responsável</p>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="ns-admin">Nome do gestor</label>
              <input id="ns-admin" className="input" value={adminName}
                     onChange={(e) => setAdminName(e.target.value)} placeholder="Maria Silva" />
            </div>
            <div>
              <label className="label" htmlFor="ns-email">E-mail de acesso</label>
              <input id="ns-email" className="input" type="email" value={adminEmail}
                     onChange={(e) => setAdminEmail(e.target.value)} placeholder="maria@colegio.com.br" />
              <p className="mt-1 text-xs text-ink-subtle">
                Vira o login do gestor. A senha inicial é a padrão da plataforma, com troca obrigatória no 1º acesso.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <label className="label" htmlFor="ns-trial">Dias de teste</label>
          <input id="ns-trial" className="input" type="number" min={0} max={365} value={trialDays}
                 onChange={(e) => setTrialDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))} />
          <p className="mt-1 text-xs text-ink-subtle">
            {trialDays === 0 ? 'A escola nasce ativa, sem período de teste.' : `Acesso liberado por ${trialDays} dias antes de exigir assinatura.`}
          </p>
        </div>

        <div className="border-t border-border pt-3">
          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={isPilot} onChange={(e) => setIsPilot(e.target.checked)} />
            <span className="text-sm font-medium text-ink">É piloto/teste?</span>
          </label>
          <p className="mt-1 text-xs text-ink-subtle">
            Marque se esta escola é um piloto interno ou conta de teste (para analytics e relatórios).
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Credenciais geradas — mostradas UMA vez, logo após criar a escola.
// ---------------------------------------------------------------------------
function CredentialsModal({ result, onClose }: { result: NewSchoolResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const texto = `Escola: ${result.name}\nAcesse: https://gestescolar.com.br\nLogin: ${result.admin_email}\nSenha inicial: ${result.initial_password}\n\nA senha deve ser trocada no primeiro acesso.`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal
      open
      title={`${result.name} criada`}
      onClose={onClose}
      footer={<button className="btn-primary" onClick={onClose}>Fechar</button>}
    >
      <div className="mb-3 flex items-start gap-2 rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-cta-hover">
        <Check size={16} className="mt-0.5 shrink-0" />
        <span>Escola e acesso do gestor criados. Envie os dados abaixo para ele.</span>
      </div>

      <div className="rounded-xl border border-border bg-canvas p-3.5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <KeyRound size={15} className="text-primary" /> Dados de acesso
        </div>
        <dl className="mt-2.5 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Login</dt>
            <dd className="font-medium text-ink">{result.admin_email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Senha inicial</dt>
            <dd className="font-mono font-medium text-ink">{result.initial_password}</dd>
          </div>
          {result.trial_ends_at && (
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Teste até</dt>
              <dd className="font-medium text-ink">{fmtDate(result.trial_ends_at)}</dd>
            </div>
          )}
        </dl>
      </div>

      <button className="btn-outline mt-3 w-full" onClick={copiar}>
        {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar dados de acesso</>}
      </button>

      <p className="mt-3 text-xs text-ink-subtle">
        A senha é a padrão da plataforma e o sistema obriga a troca no primeiro acesso.
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal de edição de dados da escola (nome, e-mail, telefone, CNPJ)
// ---------------------------------------------------------------------------
function EditSchoolModal({
  school, onClose, onDone,
}: {
  school: SaasSchool;
  onClose: () => void;
  onDone: (s: SaasSchool) => void;
}) {
  const [name, setName] = useState(school.name ?? '');
  const [email, setEmail] = useState(school.email ?? '');
  const [phone, setPhone] = useState(school.phone ?? '');
  const [cnpj, setCnpj] = useState(school.cnpj ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const updated = await saasService.updateSchool(school.id, {
        name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, cnpj: cnpj.trim() || undefined,
      });
      onDone({ ...school, ...updated });
    } catch (e: any) {
      setErr(e?.message ?? 'Não foi possível salvar.');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Editar escola"
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={busy || name.trim().length < 2}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">Nome da escola *</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@escola.com.br"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Telefone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">CNPJ</span>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
          </label>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal de ação — prorrogar / suspender / reativar
// ---------------------------------------------------------------------------
function ActionModal({
  kind, school, onClose, onDone,
}: {
  kind: ActionKind;
  school: SaasSchool;
  onClose: () => void;
  onDone: (s: SaasSchool, msg: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'days' | 'date'>('days');
  const [days, setDays] = useState('30');
  const [until, setUntil] = useState('');
  const [trialDays, setTrialDays] = useState('7');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cfg = {
    extend:     { title: 'Prorrogar acesso',   cta: 'Prorrogar',  danger: false },
    suspend:    { title: 'Suspender escola',   cta: 'Suspender',  danger: true },
    reactivate: { title: 'Reativar escola',    cta: 'Reativar',   danger: false },
  }[kind];

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      if (kind === 'extend') {
        const body = mode === 'days' ? { days: Number(days), reason } : { until, reason };
        const s = await saasService.extendAccess(school.id, body);
        onDone(s, `Acesso de ${school.name} prorrogado.`);
      } else if (kind === 'suspend') {
        const s = await saasService.suspendSchool(school.id, reason);
        onDone(s, `${school.name} foi suspensa.`);
      } else {
        const s = await saasService.reactivateSchool(school.id, { reason, trial_days: Number(trialDays) });
        onDone(s, `${school.name} foi reativada.`);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Não foi possível concluir a ação.');
      setBusy(false);
    }
  }

  const needReason = kind !== 'reactivate';

  return (
    <Modal
      open
      title={cfg.title}
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className={cfg.danger ? 'btn-danger' : 'btn-primary'}
            onClick={submit}
            disabled={busy || (needReason && !reason.trim())}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} {cfg.cta}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        Escola: <span className="font-semibold text-ink">{school.name}</span>
      </p>

      {kind === 'suspend' && (
        <div className="mb-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          A escola perde o acesso ao sistema imediatamente. Gravações são bloqueadas até a reativação.
        </div>
      )}

      {kind === 'extend' && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('days')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === 'days' ? 'border-primary bg-primary-soft text-primary' : 'border-border text-ink-muted'}`}
            >Por dias</button>
            <button
              onClick={() => setMode('date')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${mode === 'date' ? 'border-primary bg-primary-soft text-primary' : 'border-border text-ink-muted'}`}
            >Até uma data</button>
          </div>
          {mode === 'days' ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Dias a adicionar</span>
              <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Nova data de vencimento</span>
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
            </label>
          )}
        </div>
      )}

      {kind === 'reactivate' && (
        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-ink">Dias de trial ao reativar</span>
          <input type="number" min={1} value={trialDays} onChange={(e) => setTrialDays(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary" />
          <span className="mt-1 block text-xs text-ink-subtle">Ignorado se a assinatura já estiver ativa (paga).</span>
        </label>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">
          Motivo {needReason ? <span className="text-danger">*</span> : <span className="text-ink-subtle">(opcional)</span>}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Registrado no log de auditoria."
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </label>

      {err && <p className="mt-3 text-sm text-danger">{err}</p>}
    </Modal>
  );
}
