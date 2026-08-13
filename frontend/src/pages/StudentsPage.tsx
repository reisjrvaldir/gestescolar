import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { lookupCep, formatCep, normalizeCep } from '@/lib/viaCep';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap, Search, Loader2, Copy, Check, Save, Plus,
  User, Phone, FileText, Link2, Upload, Printer, Pencil,
  Users, UserPlus, Gift, AlertTriangle, Eye, MoreVertical,
  FileBadge, ArrowLeftRight, BookMarked,
} from 'lucide-react';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SensitiveField } from '@/components/ui/SensitiveField';
import { studentsService, type NewStudent, type CreatedStudent } from '@/services/students';
import { documentsService } from '@/services/documents';
import { classesService } from '@/services/classes';
import { schoolPlansService, type SchoolPlan } from '@/services/schoolPlans';
import { queryCache, CK, CACHE_TTL } from '@/lib/cache';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';
import { brl } from '@/lib/fees';
import { resizeImageToDataUrl } from '@/lib/image';
import { StudentEditModal } from '@/components/students/StudentEditModal';
import { studentFormSchema, type StudentFormValues } from '@/lib/schemas';
import { applyServerErrors } from '@/hooks/useFormErrors';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Senha inicial padrão para todos os responsáveis novos — a troca é obrigatória
 *  no 1º acesso. Espelha o valor definido no backend (validation.ts). */
const DEFAULT_GUARDIAN_PASSWORD = 'Escola@2026';

type StatusFilter = 'all' | 'active' | 'inactive';

type FormFields = StudentFormValues;

type DetailTab = 'dados' | 'responsavel' | 'contatos' | 'documentos';

