import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, School2, Wallet, AlertTriangle, ClipboardCheck, Loader2,
  Mail, Star, RefreshCw, TrendingUp, TrendingDown, UserPlus, CheckCircle2,
  ArrowUpRight, ArrowDownRight, LayoutDashboard, Eye, EyeOff, Send, Gift,
  CalendarDays, Zap, FileText, Check,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import { api } from '@/lib/api';
import { brl } from '@/lib/fees';
import { classesService } from '@/services/classes';
import { messagesService, type Contact } from '@/services/messages';
import { listEvents, EVENT_TYPE_LABELS, type CalendarEvent } from '@/services/calendar';
import { SHIFT_LABELS, type SchoolClass, type Student } from '@/types/models';
import { LEVEL_LABELS } from '@/services/subjects';
import { useMe } from '@/auth/AuthGate';

interface ChildStat {
  id: string;
  name: string;
  registration_number: string;
  monthly_fee: number;
  photo_url?: string;
  class_name?: string;
  class_year?: number;
  present_month: number;
  absent_month: number;
  avg_grade: number;
  open_invoices: number;
}

interface RevenuePoint { month: string; total: number }
interface UpcomingCharge {
  id: string;
  student_name?: string;
  class_name?: string;
  amount: number;
  due_date?: string;
  status: 'pending' | 'overdue';
}
interface Activity { type: string; title: string; subtitle?: string; at?: string }
interface PixSummary { count: number; total: number; avg_ticket: number; success_rate: number }

