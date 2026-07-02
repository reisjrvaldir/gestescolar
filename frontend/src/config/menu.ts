import {
  LayoutDashboard, GraduationCap, Users, School2, Star, ClipboardCheck,
  Fingerprint, CalendarClock, CalendarDays, CreditCard,
  Headset, Crown, Tag, Mail,
  CalendarOff, FolderOpen, PiggyBank, ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';

export type Role = 'superadmin' | 'school_admin' | 'financial' | 'teacher' | 'guardian';

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface MenuSection {
  title?: string;
  items: MenuItem[];
}

const TICKETS: MenuItem = { to: '/app/tickets', label: 'Chamados', icon: Headset };

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
        { to: '/app/calendar', label: 'Ano Letivo', icon: CalendarDays },
        { to: '/app/grades', label: 'Avaliações', icon: Star },
        { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck },
      ],
    },
    {
      title: 'Recursos Humanos',
      items: [
        { to: '/app/journeys', label: 'Jornadas', icon: CalendarClock },
        { to: '/app/timeclock', label: 'Ponto', icon: Fingerprint },
        { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff },
      ],
    },
    {
      items: [
        { to: '/app/messages', label: 'Mensagens', icon: Mail },
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
    { items: [TICKETS] },
  ],
  teacher: [
    { items: [{ to: '/app', label: 'Dashboard', icon: LayoutDashboard }] },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck },
        { to: '/app/grades', label: 'Avaliações', icon: Star },
        { to: '/app/calendar', label: 'Calendário', icon: CalendarDays },
      ],
    },
    {
      title: 'Minha Área',
      items: [
        { to: '/app/timeclock', label: 'Meu Ponto', icon: Fingerprint },
        { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff },
        { to: '/app/documents', label: 'Meus Documentos', icon: FolderOpen },
      ],
    },
    { items: [{ to: '/app/messages', label: 'Mensagens', icon: Mail }] },
  ],
  guardian: [
    { items: [{ to: '/app', label: 'Início', icon: LayoutDashboard }] },
    {
      title: 'Acadêmico',
      items: [
        { to: '/app/attendance', label: 'Presenças', icon: ClipboardCheck },
        { to: '/app/grades', label: 'Boletim', icon: Star },
        { to: '/app/calendar', label: 'Calendário', icon: CalendarDays },
      ],
    },
    { items: [{ to: '/app/messages', label: 'Mensagens', icon: Mail }, TICKETS] },
  ],
  superadmin: [
    { items: [{ to: '/app', label: 'Dashboard', icon: Crown }] },
    {
      title: 'Gestão',
      items: [
        { to: '/app/schools', label: 'Escolas', icon: School2 },
        { to: '/app/students', label: 'Alunos Global', icon: GraduationCap },
        { to: '/app/users', label: 'Usuários', icon: Users },
      ],
    },
    {
      title: 'SaaS',
      items: [
        { to: '/app/saas-payments', label: 'Pagamentos SaaS', icon: CreditCard },
        { to: '/app/email-config', label: 'Config. E-mail', icon: Mail },
        { to: '/app/coupons', label: 'Cupons', icon: Tag },
      ],
    },
    { items: [TICKETS] },
  ],
};
