import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGate } from '@/auth/AuthGate';
import { RoleGuard } from '@/auth/RoleGuard';
import { SaasAdminGuard } from '@/saas/SaasAdminGuard';
import { SaasAdminLayout } from '@/saas/SaasAdminLayout';
import { PageSkeleton } from '@/components/ui/Skeleton';

// Páginas públicas — carregadas imediatamente (sem autenticação, latência zero importa)
import { LandingPage } from '@/pages/LandingPage';
import { TermosPage } from '@/pages/TermosPage';
import { PrivacidadePage } from '@/pages/PrivacidadePage';
import { LoginPage } from '@/pages/LoginPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SaasPlaceholderPage } from '@/saas/pages/SaasPlaceholderPage';

// Helper: React.lazy com named export
function lazyPage<M extends Record<string, React.ComponentType<any>>>(
  factory: () => Promise<M>,
  name: keyof M,
): React.LazyExoticComponent<React.ComponentType<any>> {
  return React.lazy(() => factory().then(m => ({ default: m[name] as React.ComponentType })));
}

// Páginas do /app — lazy-loaded (cada rota vira chunk próprio)
const ChangePasswordPage = lazyPage(() => import('@/pages/ChangePasswordPage'), 'ChangePasswordPage');
const DashboardPage      = lazyPage(() => import('@/pages/DashboardPage'),      'DashboardPage');
const StudentsPage       = lazyPage(() => import('@/pages/StudentsPage'),       'StudentsPage');
const StaffPage          = lazyPage(() => import('@/pages/StaffPage'),          'StaffPage');
const ClassesPage        = lazyPage(() => import('@/pages/ClassesPage'),        'ClassesPage');
const GradesPage         = lazyPage(() => import('@/pages/GradesPage'),         'GradesPage');
const AttendancePage     = lazyPage(() => import('@/pages/AttendancePage'),     'AttendancePage');
const TimeclockPage      = lazyPage(() => import('@/pages/TimeclockPage'),      'TimeclockPage');
const CalendarPage       = lazyPage(() => import('@/pages/CalendarPage'),       'CalendarPage');
const FinancePage        = lazyPage(() => import('@/pages/FinancePage'),        'FinancePage');
const ExpensesPage       = lazyPage(() => import('@/pages/ExpensesPage'),       'ExpensesPage');
const ReceivablesPage    = lazyPage(() => import('@/pages/ReceivablesPage'),    'ReceivablesPage');
const DelinquencyPage    = lazyPage(() => import('@/pages/DelinquencyPage'),    'DelinquencyPage');
const BalancePage        = lazyPage(() => import('@/pages/BalancePage'),        'BalancePage');
const FaturasPage        = lazyPage(() => import('@/pages/FaturasPage'),        'FaturasPage');
const MessagesPage       = lazyPage(() => import('@/pages/MessagesPage'),       'MessagesPage');
const LeaveRequestsPage  = lazyPage(() => import('@/pages/LeaveRequestsPage'),  'LeaveRequestsPage');
const StaffDocumentsPage = lazyPage(() => import('@/pages/StaffDocumentsPage'), 'StaffDocumentsPage');
const LessonPlansPage    = lazyPage(() => import('@/pages/LessonPlansPage'),    'LessonPlansPage');
const LessonPlanFormPage = lazyPage(() => import('@/pages/LessonPlanFormPage'), 'LessonPlanFormPage');
const SettingsPage       = lazyPage(() => import('@/pages/SettingsPage'),       'SettingsPage');
const TicketsPage        = lazyPage(() => import('@/pages/TicketsPage'),        'TicketsPage');
const LgpdPage           = lazyPage(() => import('@/pages/LgpdPage'),           'LgpdPage');

// Páginas do /saas — lazy-loaded
const SaasDashboardPage           = lazyPage(() => import('@/saas/pages/SaasDashboardPage'),           'SaasDashboardPage');
const SaasSchoolsPage             = lazyPage(() => import('@/saas/pages/SaasSchoolsPage'),           'SaasSchoolsPage');
const SaasLeadsPage               = lazyPage(() => import('@/saas/pages/SaasLeadsPage'),             'SaasLeadsPage');
const SaasPlansAndSubscriptionsPage = lazyPage(() => import('@/saas/pages/SaasPlansAndSubscriptionsPage'), 'SaasPlansAndSubscriptionsPage');
const SaasExpirationsPage         = lazyPage(() => import('@/saas/pages/SaasExpirationsPage'),       'SaasExpirationsPage');
const SaasUsersPage         = lazyPage(() => import('@/saas/pages/SaasUsersPage'),         'SaasUsersPage');
const SaasAuditLogsPage     = lazyPage(() => import('@/saas/pages/SaasAuditLogsPage'),     'SaasAuditLogsPage');
const SaasRevenuePage       = lazyPage(() => import('@/saas/pages/SaasRevenuePage'),       'SaasRevenuePage');
const SaasPayoutsPage       = lazyPage(() => import('@/saas/pages/SaasPayoutsPage'),       'SaasPayoutsPage');
const SaasTransactionsPage  = lazyPage(() => import('@/saas/pages/SaasTransactionsPage'),  'SaasTransactionsPage');
const SaasPlansConfigPage   = lazyPage(() => import('@/saas/pages/SaasPlansConfigPage'),   'SaasPlansConfigPage');
const SaasSupportPage       = lazyPage(() => import('@/saas/pages/SaasSupportPage'),       'SaasSupportPage');

