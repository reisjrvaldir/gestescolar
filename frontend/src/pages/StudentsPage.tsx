import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  GraduationCap, Search, Loader2, Copy, Check, Save, Plus,
  User, Phone, FileText, Link2, Upload, Printer,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { studentsService, type NewStudent, type CreatedStudent } from '@/services/students';
import { classesService } from '@/services/classes';
import { schoolPlansService, type SchoolPlan } from '@/services/schoolPlans';
import { useMe } from '@/auth/AuthGate';
import type { SchoolClass, Student } from '@/types/models';
import { brl } from '@/lib/fees';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

interface FormFields {
  name: string;
  cpf: string;
  rg: string;
  birth_date: string;
  blood_type: string;
  naturality: string;
  father_name: string;
  mother_name: string;
  class_id?: string;
  plan_id: string;
  discount_percentage?: number;
  enrollment_payment_method?: 'cash' | 'pix' | 'card';
  first_due?: '30' | '05' | '10' | '15';
  guardian_name: string;
  guardian_email: string;
  guardian_cpf: string;
  guardian_phone?: string;
  guardian_phone2?: string;
}

type DetailTab = 'dados' | 'responsavel' | 'contatos' | 'documentos';

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
        <tr><td><strong>Mensalidade:</strong></td><td>${student.monthly_fee != null ? 'R$ ' + Number(student.monthly_fee).toFixed(2).replace('.', ',') : '—'}</td></tr>
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
  const isNewRoute = location.pathname.endsWith('/new');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('dados');
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState<CreatedStudent | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, p] = await Promise.all([
        studentsService.list(),
        classesService.list(),
        schoolPlansService.list(),
      ]);
      setStudents(s);
      setClasses(c);
      setPlans(p);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.registration_number ?? '').includes(q),
    );
  }, [students, query]);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormFields>();
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
        name: '', cpf: '', rg: '', birth_date: '', blood_type: '', naturality: '',
        father_name: '', mother_name: '', class_id: '', plan_id: '',
        guardian_name: '', guardian_email: '', guardian_cpf: '', guardian_phone: '', guardian_phone2: '',
      });
    }
  }, [isNewRoute, reset]);

  async function onSubmit(data: FormFields) {
    setSaving(true);
    setError(null);
    try {
      const payload: NewStudent = {
        name: data.name,
        cpf: data.cpf,
        rg: data.rg || undefined,
        birth_date: data.birth_date,
        blood_type: data.blood_type || undefined,
        naturality: data.naturality || undefined,
        father_name: data.father_name,
        mother_name: data.mother_name,
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
      await load();
      navigate('/app/students');
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao cadastrar aluno');
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!credentials) return;
    const text = `Aluno: ${credentials.name}\nLogin (matrícula): ${credentials.registration_number}\nSenha inicial: ${credentials.initial_password ?? '(temporária)'}\nE-mail do responsável: ${credentials.guardian_email}\n(troca de senha obrigatória no 1º acesso)`;
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
        <PageHeader
          title="Cadastrar Aluno"
          subtitle="Preencha os dados para matricular um novo aluno."
        />

        {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}
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
                  <img src={photoPreview} alt="Foto" className="h-24 w-24 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-canvas border-2 border-dashed border-border text-ink-subtle">
                    <Upload size={24} />
                  </div>
                )}
              </div>
              <div>
                <label className="btn-outline inline-flex cursor-pointer items-center gap-1.5 text-sm">
                  <Upload size={14} /> Escolher foto
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setPhotoPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <p className="mt-2 text-xs text-ink-muted">JPG ou PNG, máximo 2MB</p>
              </div>
            </div>
          </div>

          {/* Dados do aluno */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-subtle">Dados do aluno</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label">Nome completo *</label>
                  <input className="input" {...register('name', { required: 'Informe o nome' })} />
                  {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">CPF *</label>
                  <input className="input" placeholder="000.000.000-00" {...register('cpf', { required: 'Informe o CPF' })} />
                  {errors.cpf && <p className="mt-1 text-xs text-danger">{errors.cpf.message}</p>}
                </div>
                <div>
                  <label className="label">RG</label>
                  <input className="input" {...register('rg')} />
                </div>
                <div>
                  <label className="label">Data de nascimento *</label>
                  <input type="date" className="input" {...register('birth_date', { required: 'Informe a data' })} />
                  {errors.birth_date && <p className="mt-1 text-xs text-danger">{errors.birth_date.message}</p>}
                </div>
                <div>
                  <label className="label">Tipo sanguíneo *</label>
                  <select className="input" {...register('blood_type', { required: 'Selecione o tipo sanguíneo' })}>
                    <option value="">Selecione…</option>
                    {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                  {errors.blood_type && <p className="mt-1 text-xs text-danger">{errors.blood_type.message}</p>}
                </div>
                <div>
                  <label className="label">Naturalidade</label>
                  <input className="input" placeholder="Ex.: Salvador - BA" {...register('naturality')} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Nome do pai *</label>
                  <input className="input" {...register('father_name', { required: 'Informe o nome do pai' })} />
                  {errors.father_name && <p className="mt-1 text-xs text-danger">{errors.father_name.message}</p>}
                </div>
                <div>
                  <label className="label">Nome da mãe *</label>
                  <input className="input" {...register('mother_name', { required: 'Informe o nome da mãe' })} />
                  {errors.mother_name && <p className="mt-1 text-xs text-danger">{errors.mother_name.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Turma</label>
                  <select className="input" {...register('class_id')}>
                    <option value="">— Sem turma —</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Plano (mensalidade) *</label>
                  <select className="input" {...register('plan_id', { required: 'Selecione um plano' })} disabled={noPlans}>
                    <option value="">Selecione…</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(Number(p.monthly_fee))}</option>)}
                  </select>
                  {errors.plan_id && <p className="mt-1 text-xs text-danger">{errors.plan_id.message}</p>}
                </div>
              </div>

              {selectedPlan && (
                <div className="rounded-xl border border-border bg-canvas p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-subtle">Cobrança inicial</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Desconto (%)</label>
                      <input type="number" step="0.1" min="0" max="100" className="input" placeholder="0"
                        {...register('discount_percentage', { valueAsNumber: true })} />
                    </div>
                    <div>
                      <label className="label">Matrícula paga em</label>
                      <select className="input" {...register('enrollment_payment_method')} defaultValue="pix">
                        <option value="pix">PIX</option>
                        <option value="card">Cartão</option>
                        <option value="cash">Dinheiro (recebido)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Vencimento</label>
                      <select className="input" {...register('first_due')} defaultValue="30">
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
                  <label className="label">Nome do responsável *</label>
                  <input className="input" {...register('guardian_name', { required: 'Informe o nome' })} />
                  {errors.guardian_name && <p className="mt-1 text-xs text-danger">{errors.guardian_name.message}</p>}
                </div>
                <div>
                  <label className="label">CPF do responsável *</label>
                  <input className="input" placeholder="000.000.000-00" {...register('guardian_cpf', { required: 'Informe o CPF' })} />
                  {errors.guardian_cpf && <p className="mt-1 text-xs text-danger">{errors.guardian_cpf.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" {...register('guardian_email', { required: 'Informe o email' })} />
                  {errors.guardian_email && <p className="mt-1 text-xs text-danger">{errors.guardian_email.message}</p>}
                </div>
                <div>
                  <label className="label">Telefone *</label>
                  <input className="input" placeholder="(00) 00000-0000" {...register('guardian_phone', { required: 'Informe o telefone' })} />
                  {errors.guardian_phone && <p className="mt-1 text-xs text-danger">{errors.guardian_phone.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Telefone 2</label>
                  <input className="input" placeholder="(00) 00000-0000" {...register('guardian_phone2')} />
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
            <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-bold text-ink">Aluno cadastrado com sucesso!</h3>
              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-success-soft p-4 text-success">
                  <p className="font-semibold">Conta do responsável criada.</p>
                  <p className="mt-1 text-xs">Anote ou envie estas credenciais ao responsável.</p>
                </div>
                <div className="space-y-2 rounded-xl border border-border p-4">
                  <div className="flex justify-between"><span className="text-ink-muted">Aluno:</span><span className="font-medium text-ink">{credentials.name}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Login (matrícula):</span><span className="font-mono font-bold text-primary">{credentials.registration_number}</span></div>
                  <div className="flex justify-between"><span className="text-ink-muted">Senha inicial:</span><span className="font-mono font-bold text-ink">{credentials.initial_password ?? '—'}</span></div>
                  {credentials.guardian_email && (
                    <div className="flex justify-between"><span className="text-ink-muted">E-mail:</span><span className="font-medium text-ink">{credentials.guardian_email}</span></div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="btn-outline flex items-center gap-1.5" onClick={copyCredentials}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar dados'}
                </button>
                <button className="btn-primary" onClick={() => setCredentials(null)}>Fechar</button>
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
      <PageHeader
        title="Alunos"
        subtitle="Gerencie os alunos da sua escola."
        actions={
          <button className="btn-primary flex items-center gap-1.5" onClick={() => navigate('/app/students/new')}>
            <Plus size={16} /> Cadastrar Aluno
          </button>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[6fr_4fr]">
        {/* ===== Coluna 60% — Lista ===== */}
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input className="input pl-9" placeholder="Buscar por nome ou matrícula…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <span className="text-sm text-ink-muted">{filtered.length} aluno(s)</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-ink-muted">
                <Loader2 className="animate-spin" size={18} /> Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Nenhum aluno encontrado"
                description="Cadastre o primeiro aluno para começar."
              />
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelected(s); setDetailTab('dados'); }}
                    className={`flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-canvas ${selected?.id === s.id ? 'bg-primary-soft/30' : ''}`}
                  >
                    {s.photo_url ? (
                      <img src={s.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                        {initials(s.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{s.name}</p>
                      <p className="text-xs text-ink-muted">Mat. {s.registration_number}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                        {s.status === 'active' ? 'Ativo' : 'Inativo'}
                      </StatusBadge>
                      <span className="text-[11px] text-ink-subtle">{s.class_name ?? 'Sem turma'}</span>
                    </div>
                  </button>
                ))}
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
                  <StatusBadge tone={selected.status === 'active' ? 'success' : 'neutral'}>
                    {selected.status === 'active' ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
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
                      <Row label="CPF" value={selected.cpf} />
                      <Row label="RG" value={selected.rg} />
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
                      <Row label="CPF" value={selected.guardian_cpf} />
                      <Row label="E-mail" value={selected.guardian_email} />
                    </div>
                  )}

                  {/* Contatos */}
                  {detailTab === 'contatos' && (
                    <div className="space-y-3 text-sm">
                      <Row label="Telefone 1" value={selected.guardian_phone} />
                      <Row label="Telefone 2" value={selected.guardian_phone2} />
                      <Row label="E-mail" value={selected.guardian_email} />
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
                    </div>
                  )}
                </div>
              </div>

              {/* Link de acesso */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3 text-sm font-bold text-ink">
                  <Link2 size={16} className="text-primary" /> Link de acesso
                </div>
                <div className="space-y-2 text-sm">
                  <Row label="Login (matrícula)" value={selected.registration_number} />
                  <Row label="E-mail do responsável" value={selected.guardian_email} />
                  <p className="text-xs text-ink-muted mt-2">Senha temporária foi gerada no cadastro — troca obrigatória no 1º acesso.</p>
                </div>
                <button
                  className="mt-3 btn-outline flex items-center gap-1.5 text-xs"
                  onClick={() => {
                    const text = `Login (matrícula): ${selected.registration_number}\nE-mail: ${selected.guardian_email}\n(troca de senha obrigatória no 1º acesso)`;
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
