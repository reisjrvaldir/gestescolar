import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { saasService, type SaasUserRow } from '@/services/saas';
import { fmtDate } from '@/lib/dates';

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Gestor',
  financial: 'Financeiro',
  teacher: 'Professor',
  guardian: 'Responsável',
};

export function SaasUsersPage() {
  const [rows, setRows] = useState<SaasUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('todos');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await saasService.users());
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const roles = useMemo(() => Array.from(new Set(rows.map((r) => r.role))), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== 'todos' && r.role !== role) return false;
      if (!q) return true;
      return [r.name, r.email, r.school_name].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [rows, query, role]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando usuários…</span></div>;
  }
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-danger">{error}</p>
        <button className="btn-outline mt-4" onClick={load}><RefreshCw size={15} /> Tentar novamente</button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Usuários das escolas"
        subtitle="Visão consolidada de gestores, professores e responsáveis de todas as escolas."
        actions={<button className="btn-outline" onClick={load} title="Atualizar"><RefreshCw size={15} /></button>}
      />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <select className="input w-48" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="todos">Todos os perfis</option>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input className="input w-64 pl-9" placeholder="Buscar nome, e-mail, escola…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhum usuário encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                  <th className="px-5 py-2.5">Nome</th>
                  <th className="hidden px-5 py-2.5 sm:table-cell">E-mail</th>
                  <th className="px-5 py-2.5">Perfil</th>
                  <th className="hidden px-5 py-2.5 md:table-cell">Escola</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="hidden px-5 py-2.5 lg:table-cell">Criado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-canvas">
                    <td className="px-5 py-2.5 font-medium text-ink">{r.name ?? '—'}</td>
                    <td className="hidden px-5 py-2.5 text-ink-muted sm:table-cell">{r.email ?? '—'}</td>
                    <td className="px-5 py-2.5 text-ink-muted">{ROLE_LABELS[r.role] ?? r.role}</td>
                    <td className="hidden px-5 py-2.5 text-ink-muted md:table-cell">{r.school_name ?? '—'}</td>
                    <td className="px-5 py-2.5"><StatusBadge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'Ativo' : r.status}</StatusBadge></td>
                    <td className="hidden px-5 py-2.5 text-ink-muted lg:table-cell">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
