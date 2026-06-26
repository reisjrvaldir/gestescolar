import {
  LayoutDashboard, GraduationCap, Users, School2, Star, ClipboardCheck,
  Fingerprint, CalendarClock, CalendarDays, Wallet, ArrowUpRight, CreditCard,
  PiggyBank, Settings, Headset, ShieldCheck, Crown, Tag, Mail,
  CalendarOff, FolderOpen,
  type LucideIcon,
} from 'lucide-react';

export type Role = 'superadmin' | 'school_admin' | 'financial' | 'teacher' | 'guardian';

export interface MenuItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const LGPD: MenuItem = { to: '/app/lgpd', label: 'Meus Dados (LGPD)', icon: ShieldCheck };
const TICKETS: MenuItem = { to: '/app/tickets', label: 'Chamados', icon: Headset };

export const MENUS: Record<Role, MenuItem[]> = {
  school_admin: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/students', label: 'Alunos', icon: GraduationCap },
    { to: '/app/staff', label: 'Funcionários', icon: Users },
    { to: '/app/classes', label: 'Turmas', icon: School2 },
    { to: '/app/grades', label: 'Avaliações', icon: Star },
    { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck },
    { to: '/app/messages', label: 'Mensagens', icon: Mail },
    { to: '/app/timeclock', label: 'Ponto', icon: Fingerprint },
    { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff },
    { to: '/app/journeys', label: 'Jornadas', icon: CalendarClock },
    { to: '/app/calendar', label: 'Ano Letivo', icon: CalendarDays },
    { to: '/app/finance', label: 'Financeiro', icon: Wallet },
    { to: '/app/settings', label: 'Configurações', icon: Settings },
    TICKETS, LGPD,
  ],
  financial: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/finance/entries', label: 'Entradas', icon: ArrowUpRight },
    { to: '/app/finance/expenses', label: 'Contas a Pagar', icon: CreditCard },
    { to: '/app/finance/balance', label: 'Saldo / Resgate', icon: PiggyBank },
    TICKETS, LGPD,
  ],
  teacher: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/app/attendance', label: 'Chamada', icon: ClipboardCheck },
    { to: '/app/grades', label: 'Avaliações', icon: Star },
    { to: '/app/calendar', label: 'Calendário', icon: CalendarDays },
    { to: '/app/messages', label: 'Mensagens', icon: Mail },
    { to: '/app/timeclock', label: 'Meu Ponto', icon: Fingerprint },
    { to: '/app/leave-requests', label: 'Folgas e Férias', icon: CalendarOff },
    { to: '/app/documents', label: 'Meus Documentos', icon: FolderOpen },
    LGPD,
  ],
  guardian: [
    { to: '/app', label: 'Início', icon: LayoutDashboard },
    { to: '/app/attendance', label: 'Presenças', icon: ClipboardCheck },
    { to: '/app/grades', label: 'Boletim', icon: Star },
    { to: '/app/calendar', label: 'Calendário', icon: CalendarDays },
    { to: '/app/messages', label: 'Mensagens', icon: Mail },
    TICKETS, LGPD,
  ],
  superadmin: [
    { to: '/app', label: 'Dashboard', icon: Crown },
    { to: '/app/schools', label: 'Escolas', icon: School2 },
    { to: '/app/students', label: 'Alunos Global', icon: GraduationCap },
    { to: '/app/users', label: 'Usuários', icon: Users },
    { to: '/app/saas-payments', label: 'Pagamentos SaaS', icon: CreditCard },
    { to: '/app/email-config', label: 'Config. E-mail', icon: Mail },
    { to: '/app/coupons', label: 'Cupons', icon: Tag },
    TICKETS,
    { to: '/app/profile', label: 'Meu Perfil', icon: Settings },
  ],
};
