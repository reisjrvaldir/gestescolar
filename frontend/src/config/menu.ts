import {
  LayoutDashboard, GraduationCap, Users, School2, Star, ClipboardCheck,
  Fingerprint, CalendarDays, CreditCard,
  Headset, Crown, Mail, HelpCircle,
  CalendarOff, FolderOpen, PiggyBank, ArrowUpRight, Wallet,
  FileText, ArrowDownRight, AlertTriangle, ShieldCheck, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@shared/moduleCatalog';

// `coordinator` já existia no backend e no cadastro de funcionários, mas faltava
// aqui — o menu resolve `MENUS[role] ?? []`, então a coordenação via a barra
// lateral vazia. Incluído junto com o planejamento de aulas, que é o fluxo em
// que a coordenação é a aprovadora.
export type Role = 'superadmin' | 'school_admin' | 'financial' | 'teacher' | 'guardian' | 'coordinator';

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Módulo do catálogo — se desativado nas Configurações, o item some do menu.
   *  Itens core (Dashboard, Alunos, Turmas, Financeiro básico, Faturas,
   *  Configurações, Ajuda) NÃO devem ter moduleKey. */
  moduleKey?: ModuleKey;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

const TICKETS: MenuItem = { to: '/app/tickets', label: 'Chamados', icon: Headset, moduleKey: 'tickets' };
const HELP: MenuItem = { to: '/app/ajuda', label: 'Central de Ajuda', icon: HelpCircle };

export const MENUS: Record<Role, MenuSection[]> = {
  school_admin: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Gestão',
      items: [
        { to: '/app/students', label: 'Alunos', icon: GraduationCap },
        { to: '/app/staff', label: 'Funcionários', icon: Users },
        { to: '/app/classes', label: 'Turmas', icon: School2 },
      ],
    },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/calendar', label: 'Ano Letivo', icon: CalendarDays, moduleKey: 'calendar' },
        { to: '/app/lesson-plans', label: 'Planejamento', icon: BookOpen, moduleKey: 'lesson_plans' },
        { to: '/app/grades', label: 'Lançar Notas', icon: Star, moduleKey: 'grades' },
        { to: '/app/grades/boletim', label: 'Boletim', icon: FileText, moduleKey: 'grades' },
        { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck, moduleKey: 'attendance' },
        { to: '/app/attendance/approvals', label: 'Atestados', icon: ShieldCheck, moduleKey: 'attendance' },
      ],
    },
    {
      title: 'Recursos Humanos',
      items: [
        { to: '/app/timeclock', label: 'Ponto', icon: Fingerprint, moduleKey: 'timeclock' },
        { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff, moduleKey: 'leave_requests' },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { to: '/app/finance', label: 'Financeiro', icon: Wallet },
        { to: '/app/finance/expenses', label: 'Contas a Pagar', icon: CreditCard },
        { to: '/app/finance/receivables', label: 'A Receber', icon: ArrowDownRight },
        { to: '/app/finance/delinquency', label: 'Inadimplência', icon: AlertTriangle, moduleKey: 'delinquency' },
      ],
    },
    {
      items: [
        { to: '/app/messages', label: 'Mensagens', icon: Mail, moduleKey: 'messages' },
        HELP,
        TICKETS,
      ],
    },
  ],
  financial: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Financeiro',
      items: [
        { to: '/app/finance/entries', label: 'Entradas', icon: ArrowUpRight },
        { to: '/app/finance/expenses', label: 'Contas a Pagar', icon: CreditCard },
        { to: '/app/finance/balance', label: 'Saldo / Resgate', icon: PiggyBank },
      ],
    },
    { items: [HELP, TICKETS] },
  ],
  teacher: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/lesson-plans', label: 'Planejamento', icon: BookOpen, moduleKey: 'lesson_plans' },
        { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck, moduleKey: 'attendance' },
        { to: '/app/grades', label: 'Lançar Notas', icon: Star, moduleKey: 'grades' },
        { to: '/app/grades/boletim', label: 'Boletim', icon: FileText, moduleKey: 'grades' },
        { to: '/app/calendar', label: 'Calendário', icon: CalendarDays, moduleKey: 'calendar' },
      ],
    },
    {
      title: 'Minha Área',
      items: [
        { to: '/app/timeclock', label: 'Meu Ponto', icon: Fingerprint, moduleKey: 'timeclock' },
        { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff, moduleKey: 'leave_requests' },
        { to: '/app/documents', label: 'Meus Documentos', icon: FolderOpen, moduleKey: 'staff_docs' },
      ],
    },
    { items: [{ to: '/app/messages', label: 'Mensagens', icon: Mail, moduleKey: 'messages' }, HELP] },
  ],
  coordinator: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/lesson-plans', label: 'Planejamento', icon: BookOpen, moduleKey: 'lesson_plans' },
        { to: '/app/calendar', label: 'Ano Letivo', icon: CalendarDays, moduleKey: 'calendar' },
        { to: '/app/grades/boletim', label: 'Boletim', icon: FileText, moduleKey: 'grades' },
        { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck, moduleKey: 'attendance' },
      ],
    },
    {
      title: 'Minha Área',
      items: [
        { to: '/app/timeclock', label: 'Meu Ponto', icon: Fingerprint, moduleKey: 'timeclock' },
        { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff, moduleKey: 'leave_requests' },
        { to: '/app/documents', label: 'Meus Documentos', icon: FolderOpen, moduleKey: 'staff_docs' },
      ],
    },
    { items: [{ to: '/app/messages', label: 'Mensagens', icon: Mail, moduleKey: 'messages' }, HELP, TICKETS] },
  ],
  guardian: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/attendance', label: 'Presenças', icon: ClipboardCheck, moduleKey: 'attendance' },
        { to: '/app/grades', label: 'Boletim', icon: Star, moduleKey: 'grades' },
        { to: '/app/calendar', label: 'Agenda', icon: CalendarDays, moduleKey: 'calendar' },
      ],
    },
    {
      title: 'Financeiro',
      items: [
        { to: '/app/faturas', label: 'Faturas', icon: Wallet },
        { to: '/app/pagamento-recorrente', label: 'Pagamento recorrente', icon: CreditCard },
      ],
    },
    { items: [{ to: '/app/messages', label: 'Mensagens', icon: Mail, moduleKey: 'messages' }, TICKETS] },
  ],
  superadmin: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'SaaS',
      items: [
        { to: '/saas', label: 'Painel Super Admin', icon: Crown },
      ],
    },
    { items: [TICKETS] },
  ],
};