interface DashboardStats {
  role: string;
  // admin
  students?: number;
  classes?: number;
  teachers?: number;
  revenue_month?: number;
  revenue_delta_pct?: number | null;
  overdue_amount?: number;
  overdue_count?: number;
  attendance_today?: number;
  presence_pct?: number | null;
  expenses_month?: number;
  balance_month?: number;
  revenue_series?: RevenuePoint[];
  upcoming_charges?: UpcomingCharge[];
  recent_activities?: Activity[];
  pix_summary?: PixSummary;
  subscription_status?: string | null;
  trial_days_left?: number | null;
  // guardian
  children?: ChildStat[];
  unread_messages?: number;
  upcoming_events?: any[];
  pending_invoices?: any[];
  overdue_total?: number;
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `${d} dias atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const ACTIVITY_ICON: Record<string, { icon: typeof CheckCircle2; tone: string }> = {
  payment: { icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  student: { icon: UserPlus, tone: 'bg-primary-soft text-primary' },
  invoice: { icon: Wallet, tone: 'bg-warning-soft text-warning' },
};

const REFRESH_MS = 30_000;

export function DashboardPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [myClasses, setMyClasses] = useState<SchoolClass[] | null>(null);

  // Olho de privacidade: oculta valores financeiros sensíveis (padrão: oculto)
  const [hideFin, setHideFin] = useState(() => localStorage.getItem('dash_hide_fin') !== '0');
  function toggleFin() {
    setHideFin(h => {
      localStorage.setItem('dash_hide_fin', h ? '0' : '1');
      return !h;
    });
  }

  // Dados extras do dashboard do gestor
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [adminClasses, setAdminClasses] = useState<SchoolClass[]>([]);
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Modal: registrar ocorrência
  const [occOpen, setOccOpen] = useState(false);
  const [occStudent, setOccStudent] = useState('');
  const [occText, setOccText] = useState('');
  const [occBusy, setOccBusy] = useState(false);

  // Modal: enviar comunicado
  const [comOpen, setComOpen] = useState(false);
  const [comSubject, setComSubject] = useState('');
  const [comBody, setComBody] = useState('');
  const [comClass, setComClass] = useState('');
  const [comBusy, setComBusy] = useState(false);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const r = await api.get<{ ok: boolean; data: DashboardStats }>('/dashboard/stats');
      setStats(r.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Auto-refresh a cada 30s (realtime)
    const t = setInterval(() => fetchStats(true), REFRESH_MS);
    // Refetch quando a aba ganha foco novamente
    const onFocus = () => fetchStats(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchStats]);

  // Professor/coordenador: carrega as turmas onde ele é o regente.
  useEffect(() => {
    if (stats && ['teacher', 'coordinator'].includes(stats.role)) {
      classesService.mine().then(setMyClasses).catch(() => setMyClasses([]));
    }
  }, [stats?.role]);

  // Gestão: alunos (aniversariantes + ocorrência), contatos, turmas e agenda de hoje.
  useEffect(() => {
    if (!stats || !['school_admin', 'financial', 'superadmin'].includes(stats.role)) return;
    api.get<{ data: Student[] }>('/students').then(r => setAllStudents(r.data.filter(s => s.status === 'active'))).catch(() => {});
    messagesService.contacts().then(setContacts).catch(() => {});
    classesService.list().then(setAdminClasses).catch(() => {});
    listEvents(new Date().getFullYear()).then(evs => {
      const today = new Date();
      const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setTodayEvents(evs.filter(e => e.date_start === t || (e.date_end && e.date_start <= t && e.date_end >= t)));
    }).catch(() => {});
  }, [stats?.role]);

  async function sendOccurrence() {
    const st = allStudents.find(s => s.id === occStudent);
    if (!st || !occText.trim()) { showToast('error', 'Selecione o aluno e descreva a ocorrência.'); return; }
    const contact = contacts.find(ct =>
      ct.role === 'guardian' &&
      ((st.guardian_email && ct.email === st.guardian_email) || (st.guardian_name && ct.name === st.guardian_name)),
    );
    if (!contact) { showToast('error', 'O responsável deste aluno ainda não tem acesso ao sistema.'); return; }
    setOccBusy(true);
    try {
      await messagesService.send({
        recipient_id: contact.id,
        subject: `Ocorrência — ${st.name}`,
        body: occText.trim(),
        student_id: st.id,
      });
      showToast('success', `Ocorrência registrada e enviada para ${contact.name}.`);
      setOccOpen(false); setOccStudent(''); setOccText('');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar a ocorrência.');
    } finally { setOccBusy(false); }
  }

  async function sendComunicado() {
    if (!comSubject.trim() || !comBody.trim()) { showToast('error', 'Informe o assunto e a mensagem.'); return; }
    setComBusy(true);
    try {
      const r = await messagesService.broadcast({
        subject: comSubject.trim(),
        body: comBody.trim(),
        class_id: comClass || undefined,
      });
      showToast('success', `Comunicado enviado para ${r.sent ?? 'os'} responsável(is).`);
      setComOpen(false); setComSubject(''); setComBody(''); setComClass('');
    } catch (e: any) {
      showToast('error', e?.message ?? 'Erro ao enviar o comunicado.');
    } finally { setComBusy(false); }
  }

  if (loading || !stats) {
    return <div className="flex items-center justify-center py-20 text-ink-muted"><Loader2 className="animate-spin" size={24} /> <span className="ml-2">Carregando…</span></div>;
  }

  const refreshIndicator = (
    <div className="mb-4 flex items-center justify-end gap-2 text-xs text-ink-subtle">
      <button
        type="button"
        onClick={() => fetchStats()}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-canvas hover:text-ink-muted"
        disabled={refreshing}
        title="Atualizar agora"
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Atualizando…' : 'Atualizar'}
      </button>
      {lastUpdated && (
        <span>• {lastUpdated.toLocaleTimeString('pt-BR')} (auto a cada 30s)</span>
      )}
    </div>
  );

  // -------------------- Dashboard do RESPONSÁVEL --------------------
  if (stats.role === 'guardian') {
    const child = stats.children![0];
    const events = stats.upcoming_events ?? [];
    const pendingInv = stats.pending_invoices ?? [];

    if (!child) {
      return (
        <>
          <PageHero title="Dashboard" subtitle="Portal do responsável" icon={LayoutDashboard} />
          <div className="card p-8 text-center text-ink-muted">
            <GraduationCap size={48} className="mx-auto mb-2 text-ink-subtle" />
            <p>Nenhum aluno vinculado à sua conta.</p>
            <p className="mt-1 text-xs">Procure a secretaria da escola.</p>
          </div>
        </>
      );
    }

    const EVENT_COLORS: Record<string, string> = {
      holiday: 'bg-danger-soft text-danger',
      exam: 'bg-warning-soft text-warning',
      meeting: 'bg-primary-soft text-primary',
      event: 'bg-purple-soft text-purple',
      recess: 'bg-success-soft text-success',
    };
    const EVENT_LABELS: Record<string, string> = {
      holiday: 'Feriado', exam: 'Avaliação', meeting: 'Reunião', event: 'Evento', recess: 'Recesso',
    };

    return (
      <>
        <PageHero title="Dashboard" subtitle="Acompanhe a rotina e o desempenho do seu filho(a)." icon={LayoutDashboard} />
        {refreshIndicator}

        {/* Cabeçalho do aluno */}
        <div className="card mb-6 p-5">
          <div className="flex items-center gap-4">
            {child.photo_url ? (
              <img src={child.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
                {initials(child.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-ink">{child.name}</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
                <span>Matrícula: <span className="font-mono font-semibold">{child.registration_number}</span></span>
                {child.class_name && <span>Turma: <strong>{child.class_name}</strong></span>}
                {child.class_year && <span>Ano letivo: <strong>{child.class_year}</strong></span>}
                <span>Mensalidade: <strong className="text-ink">{brl(Number(child.monthly_fee) || 0)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <a href="/app/grades" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md" style={{ background: 'rgba(59,130,246,0.08)' }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><Star size={20} /></div>
            <span className="text-sm font-bold text-blue-700">Ver Boletim</span>
          </a>
          <a href="/app/messages" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md" style={{ background: 'rgba(34,197,94,0.08)' }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-600"><Mail size={20} /></div>
            <div>
              <span className="text-sm font-bold text-green-700">Abrir Mensagens</span>
              {stats.unread_messages! > 0 && <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">{stats.unread_messages}</span>}
            </div>
          </a>
          <a href="/app/faturas" className="card flex items-center gap-3 p-4 transition-shadow hover:shadow-md" style={{ background: 'rgba(234,179,8,0.08)' }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600"><Wallet size={20} /></div>
            <span className="text-sm font-bold text-yellow-700">Faturas</span>
          </a>
        </div>

        {/* Próximos eventos + Resumo financeiro */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Próximos eventos */}
          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <h3 className="text-sm font-bold text-ink">Próximos eventos</h3>
            </div>
            {events.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-subtle">Nenhum evento próximo.</p>
            ) : (
              <div className="divide-y divide-border">
                {events.map((ev: any) => (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${EVENT_COLORS[ev.event_type] ?? 'bg-canvas text-ink-muted'}`}>
                      {new Date(ev.date_start + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{ev.title}</p>
                      <p className="text-xs text-ink-muted">
                        {new Date(ev.date_start + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}
                        {ev.date_end && ev.date_end !== ev.date_start && ` — ${new Date(ev.date_end + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                      </p>
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${EVENT_COLORS[ev.event_type] ?? 'bg-canvas text-ink-muted'}`}>
                        {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo financeiro */}
          <div className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <h3 className="text-sm font-bold text-ink">Resumo financeiro</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Próximas faturas</p>
                {pendingInv.filter((i: any) => i.status === 'pending').length === 0 ? (
                  <p className="mt-2 text-sm text-ink-subtle">Nenhuma fatura pendente.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {pendingInv.filter((i: any) => i.status === 'pending').slice(0, 3).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-muted">
                          {inv.kind === 'avulsa' ? 'Avulsa' : `Mensalidade${inv.reference_month ? ` ${inv.reference_month}` : ''}`}
                        </span>
                        <span className="font-bold text-ink">{brl(inv.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Faturas em atraso</p>
                {(stats.overdue_count ?? 0) === 0 ? (
                  <p className="mt-2 text-sm text-success font-medium">Você não tem faturas atrasadas</p>
                ) : (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-danger font-medium">{stats.overdue_count} fatura(s) vencida(s)</span>
                    <span className="text-lg font-extrabold text-danger">{brl(stats.overdue_total ?? 0)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // -------------------- Dashboard ADMIN / FINANCEIRO / PROFESSOR --------------------
  // Financeiro só para gestão/financeiro. Professor/coordenador veem apenas
  // indicadores operacionais (o backend também não envia os dados financeiros).
  const finance = ['school_admin', 'financial', 'superadmin'].includes(stats.role);
  const series = stats.revenue_series ?? [];
  const maxRevenue = Math.max(1, ...series.map((s) => s.total));
  const charges = stats.upcoming_charges ?? [];
  const activities = stats.recent_activities ?? [];
  const pix = stats.pix_summary;
  const delta = stats.revenue_delta_pct;

  // Olho de privacidade: mascara valores financeiros
  const money = (v: number) => (hideFin ? 'R$ ••••••' : brl(v));
  const firstName = (me?.name ?? '').split(' ')[0];

  // Presença hoje: % vinda do backend; fallback p/ contagem de turmas com chamada
  const presenceVal = typeof stats.presence_pct === 'number'
    ? `${stats.presence_pct}%`
    : (stats.attendance_today ?? 0) > 0 ? String(stats.attendance_today) : '—';
  const presenceHint = typeof stats.presence_pct === 'number'
    ? `${stats.attendance_today ?? 0} turma(s) com chamada`
    : (stats.attendance_today ?? 0) > 0 ? 'turma(s) com chamada hoje' : 'nenhuma chamada hoje';

  // Aniversariantes do mês (birth_date chega como YYYY-MM-DD)
  const curMonth = new Date().getMonth() + 1;
  const birthdays = allStudents
    .filter(s => s.birth_date && Number(s.birth_date.slice(5, 7)) === curMonth)
    .sort((a, b) => Number(a.birth_date!.slice(8, 10)) - Number(b.birth_date!.slice(8, 10)));

  const sortedTodayEvents = [...todayEvents].sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'));

  return (
    <>
      <PageHero
        title={firstName ? `Bem-vindo(a), ${firstName}` : 'Dashboard'}
        subtitle="Veja um panorama completo da operação escolar."
        icon={LayoutDashboard}
        actions={finance ? (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
            onClick={() => navigate('/app/finance')}
          >
            <TrendingUp size={16} /> Ver relatórios
          </button>
        ) : undefined}
      />
      {refreshIndicator}

      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
          toast.type === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
        </div>
      )}

      {finance && stats.subscription_status === 'trialing' && stats.trial_days_left != null && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle size={18} />
          <span className="font-medium">Período de teste ativo</span>
          <span className="text-warning/80">
            — restam {stats.trial_days_left} dia{stats.trial_days_left !== 1 ? 's' : ''}. Escolha um plano para não perder o acesso.
          </span>
        </div>
      )}

      {stats.role === 'school_admin' && <OnboardingChecklist />}

      {/* Cards principais */}
      {finance ? (
        <>
          <div className="mb-2 flex items-center justify-end">
            <button
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-canvas hover:text-ink"
              onClick={toggleFin}
              title={hideFin ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
            >
              {hideFin ? <EyeOff size={14} /> : <Eye size={14} />}
              {hideFin ? 'Mostrar valores' : 'Ocultar valores'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <div className="flex items-start gap-4 rounded-xl border border-purple/20 bg-purple/5 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple/10 text-purple"><GraduationCap size={20} /></div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Total de alunos</p>
                <p className="text-2xl font-extrabold text-ink">{stats.students ?? 0}</p>
                <p className="text-[11px] text-ink-subtle">{stats.classes ?? 0} turma(s) ativa(s)</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-success/20 bg-success-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><ClipboardCheck size={20} /></div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Presença hoje</p>
                <p className="text-2xl font-extrabold text-success">{presenceVal}</p>
                <p className="text-[11px] text-ink-subtle">{presenceHint}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-warning/20 bg-warning-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning"><Wallet size={20} /></div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-muted">Receita do mês</p>
                <p className="truncate text-2xl font-extrabold text-ink">{money(stats.revenue_month ?? 0)}</p>
                <p className="text-[11px] text-ink-subtle">
                  {delta != null && !hideFin ? `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}% vs. mês anterior` : 'recebido no mês'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border border-danger/20 bg-danger-soft/30 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><AlertTriangle size={20} /></div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-ink-muted">Inadimplência</p>
                <p className="truncate text-2xl font-extrabold text-danger">{money(stats.overdue_amount ?? 0)}</p>
                <p className="text-[11px] text-ink-subtle">{stats.overdue_count ?? 0} fatura(s) vencida(s)</p>
              </div>
            </div>
          </div>

          {/* Ações rápidas · Agenda de hoje · Aniversariantes */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Ações rápidas */}
            <div className="card p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink"><Zap size={15} className="text-purple" /> Ações rápidas</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: UserPlus, label: 'Novo aluno', hint: 'Matricular aluno', tone: 'bg-primary-soft/40 border-primary/20 text-primary', onClick: () => navigate('/app/students/new') },
                  { icon: AlertTriangle, label: 'Registrar ocorrência', hint: 'Notifica o responsável', tone: 'bg-danger-soft/40 border-danger/20 text-danger', onClick: () => setOccOpen(true) },
                  { icon: Send, label: 'Enviar comunicado', hint: 'Turma ou toda a escola', tone: 'bg-success-soft/40 border-success/20 text-success', onClick: () => setComOpen(true) },
                  { icon: FileText, label: 'Gerar boletim', hint: 'Boletim escolar', tone: 'bg-purple/5 border-purple/20 text-purple', onClick: () => navigate('/app/grades/boletim') },
                  { icon: ClipboardCheck, label: 'Ver chamada', hint: 'Frequência do dia', tone: 'bg-warning-soft/40 border-warning/20 text-warning', onClick: () => navigate('/app/attendance') },
                  { icon: Wallet, label: 'Abrir financeiro', hint: 'Visão geral', tone: 'bg-primary-soft/40 border-primary/20 text-primary', onClick: () => navigate('/app/finance') },
                ].map(a => (
                  <button key={a.label} className={`rounded-xl border p-3 text-left transition hover:shadow-card ${a.tone}`} onClick={a.onClick}>
                    <a.icon size={18} />
                    <p className="mt-1.5 text-xs font-bold text-ink">{a.label}</p>
                    <p className="text-[10px] leading-tight text-ink-muted">{a.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Agenda de hoje */}
            <div className="card flex flex-col overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><CalendarDays size={15} className="text-purple" /> Agenda de hoje</h3>
              </div>
              {sortedTodayEvents.length === 0 ? (
                <p className="flex-1 px-5 py-8 text-center text-sm text-ink-subtle">Nenhum compromisso para hoje.</p>
              ) : (
                <div className="flex-1 divide-y divide-border">
                  {sortedTodayEvents.slice(0, 5).map(ev => (
                    <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 w-12 shrink-0 font-mono text-xs font-bold text-purple">
                        {ev.start_time ?? 'dia todo'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{ev.title}</p>
                        <p className="text-xs text-ink-muted">
                          {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                          {ev.class_name ? ` · ${ev.class_name}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button
                className="border-t border-border px-5 py-2.5 text-xs font-semibold text-purple hover:bg-canvas"
                onClick={() => navigate('/app/calendar')}
              >
                Ver agenda completa →
              </button>
            </div>

            {/* Aniversariantes do mês */}
            <div className="card flex flex-col overflow-hidden">
              <div className="border-b border-border px-5 py-3.5">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Gift size={15} className="text-purple" /> Aniversariantes do mês</h3>
              </div>
              {birthdays.length === 0 ? (
                <p className="flex-1 px-5 py-8 text-center text-sm text-ink-subtle">Nenhum aniversariante este mês.</p>
              ) : (
                <div className="flex-1 divide-y divide-border">
                  {birthdays.slice(0, 6).map(s => (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-purple/10 text-xs font-bold text-purple">
                        {initials(s.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                        <p className="text-xs text-ink-muted">{s.class_name ?? '—'}</p>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-purple">
                        {s.birth_date!.slice(8, 10)}/{s.birth_date!.slice(5, 7)}
                      </span>
                    </div>
                  ))}
                  {birthdays.length > 6 && (
                    <p className="px-5 py-2 text-center text-xs text-ink-subtle">+{birthdays.length - 6} aniversariante(s)</p>
                  )}
                </div>
              )}
              <button
                className="border-t border-border px-5 py-2.5 text-xs font-semibold text-purple hover:bg-canvas"
                onClick={() => navigate('/app/students')}
              >
                Ver todos os alunos →
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard label="Alunos ativos" value={stats.students ?? 0} icon={GraduationCap} tone="primary" />
          <MetricCard label="Turmas ativas" value={stats.classes ?? 0} icon={School2} tone="primary" hint={`${stats.teachers ?? 0} professor(es)`} />
          <MetricCard label="Presenças hoje" value={stats.attendance_today ?? 0} icon={ClipboardCheck} tone="success" hint="turmas com chamada" />
        </div>
      )}

      {/* Minhas turmas — professor/coordenador */}
      {['teacher', 'coordinator'].includes(stats.role) && myClasses !== null && (
        <div className="mt-4 card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Minhas turmas</h3>
            <span className="text-xs text-ink-subtle">{myClasses.length} turma(s)</span>
          </div>
          {myClasses.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-subtle">
              Você ainda não é regente de nenhuma turma. A gestão vincula o professor à turma no cadastro da turma.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {myClasses.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted">
                        {c.year ?? '—'}{c.shift ? ` · ${SHIFT_LABELS[c.shift] ?? c.shift}` : ''}{c.level ? ` · ${LEVEL_LABELS[c.level] ?? c.level}` : ''}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-soft px-2 py-1 text-xs font-semibold text-primary">
                      <GraduationCap size={12} /> {c.student_count ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a href="/app/attendance" className="btn-outline flex-1 justify-center text-xs">
                      <ClipboardCheck size={13} /> Chamada
                    </a>
                    <a href="/app/grades" className="btn-outline flex-1 justify-center text-xs">
                      <Star size={13} /> Notas
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Linha 1: gráfico de receita + próximas cobranças + atividades */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Gráfico de receita */}
        {finance && (
        <div className="card p-5 xl:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Receita dos últimos 6 meses</h3>
            <TrendingUp size={16} className="text-success" />
          </div>
          {series.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-subtle">Sem dados de receita.</p>
          ) : (
            <div className="flex h-44 items-end justify-between gap-2">
              {series.map((s, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium text-ink-subtle">
                    {hideFin ? '•••' : s.total >= 1000 ? `${(s.total / 1000).toFixed(0)}k` : s.total.toFixed(0)}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${Math.max(4, (s.total / maxRevenue) * 100)}%` }}
                    title={brl(s.total)}
                  />
                  <span className="text-[11px] capitalize text-ink-muted">{s.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Próximas cobranças */}
        {finance && (
        <div className="card overflow-hidden xl:col-span-1">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Próximas cobranças</h3>
          </div>
          {charges.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma cobrança em aberto.</p>
          ) : (
            <div className="divide-y divide-border">
              {charges.map((ch) => (
                <div key={ch.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                    {initials(ch.student_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{ch.student_name ?? '—'}</p>
                    <p className="text-xs text-ink-muted">
                      {ch.class_name ?? '—'}
                      {ch.due_date && ` • vence ${new Date(String(ch.due_date).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{money(ch.amount)}</p>
                    <StatusBadge tone={ch.status === 'overdue' ? 'danger' : 'warning'}>
                      {ch.status === 'overdue' ? 'Vencida' : 'Em aberto'}
                    </StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Atividades recentes */}
        <div className="card overflow-hidden xl:col-span-1">
          <div className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-bold text-ink">Atividades recentes</h3>
          </div>
          {activities.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-subtle">Nenhuma atividade recente.</p>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((a, i) => {
                const cfg = ACTIVITY_ICON[a.type] ?? ACTIVITY_ICON.invoice;
                const Icon = cfg.icon;
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.tone}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.title}</p>
                      <p className="truncate text-xs text-ink-muted">{a.subtitle ?? ''}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-subtle">{timeAgo(a.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Linha 2: PIX + resumo financeiro */}
      {finance && (
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Painel PIX */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink">Pagamentos via PIX (mês)</h3>
            <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">PIX</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-ink-muted">Recebido</p>
              <p className="mt-1 text-xl font-extrabold text-success">{money(pix?.total ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Transações</p>
              <p className="mt-1 text-xl font-extrabold text-ink">{pix?.count ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Ticket médio</p>
              <p className="mt-1 text-xl font-extrabold text-ink">{money(pix?.avg_ticket ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Taxa de sucesso</p>
              <p className="mt-1 text-xl font-extrabold text-ink">{((pix?.success_rate ?? 0) * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-bold text-ink">Resumo financeiro</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-ink-muted"><ArrowUpRight size={15} className="text-success" /> Receitas do mês</span>
              <span className="font-bold text-success">{money(stats.revenue_month ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-ink-muted"><ArrowDownRight size={15} className="text-danger" /> Despesas do mês</span>
              <span className="font-bold text-danger">{money(stats.expenses_month ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="font-semibold text-ink">Saldo do mês</span>
              <span className={`inline-flex items-center gap-1 font-extrabold ${(stats.balance_month ?? 0) >= 0 ? 'text-ink' : 'text-danger'}`}>
                {(stats.balance_month ?? 0) >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                {money(stats.balance_month ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ─── Modal: Registrar ocorrência ─── */}
      <Modal
        open={occOpen}
        title="Registrar ocorrência"
        onClose={() => setOccOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setOccOpen(false)} disabled={occBusy}>Cancelar</button>
            <button className="btn-primary" onClick={sendOccurrence} disabled={occBusy}>
              {occBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar ao responsável
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>A ocorrência é enviada diretamente ao responsável do aluno pelo chat de Mensagens.</span>
          </div>
          <div>
            <label className="label">Aluno *</label>
            <select className="input" value={occStudent} onChange={e => setOccStudent(e.target.value)}>
              <option value="">Selecione o aluno…</option>
              {allStudents.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.class_name ? ` — ${s.class_name}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Descrição da ocorrência *</label>
            <textarea
              className="input min-h-[110px] resize-y"
              placeholder="Descreva o que aconteceu…"
              value={occText}
              onChange={e => setOccText(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ─── Modal: Enviar comunicado ─── */}
      <Modal
        open={comOpen}
        title="Enviar comunicado"
        onClose={() => setComOpen(false)}
        footer={
          <>
            <button className="btn-outline" onClick={() => setComOpen(false)} disabled={comBusy}>Cancelar</button>
            <button className="btn-primary" onClick={sendComunicado} disabled={comBusy}>
              {comBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar comunicado
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Destinatários</label>
            <select className="input" value={comClass} onChange={e => setComClass(e.target.value)}>
              <option value="">Todos os responsáveis</option>
              {adminClasses.map(c => <option key={c.id} value={c.id}>Turma {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Assunto *</label>
            <input
              className="input"
              placeholder="Ex.: Reunião de pais e mestres"
              value={comSubject}
              onChange={e => setComSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Mensagem *</label>
            <textarea
              className="input min-h-[110px] resize-y"
              placeholder="Escreva o comunicado…"
              value={comBody}
              onChange={e => setComBody(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