const Admin = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'superadmin']}>{children}</RoleGuard>
);
const AdminFinancial = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'financial', 'superadmin']}>{children}</RoleGuard>
);
const AdminTeacherGuardian = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'teacher', 'guardian', 'superadmin']}>{children}</RoleGuard>
);
// Planejamento de aulas: professor preenche, coordenação e direção revisam.
const TeacherCoordination = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['teacher', 'coordinator', 'school_admin', 'superadmin']}>{children}</RoleGuard>
);

export default function App() {
  return (
    <BrowserRouter>
      {/* Suspense único na raiz: exibe PageSkeleton enquanto qualquer chunk lazy carrega */}
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/termos" element={<TermosPage />} />
          <Route path="/privacidade" element={<PrivacidadePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<AuthGate />}>
            {/* Fora do AppLayout — bloqueia app até troca de senha */}
            <Route path="/app/change-password" element={<ChangePasswordPage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="students" element={<Admin><StudentsPage /></Admin>} />
              <Route path="students/new" element={<Admin><StudentsPage /></Admin>} />
              <Route path="staff" element={<Admin><StaffPage /></Admin>} />
              <Route path="classes" element={<Admin><ClassesPage /></Admin>} />
              <Route path="grades" element={<AdminTeacherGuardian><GradesPage /></AdminTeacherGuardian>} />
              <Route path="grades/boletim" element={<AdminTeacherGuardian><GradesPage /></AdminTeacherGuardian>} />
              <Route path="attendance" element={<AdminTeacherGuardian><AttendancePage /></AdminTeacherGuardian>} />
              <Route path="attendance/calendar" element={<AdminTeacherGuardian><AttendancePage /></AdminTeacherGuardian>} />
              <Route path="attendance/approvals" element={<Admin><AttendancePage /></Admin>} />
              <Route path="timeclock" element={<TimeclockPage />} />
              <Route path="calendar" element={<AdminTeacherGuardian><CalendarPage /></AdminTeacherGuardian>} />
              <Route path="lesson-plans" element={<TeacherCoordination><LessonPlansPage /></TeacherCoordination>} />
              {/* "new" antes de ":id" — senão a rota dinâmica captura a palavra. */}
              <Route path="lesson-plans/new" element={<TeacherCoordination><LessonPlanFormPage /></TeacherCoordination>} />
              <Route path="lesson-plans/:id" element={<TeacherCoordination><LessonPlanFormPage /></TeacherCoordination>} />
              <Route path="finance" element={<AdminFinancial><FinancePage /></AdminFinancial>} />
              <Route path="finance/entries" element={<AdminFinancial><FinancePage /></AdminFinancial>} />
              <Route path="finance/expenses" element={<AdminFinancial><ExpensesPage /></AdminFinancial>} />
              <Route path="finance/receivables" element={<AdminFinancial><ReceivablesPage /></AdminFinancial>} />
              <Route path="finance/delinquency" element={<AdminFinancial><DelinquencyPage /></AdminFinancial>} />
              <Route path="finance/balance" element={<AdminFinancial><BalancePage /></AdminFinancial>} />
              <Route path="invoices" element={<AdminFinancial><ReceivablesPage /></AdminFinancial>} />
              <Route path="faturas" element={<FaturasPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="leave-requests" element={<LeaveRequestsPage />} />
              <Route path="documents" element={<StaffDocumentsPage />} />
              <Route path="settings" element={<Admin><SettingsPage /></Admin>} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="lgpd" element={<LgpdPage />} />
              <Route path="*" element={<PlaceholderPage title="Página não encontrada" />} />
            </Route>

            {/* ============ SUPER ADMIN — módulo separado do /app ============ */}
            <Route path="/saas" element={<SaasAdminGuard />}>
              <Route element={<SaasAdminLayout />}>
                <Route index element={<SaasDashboardPage />} />
                <Route path="escolas"          element={<SaasSchoolsPage />} />
                <Route path="leads"            element={<SaasLeadsPage />} />
                <Route path="planos"           element={<SaasPlansAndSubscriptionsPage />} />
                <Route path="vencimentos"      element={<SaasExpirationsPage />} />
                <Route path="usuarios-escolas" element={<SaasUsersPage />} />
                <Route path="logs-acesso"      element={<SaasAuditLogsPage />} />
                <Route path="receitas"         element={<SaasRevenuePage />} />
                <Route path="repasses"         element={<SaasPayoutsPage />} />
                <Route path="transacoes"       element={<SaasTransactionsPage />} />
                <Route path="config/planos"    element={<SaasPlansConfigPage />} />
                <Route path="suporte"          element={<SaasSupportPage />} />
                <Route path="*" element={<SaasPlaceholderPage title="Página não encontrada" />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