/** Card colorido de KPI usado no dashboard da página de alunos. */
function KpiCard({
  icon: Icon, tone, label, value, hint,
}: {
  icon: typeof User;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  label: string;
  value: string;
  hint?: string;
}) {
  const toneCls: Record<typeof tone, { bg: string; text: string }> = {
    primary: { bg: 'bg-primary-soft', text: 'text-primary' },
    success: { bg: 'bg-success-soft', text: 'text-success' },
    warning: { bg: 'bg-warning-soft', text: 'text-warning' },
    danger:  { bg: 'bg-danger-soft',  text: 'text-danger'  },
  };
  const t = toneCls[tone];
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.bg} ${t.text}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink-muted">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function generatePdf(title: string, schoolName: string, student: Student) {
  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const w = window.open('', '_blank');
  if (!w) return;

  let body = '';
  if (title === 'Comprovante de Matrícula') {
    body = `
      <table><tbody>
        <tr><td><strong>Nome:</strong></td><td>${student.name}</td></tr>
        <tr><td><strong>Matrícula:</strong></td><td>${student.registration_number}</td></tr>
        <tr><td><strong>CPF:</strong></td><td>${student.cpf ?? '—'}</td></tr>
        <tr><td><strong>RG:</strong></td><td>${student.rg ?? '—'}</td></tr>
        <tr><td><strong>Data de Nascimento:</strong></td><td>${formatDate(student.birth_date)}</td></tr>
        <tr><td><strong>Tipo Sanguíneo:</strong></td><td>${student.blood_type ?? '—'}</td></tr>
        <tr><td><strong>Turma:</strong></td><td>${student.class_name ?? '—'}</td></tr>
        <tr><td><strong>Responsável:</strong></td><td>${student.guardian_name ?? '—'}</td></tr>
        <tr><td><strong>Status:</strong></td><td>${student.status === 'active' ? 'Ativo' : 'Inativo'}</td></tr>
      </tbody></table>
      <p style="margin-top:40px;font-size:12px;color:#666">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    `;
  } else {
    body = `
      <table><tbody>
        <tr><td><strong>Aluno:</strong></td><td>${student.name}</td></tr>
        <tr><td><strong>Matrícula:</strong></td><td>${student.registration_number}</td></tr>
        <tr><td><strong>Turma:</strong></td><td>${student.class_name ?? '—'}</td></tr>
        <tr><td><strong>Mensalidade:</strong></td><td>${student.monthly_fee != null ? brl(Number(student.monthly_fee)) : '—'}</td></tr>
        <tr><td><strong>Responsável:</strong></td><td>${student.guardian_name ?? '—'}</td></tr>
        <tr><td><strong>Status:</strong></td><td>${student.status === 'active' ? 'Ativo' : 'Inativo'}</td></tr>
      </tbody></table>
      <p style="margin-top:40px;font-size:12px;color:#666">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
    `;
  }

  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a56db; padding-bottom: 20px; }
      .header h1 { font-size: 20px; color: #1a56db; margin: 0 0 5px; }
      .header p { font-size: 12px; color: #666; margin: 2px 0; }
      h2 { font-size: 16px; color: #333; margin: 20px 0 10px; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
      td:first-child { width: 180px; color: #666; }
      @media print { body { padding: 20px; } }
    </style>
  </head><body>
    <div class="header">
      <h1>${schoolName}</h1>
    </div>
    <h2>${title}</h2>
    ${body}
  </body></html>`);
  w.document.close();
  w.print();
}

export function StudentsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const me = useMe();
  const schoolName = me?.school_name ?? 'Escola';
  const canReveal = ['school_admin', 'financial', 'superadmin'].includes(me?.role ?? '');
  const isNewRoute = location.pathname.endsWith('/new');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setPageError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('dados');
  const [issuingDoc, setIssuingDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [irYear, setIrYear] = useState(new Date().getFullYear() - 1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [classFilter, setClassFilter] = useState<string>('');
  const [serieFilter, setSerieFilter] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<CreatedStudent | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);

  async function issueDocument(key: string, action: () => Promise<void>) {
    setDocError(null);
    setIssuingDoc(key);
    try {
      await action();
    } catch (e: any) {
      setDocError(e?.message ?? 'Não foi possível gerar o documento.');
    } finally {
      setIssuingDoc(null);
    }
  }

  const load = useCallback(async (force = false) => {
    // Cache-hit: usa dados válidos sem tocar a rede e sem piscar loading.
    if (!force) {
      const s = queryCache.get<Student[]>(CK.students, CACHE_TTL);
      const c = queryCache.get<SchoolClass[]>(CK.classes, CACHE_TTL);
      const p = queryCache.get<SchoolPlan[]>(CK.plans, CACHE_TTL);
      if (s && c && p) { setStudents(s); setClasses(c); setPlans(p); setLoading(false); return; }
    }
    setLoading(true);
    setPageError(null);
    try {
      const [s, c, p] = await Promise.all([
        studentsService.list(),
        classesService.list(),
        schoolPlansService.list(),
      ]);
      queryCache.set(CK.students, s);
      queryCache.set(CK.classes, c);
      queryCache.set(CK.plans, p);
      setStudents(s);
      setClasses(c);
      setPlans(p);
    } catch (e: any) {
      setPageError(e?.message ?? 'Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: students.length,
    active: students.filter((s) => s.status === 'active').length,
    inactive: students.filter((s) => s.status === 'inactive').length,
  }), [students]);

  /** Extrai "9º Ano" de "9º Ano A" (série sem a turma). */
  const serieOf = (className?: string) =>
    (className ?? '').replace(/\s*[A-Z]$/i, '').trim();

  /** Lista de séries distintas presentes nos alunos, para o dropdown. */
  const distinctSeries = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => { const v = serieOf(s.class_name); if (v) set.add(v); });
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => statusFilter === 'all' ? true : s.status === statusFilter)
      .filter((s) => !classFilter || s.class_id === classFilter)
      .filter((s) => !serieFilter || serieOf(s.class_name) === serieFilter)
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q));
  }, [students, query, statusFilter, classFilter, serieFilter]);

  /** KPI: aniversariantes do mês atual (usa birth_date se disponível). */
  const birthdaysMonth = useMemo(() => {
    const m = new Date().getMonth() + 1;
    return students.filter((s) => {
      if (!s.birth_date) return false;
      const bm = Number(String(s.birth_date).slice(5, 7));
      return bm === m;
    }).length;
  }, [students]);

  /** KPI: novos cadastros nos últimos 30 dias (aproximação de "novas matrículas"). */
  const newLast30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return students.filter((s) => {
      if (!s.created_at) return false;
      return new Date(s.created_at).getTime() >= cutoff;
    }).length;
  }, [students]);

  const { register, handleSubmit, reset, watch, setError, setValue, formState: { errors } } = useForm<FormFields>({ resolver: zodResolver(studentFormSchema) });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const uid = useId();
  const fId = (f: string) => `${uid}-${f}`;
  const selectedPlanId = watch('plan_id');
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const discountPct = Math.min(100, Math.max(0, Number(watch('discount_percentage') ?? 0) || 0));
  const factor = 1 - discountPct / 100;
  const previewMonthly = selectedPlan ? Math.round(Number(selectedPlan.monthly_fee) * factor * 100) / 100 : 0;
  const previewEnrollment = selectedPlan ? Math.round(Number(selectedPlan.enrollment_fee ?? 0) * factor * 100) / 100 : 0;

  useEffect(() => {
    if (isNewRoute) {
      setSelected(null);
      reset({
        name: '', cpf: '', rg: '', birth_date: '', blood_type: '',
        father_name: '', mother_name: '', class_id: '', plan_id: '',
        address_zip: '', address_street: '', address_number: '', address_complement: '',
        address_neighborhood: '', address_city: '', address_state: '',
        guardian_name: '', guardian_email: '', guardian_cpf: '', guardian_phone: '', guardian_phone2: '',
      });
    }
  }, [isNewRoute, reset]);

  async function onSubmit(data: FormFields) {
    setSaving(true);
    setPageError(null);
    try {
      const payload: NewStudent = {
        name: data.name,
        cpf: data.cpf,
        rg: data.rg || undefined,
        birth_date: data.birth_date,
        blood_type: data.blood_type || undefined,
        photo_url: photoPreview || undefined,
        address_zip: data.address_zip || undefined,
        address_street: data.address_street || undefined,
        address_number: data.address_number || undefined,
        address_complement: data.address_complement || undefined,
        address_neighborhood: data.address_neighborhood || undefined,
        address_city: data.address_city || undefined,
        address_state: data.address_state || undefined,
        father_name: data.father_name ?? '',
        mother_name: data.mother_name ?? '',
        class_id: data.class_id || undefined,
        plan_id: data.plan_id,
        discount_percentage: data.discount_percentage != null ? Number(data.discount_percentage) : undefined,
        enrollment_payment_method: data.enrollment_payment_method || undefined,
        first_due: data.first_due || undefined,
        guardian: {
          name: data.guardian_name,
          email: data.guardian_email,
          cpf: data.guardian_cpf,
          phone: data.guardian_phone || undefined,
          phone2: data.guardian_phone2 || undefined,
        },
      };
      const created = await studentsService.create(payload);
      setCredentials(created);
      queryCache.invalidate(CK.students);
      // Recarrega em segundo plano — a navegação só acontece quando o usuário
      // fechar o popup de credenciais (evita popup sumir sozinho após clicar em
      // "Copiar dados" no meio do await).
      load(true).catch(() => { /* silencioso — o popup já está mostrando o sucesso */ });
    } catch (e: any) {
      if (!applyServerErrors(e, setError)) {
        setError('root', { message: e?.message ?? 'Erro ao cadastrar aluno' });
      }
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!credentials) return;
    const text =
      `Aluno: ${credentials.name}\n` +
      `Login (e-mail): ${credentials.guardian_email ?? '—'}\n` +
      `Matrícula (alternativa): ${credentials.registration_number}\n` +
      `Senha inicial: ${credentials.initial_password ?? DEFAULT_GUARDIAN_PASSWORD}\n` +
      `(troca de senha obrigatória no 1º acesso)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function initials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
  }

  const noPlans = plans.length === 0;

  // =================== TELA DE CADASTRO ===================
  if (isNewRoute) {
    return (
      <>
        <PageHero
          title="Cadastrar Aluno"
          subtitle="Preencha os dados para matricular um novo aluno."
          icon={UserPlus}
        />

        {(error || errors.root) && (
          <div role="alert" className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {error ?? errors.root?.message}
          </div>
        )}
        {noPlans && (
          <div className="mb-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
            Cadastre pelo menos um <strong>plano de mensalidade</strong> antes de matricular alunos.
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {/* Foto do aluno */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-subtle">Foto do aluno</h3>
            <div className="flex items-center gap-6">
              <div className="relative">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto do aluno" className="h-24 w-24 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-canvas border-2 border-dashed border-border text-ink-subtle" aria-hidden="true">
                    <Upload size={24} />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor={fId('photo')} className="btn-outline inline-flex cursor-pointer items-center gap-1.5 text-sm">
                  <Upload size={14} aria-hidden="true" /> Escolher foto
                  <input id={fId('photo')} type="file" accept="image/*" className="hidden" aria-label="Selecionar foto do aluno" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try { setPhotoPreview(await resizeImageToDataUrl(file, 256, 0.8)); }
                    catch { setPageError('Não foi possível processar a imagem.'); }
                  }} />
                </label>
                <p className="mt-2 text-xs text-ink-muted">JPG ou PNG — redimensionada automaticamente</p>
              </div>
            </div>
          </div>

          {/* Dados do aluno */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-subtle">Dados do aluno</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor={fId('name')} className="label">Nome completo *</label>
                  <input id={fId('name')} autoComplete="name" className="input" maxLength={120} aria-describedby={errors.name ? `${fId('name')}-err` : undefined} {...register('name')} />
                  {errors.name && <p id={`${fId('name')}-err`} className="mt-1 text-xs text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('cpf')} className="label">CPF *</label>
                  <input id={fId('cpf')} className="input" placeholder="000.000.000-00" inputMode="numeric" maxLength={14} aria-describedby={errors.cpf ? `${fId('cpf')}-err` : undefined} {...register('cpf')} />
                  {errors.cpf && <p id={`${fId('cpf')}-err`} className="mt-1 text-xs text-danger">{errors.cpf.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('rg')} className="label">RG</label>
                  <input id={fId('rg')} className="input" {...register('rg')} />
                </div>
                <div>
                  <label htmlFor={fId('birth_date')} className="label">Data de nascimento *</label>
                  <input id={fId('birth_date')} type="date" className="input" aria-describedby={errors.birth_date ? `${fId('birth_date')}-err` : undefined} {...register('birth_date')} />
                  {errors.birth_date && <p id={`${fId('birth_date')}-err`} className="mt-1 text-xs text-danger">{errors.birth_date.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('blood_type')} className="label">Tipo sanguíneo *</label>
                  <select id={fId('blood_type')} className="input" aria-describedby={errors.blood_type ? `${fId('blood_type')}-err` : undefined} {...register('blood_type')}>
                    <option value="">Selecione…</option>
                    {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                  {errors.blood_type && <p id={`${fId('blood_type')}-err`} className="mt-1 text-xs text-danger">{errors.blood_type.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={fId('father_name')} className="label">Nome do pai *</label>
                  <input id={fId('father_name')} className="input" maxLength={120} aria-describedby={errors.father_name ? `${fId('father_name')}-err` : undefined} {...register('father_name')} />
                  {errors.father_name && <p id={`${fId('father_name')}-err`} className="mt-1 text-xs text-danger">{errors.father_name.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('mother_name')} className="label">Nome da mãe *</label>
                  <input id={fId('mother_name')} className="input" maxLength={120} aria-describedby={errors.mother_name ? `${fId('mother_name')}-err` : undefined} {...register('mother_name')} />
                  {errors.mother_name && <p id={`${fId('mother_name')}-err`} className="mt-1 text-xs text-danger">{errors.mother_name.message}</p>}
                </div>
              </div>

              {/* Endereço — CEP dispara o ViaCEP e preenche o restante */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Endereço</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <label htmlFor={fId('address_zip')} className="label">CEP</label>
                    <div className="relative">
                      <input
                        id={fId('address_zip')}
                        className="input"
                        placeholder="00000-000"
                        inputMode="numeric"
                        maxLength={9}
                        {...register('address_zip', {
                          onChange: (e) => {
                            const formatted = formatCep(e.target.value);
                            e.target.value = formatted;
                            setCepError(null);
                          },
                          onBlur: async (e) => {
                            const digits = normalizeCep(e.target.value);
                            if (digits.length !== 8) return;
                            setCepLoading(true);
                            const found = await lookupCep(digits);
                            setCepLoading(false);
                            if (!found) { setCepError('CEP não encontrado.'); return; }
                            setValue('address_street', found.street, { shouldValidate: false });
                            setValue('address_neighborhood', found.neighborhood, { shouldValidate: false });
                            setValue('address_city', found.city, { shouldValidate: false });
                            setValue('address_state', found.state, { shouldValidate: false });
                          },
                        })}
                      />
                      {cepLoading && (
                        <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-subtle" aria-hidden="true" />
                      )}
                    </div>
                    {cepError && <p className="mt-1 text-xs text-danger">{cepError}</p>}
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={fId('address_street')} className="label">Endereço</label>
                    <input id={fId('address_street')} className="input" placeholder="Rua / Avenida" {...register('address_street')} />
                  </div>
                  <div className="sm:col-span-1">
                    <label htmlFor={fId('address_number')} className="label">Número</label>
                    <input id={fId('address_number')} className="input" placeholder="123" {...register('address_number')} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={fId('address_complement')} className="label">Complemento</label>
                    <input id={fId('address_complement')} className="input" placeholder="Apto, bloco…" {...register('address_complement')} />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={fId('address_neighborhood')} className="label">Bairro</label>
                    <input id={fId('address_neighborhood')} className="input" {...register('address_neighborhood')} />
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={fId('address_city')} className="label">Cidade</label>
                    <input id={fId('address_city')} className="input" {...register('address_city')} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={fId('address_state')} className="label">UF</label>
                    <input id={fId('address_state')} className="input uppercase" maxLength={2} {...register('address_state')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={fId('class_id')} className="label">Turma</label>
                  <select id={fId('class_id')} className="input" {...register('class_id')}>
                    <option value="">— Sem turma —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={fId('plan_id')} className="label">Plano (mensalidade) *</label>
                  <select id={fId('plan_id')} className="input" aria-describedby={errors.plan_id ? `${fId('plan_id')}-err` : undefined} {...register('plan_id')} disabled={noPlans}>
                    <option value="">Selecione…</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(Number(p.monthly_fee))}</option>)}
                  </select>
                  {errors.plan_id && <p id={`${fId('plan_id')}-err`} className="mt-1 text-xs text-danger">{errors.plan_id.message}</p>}
                </div>
              </div>

              {selectedPlan && (
                <div className="rounded-xl border border-border bg-canvas p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Cobrança inicial</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor={fId('discount_percentage')} className="label">Desconto (%)</label>
                      <input id={fId('discount_percentage')} type="number" step="0.1" min="0" max="100" className="input" placeholder="0"
                        {...register('discount_percentage', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <label htmlFor={fId('enrollment_payment_method')} className="label">Matrícula paga em</label>
                      <select id={fId('enrollment_payment_method')} className="input" {...register('enrollment_payment_method')} defaultValue="pix">
                        <option value="pix">PIX</option>
                        <option value="card">Cartão</option>
                        <option value="cash">Dinheiro (recebido)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={fId('first_due')} className="label">Vencimento</label>
                      <select id={fId('first_due')} className="input" {...register('first_due')} defaultValue="30">
                        <option value="30">Matrícula + 30 dias</option>
                        <option value="05">Todo dia 05</option>
                        <option value="10">Todo dia 10</option>
                        <option value="15">Todo dia 15</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
                    <span>Matrícula: <strong className="text-ink">{brl(previewEnrollment)}</strong></span>
                    <span>Mensalidade: <strong className="text-ink">{brl(previewMonthly)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Responsável */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-subtle">Responsável *</h3>
            <p className="mb-4 text-xs text-ink-muted">
              Uma conta de acesso será criada automaticamente. Senha temporária gerada — troca obrigatória no 1º acesso.
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={fId('guardian_name')} className="label">Nome do responsável *</label>
                  <input id={fId('guardian_name')} autoComplete="name" className="input" maxLength={120} aria-describedby={errors.guardian_name ? `${fId('guardian_name')}-err` : undefined} {...register('guardian_name')} />
                  {errors.guardian_name && <p id={`${fId('guardian_name')}-err`} className="mt-1 text-xs text-danger">{errors.guardian_name.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('guardian_cpf')} className="label">CPF do responsável *</label>
                  <input id={fId('guardian_cpf')} className="input" placeholder="000.000.000-00" inputMode="numeric" maxLength={14} aria-describedby={errors.guardian_cpf ? `${fId('guardian_cpf')}-err` : undefined} {...register('guardian_cpf')} />
                  {errors.guardian_cpf && <p id={`${fId('guardian_cpf')}-err`} className="mt-1 text-xs text-danger">{errors.guardian_cpf.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={fId('guardian_email')} className="label">Email *</label>
                  <input id={fId('guardian_email')} type="email" autoComplete="email" className="input" maxLength={254} aria-describedby={errors.guardian_email ? `${fId('guardian_email')}-err` : undefined} {...register('guardian_email')} />
                  {errors.guardian_email && <p id={`${fId('guardian_email')}-err`} className="mt-1 text-xs text-danger">{errors.guardian_email.message}</p>}
                </div>
                <div>
                  <label htmlFor={fId('guardian_phone')} className="label">Telefone *</label>
                  <input id={fId('guardian_phone')} autoComplete="tel" className="input" placeholder="(00) 00000-0000" inputMode="tel" maxLength={15} aria-describedby={errors.guardian_phone ? `${fId('guardian_phone')}-err` : undefined} {...register('guardian_phone')} />
                  {errors.guardian_phone && <p id={`${fId('guardian_phone')}-err`} className="mt-1 text-xs text-danger">{errors.guardian_phone.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={fId('guardian_phone2')} className="label">Telefone 2</label>
                  <input id={fId('guardian_phone2')} autoComplete="tel" className="input" placeholder="(00) 00000-0000" {...register('guardian_phone2')} />
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="btn-outline" onClick={() => navigate('/app/students')}>Cancelar</button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving || noPlans}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Cadastrando…' : 'Cadastrar Aluno'}
            </button>
          </div>
        </form>

        {/* Credenciais geradas */}
        {credentials && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
            <div role="dialog" aria-modal="true" aria-label="Aluno cadastrado com sucesso" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-bold text-ink">Aluno cadastrado com sucesso!</h3>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-success-soft p-4 text-success">
                  <p className="font-semibold">Conta do responsável criada.</p>
                  <p className="mt-1 text-xs">Anote ou envie estas credenciais ao responsável.</p>
                </div>
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="flex justify-between"><span className="text-ink-muted">Aluno:</span><span className="font-medium text-ink">{credentials.name}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Login (e-mail):</span><span className="font-medium text-primary">{credentials.guardian_email ?? '—'}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Matrícula (alternativa):</span><span className="font-mono text-ink-muted">{credentials.registration_number}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Senha inicial:</span><span className="font-mono font-bold text-ink">{credentials.initial_password ?? DEFAULT_GUARDIAN_PASSWORD}</span></div>
                </div>
                <p className="text-xs text-ink-muted">
                  Senha padrão da plataforma — <b className="font-mono">{DEFAULT_GUARDIAN_PASSWORD}</b>. O responsável será obrigado a trocar no 1º acesso.
                </p>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-outline flex items-center gap-1.5" onClick={copyCredentials}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar dados'}
                </button>
                <button className="btn-primary" onClick={() => { setCredentials(null); navigate('/app/students'); }}>Fechar</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // =================== TELA DE LISTAGEM 60/40 ===================
  const DETAIL_TABS: { key: DetailTab; label: string; icon: typeof User }[] = [
    { key: 'dados', label: 'Dados', icon: User },
    { key: 'responsavel', label: 'Responsável', icon: GraduationCap },
    { key: 'contatos', label: 'Contatos', icon: Phone },
    { key: 'documentos', label: 'Documentos', icon: FileText },
  ];

  function formatDate(d?: string) {
    if (!d) return '—';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  }

  return (
    <>
      {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      {/* ===== HERO ===== */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EDE9FE] via-[#F3EEFF] to-[#F5F3FF] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Gestão de alunos</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Cadastre, acompanhe e organize todas as informações dos alunos da sua escola em um só lugar.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-purple/90"
              onClick={() => navigate('/app/students/new')}
            >
              <Plus size={18} /> Novo aluno
            </button>
          </div>
          <div className="hidden shrink-0 items-center justify-center sm:flex">
            <div className="grid h-32 w-32 place-items-center rounded-full bg-purple/15 text-purple shadow-inner">
              <GraduationCap size={64} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== KPI CARDS ===== */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          tone="primary"
          label="Total de alunos"
          value={counts.all.toString()}
          hint={counts.active + ' ativos · ' + counts.inactive + ' inativos'}
        />
        <KpiCard
          icon={UserPlus}
          tone="success"
          label="Novas matrículas"
          value={newLast30.toString()}
          hint="nos últimos 30 dias"
        />
        <KpiCard
          icon={Gift}
          tone="warning"
          label="Aniversariantes do mês"
          value={birthdaysMonth.toString()}
          hint="alunos fazem aniversário este mês"
        />
        <KpiCard
          icon={AlertTriangle}
          tone="danger"
          label="Alunos inativos"
          value={counts.inactive.toString()}
          hint="não estão frequentando"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[7fr_3fr]">
        {/* ===== Coluna 70% — Lista ===== */}
        <div className="min-w-0 space-y-4">
          {/* Filtros (Turma / Série / Status / Busca) */}
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor={fId('filter-class')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Turma</label>
                <select id={fId('filter-class')} className="input" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                  <option value="">Todas as turmas</option>
                  {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor={fId('filter-serie')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Série</label>
                <select id={fId('filter-serie')} className="input" value={serieFilter} onChange={(e) => setSerieFilter(e.target.value)}>
                  <option value="">Todas as séries</option>
                  {distinctSeries.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label htmlFor={fId('filter-status')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Status</label>
                <select id={fId('filter-status')} className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">Todos ({counts.all})</option>
                  <option value="active">Ativos ({counts.active})</option>
                  <option value="inactive">Inativos ({counts.inactive})</option>
                </select>
              </div>
              <div>
                <label htmlFor={fId('filter-search')} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Buscar</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
                  <input id={fId('filter-search')} className="input pl-9" placeholder="Buscar alunos…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-ink-muted">
                <Loader2 className="animate-spin" size={18} /> Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title={statusFilter === 'inactive' ? 'Nenhum aluno inativo' : 'Nenhum aluno encontrado'}
                description={statusFilter === 'inactive'
                  ? 'Alunos removidos aparecem aqui.'
                  : 'Ajuste os filtros ou cadastre o primeiro aluno.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Lista de alunos">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase text-ink-subtle">
                      <th className="px-4 py-3">Aluno</th>
                      <th className="px-4 py-3">Turma / Série</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Matrícula</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => { setSelected(s); setDetailTab('dados'); }}
                        className={`cursor-pointer border-b border-border last:border-0 hover:bg-canvas ${selected?.id === s.id ? 'bg-primary-soft/40' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {s.photo_url ? (
                              <img src={s.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                                {initials(s.name)}
                              </div>
                            )}
                            <span className="truncate font-semibold text-ink">{s.name}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{s.class_name ?? 'Sem turma'}</td>
                        <td className="px-4 py-3 text-ink-muted">{s.guardian_name ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{s.registration_number ?? '—'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                            {s.status === 'active' ? 'Ativo' : 'Inativo'}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg p-2 text-ink-muted hover:bg-primary-soft hover:text-primary"
                              onClick={(e) => { e.stopPropagation(); setSelected(s); setDetailTab('dados'); }}
                              aria-label={`Ver detalhes de ${s.name}`}
                            >
                              <Eye size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="rounded-lg p-2 text-ink-muted hover:bg-canvas hover:text-ink"
                              onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                              aria-label={`Editar ${s.name}`}
                            >
                              <MoreVertical size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-ink-muted">
                <span>Mostrando {filtered.length} de {counts.all} aluno(s).</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== Coluna 40% — Detalhamento ===== */}
        <div className="space-y-4">
          {!selected ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center text-ink-muted">
              <GraduationCap size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Selecione um aluno na lista para ver os detalhes.</p>
            </div>
          ) : (
            <>
              {/* Cabeçalho do aluno */}
              <div className="card p-5">
                <div className="flex items-center gap-4">
                  {selected.photo_url ? (
                    <img src={selected.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                      {initials(selected.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-bold text-ink">{selected.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>Mat. <strong className="text-ink">{selected.registration_number}</strong></span>
                      <span>{formatDate(selected.birth_date)}</span>
                      {selected.blood_type && <span>Sangue: <strong className="text-ink">{selected.blood_type}</strong></span>}
                      <span>{selected.class_name ?? 'Sem turma'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge tone={selected.status === 'active' ? 'success' : 'neutral'}>
                      {selected.status === 'active' ? 'Ativo' : 'Inativo'}
                    </StatusBadge>
                    <button className="btn-outline flex items-center gap-1.5 text-xs" onClick={() => setEditing(selected)}>
                      <Pencil size={13} /> Editar
                    </button>
                  </div>
                </div>
              </div>

              {/* Abas */}
              <div className="card overflow-hidden">
                <div className="flex border-b border-border">
                  {DETAIL_TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setDetailTab(t.key)}
                      className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-colors ${detailTab === t.key
                        ? 'border-b-2 border-primary text-primary'
                        : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <t.icon size={14} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* Dados */}
                  {detailTab === 'dados' && (
                    <div className="space-y-3 text-sm">
                      <Row label="Nome completo" value={selected.name} />
                      <SensitiveField label="CPF" maskedValue={selected.cpf}
                        entityType="student" entityId={selected.id} field="cpf" canReveal={canReveal} />
                      <SensitiveField label="RG" maskedValue={selected.rg}
                        entityType="student" entityId={selected.id} field="rg" canReveal={canReveal} />
                      <Row label="Data de nascimento" value={formatDate(selected.birth_date)} />
                      <Row label="Naturalidade" value={selected.naturality} />
                      <Row label="Tipo sanguíneo" value={selected.blood_type} />
                      <Row label="Nome do pai" value={selected.father_name} />
                      <Row label="Nome da mãe" value={selected.mother_name} />
                    </div>
                  )}

                  {/* Responsável */}
                  {detailTab === 'responsavel' && (
                    <div className="space-y-3 text-sm">
                      <Row label="Nome" value={selected.guardian_name} />
                      <SensitiveField label="CPF" maskedValue={selected.guardian_cpf}
                        entityType="guardian" entityId={selected.guardian_id!} field="cpf" canReveal={canReveal} />
                      <SensitiveField label="E-mail" maskedValue={selected.guardian_email}
                        entityType="guardian" entityId={selected.guardian_id!} field="email" canReveal={canReveal} />
                    </div>
                  )}

                  {/* Contatos */}
                  {detailTab === 'contatos' && (
                    <div className="space-y-3 text-sm">
                      <SensitiveField label="Telefone 1" maskedValue={selected.guardian_phone}
                        entityType="guardian" entityId={selected.guardian_id!} field="phone" canReveal={canReveal} />
                      <SensitiveField label="Telefone 2" maskedValue={selected.guardian_phone2}
                        entityType="guardian" entityId={selected.guardian_id!} field="phone2" canReveal={canReveal} />
                      <SensitiveField label="E-mail" maskedValue={selected.guardian_email}
                        entityType="guardian" entityId={selected.guardian_id!} field="email" canReveal={canReveal} />
                    </div>
                  )}

                  {/* Documentos */}
                  {detailTab === 'documentos' && (
                    <div className="space-y-3">
                      <p className="text-xs text-ink-muted mb-3">Gere e imprima documentos do aluno. O cabeçalho incluirá os dados da escola.</p>
                      <button
                        className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-canvas"
                        onClick={() => generatePdf('Comprovante de Matrícula', schoolName, selected)}
                      >
                        <Printer size={18} className="shrink-0 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-ink">Comprovante de Matrícula</p>
                          <p className="text-xs text-ink-muted">Dados completos da matrícula e turma</p>
                        </div>
                      </button>
                      <button
                        className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-canvas"
                        onClick={() => generatePdf('Comprovante de Pagamento', schoolName, selected)}
                      >
                        <Printer size={18} className="shrink-0 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-ink">Comprovante de Pagamento</p>
                          <p className="text-xs text-ink-muted">Dados financeiros e responsável</p>
                        </div>
                      </button>

                      <div className="border-t border-border pt-3">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-subtle">
                          Documentos oficiais (gerados no servidor, com registro de emissão)
                        </p>
                      </div>

                      {docError && (
                        <div role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{docError}</div>
                      )}

                      {([
                        {
                          key: 'decl-matricula', icon: FileBadge, label: 'Declaração de Matrícula',
                          desc: 'Confirma que o aluno está regularmente matriculado',
                          action: () => documentsService.declaration(selected.id, 'matricula', selected.name),
                        },
                        {
                          key: 'decl-conclusao', icon: FileBadge, label: 'Declaração de Conclusão',
                          desc: 'Confirma a conclusão do ano letivo com aproveitamento',
                          action: () => documentsService.declaration(selected.id, 'conclusao', selected.name),
                        },
                        {
                          key: 'transfer', icon: ArrowLeftRight, label: 'Ficha de Transferência',
                          desc: 'Formaliza a transferência para outra instituição, com situação acadêmica',
                          action: () => documentsService.transferForm(selected.id, selected.name),
                        },
                        {
                          key: 'transcript', icon: BookMarked, label: 'Histórico Escolar',
                          desc: 'Notas e situação por turma/ano cursado no sistema',
                          action: () => documentsService.transcript(selected.id, selected.name),
                        },
                      ] as const).map((d) => (
                        <button
                          key={d.key}
                          disabled={issuingDoc === d.key}
                          className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-canvas disabled:opacity-60"
                          onClick={() => issueDocument(d.key, d.action)}
                        >
                          {issuingDoc === d.key
                            ? <Loader2 size={18} className="shrink-0 animate-spin text-primary" />
                            : <d.icon size={18} className="shrink-0 text-primary" />}
                          <div>
                            <p className="text-sm font-medium text-ink">{d.label}</p>
                            <p className="text-xs text-ink-muted">{d.desc}</p>
                          </div>
                        </button>
                      ))}

                      {selected.guardian_id && (
                        <div className="flex items-center gap-2 rounded-xl border border-border p-3">
                          <FileBadge size={18} className="shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">Informe de Rendimentos do responsável</p>
                            <p className="text-xs text-ink-muted">Para declaração de Imposto de Renda — mensalidade e matrícula pagas no ano</p>
                          </div>
                          <select
                            className="input w-20 py-1.5 text-xs"
                            value={irYear}
                            onChange={(e) => setIrYear(Number(e.target.value))}
                            aria-label="Ano do informe"
                          >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 - i).map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                          <button
                            className="btn-outline shrink-0 text-xs"
                            disabled={issuingDoc === 'income-report'}
                            onClick={() => issueDocument('income-report',
                              () => documentsService.incomeReport(irYear, selected.guardian_id))}
                          >
                            {issuingDoc === 'income-report'
                              ? <Loader2 size={13} className="animate-spin" />
                              : <FileText size={13} />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Link de acesso */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-ink">
                  <Link2 size={16} className="text-primary" /> Link de acesso do responsável
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Login (e-mail)" value={selected.guardian_email ?? '—'} />
                  <Row label="Matrícula (alternativa)" value={selected.registration_number ?? '—'} />
                  <Row label="Senha inicial padrão" value={DEFAULT_GUARDIAN_PASSWORD} />
                  <p className="text-xs text-ink-muted mt-2">
                    Todos os responsáveis recebem <b className="font-mono">{DEFAULT_GUARDIAN_PASSWORD}</b> como senha inicial —
                    a troca é obrigatória no 1º acesso. Se o responsável já trocou, essa senha não vale mais.
                  </p>
                </div>
                <button
                  className="mt-3 btn-outline flex items-center gap-1.5 text-xs"
                  onClick={() => {
                    const text =
                      `Aluno: ${selected.name}\n` +
                      `Login (e-mail): ${selected.guardian_email ?? '—'}\n` +
                      `Matrícula (alternativa): ${selected.registration_number}\n` +
                      `Senha inicial: ${DEFAULT_GUARDIAN_PASSWORD}\n` +
                      `(troca obrigatória no 1º acesso)`;
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar dados de acesso'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {editing && (
        <StudentEditModal
          student={editing}
          classes={classes}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setStudents((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
            setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            setEditing(null);
            queryCache.invalidate(CK.students);
            load(true);
          }}
        />
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value || '—'}</span>
    </div>
  );
}
