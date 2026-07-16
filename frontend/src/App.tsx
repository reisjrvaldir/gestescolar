import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGate } from '@/auth/AuthGate';
import { RoleGuard } from '@/auth/RoleGuard';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { StaffPage } from '@/pages/StaffPage';
import { ClassesPage } from '@/pages/ClassesPage';
import { GradesPage } from '@/pages/GradesPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { FinancePage } from '@/pages/FinancePage';
import { FaturasPage } from '@/pages/FaturasPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { BalancePage } from '@/pages/BalancePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { LgpdPage } from '@/pages/LgpdPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { TimeclockPage } from '@/pages/TimeclockPage';
import { JourneysPage } from '@/pages/JourneysPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { LeaveRequestsPage } from '@/pages/LeaveRequestsPage';
import { StaffDocumentsPage } from '@/pages/StaffDocumentsPage';
import { ChangePasswordPage } from '@/pages/ChangePasswordPage';
import { LandingPage } from '@/pages/LandingPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SaasAdminGuard } from '@/saas/SaasAdminGuard';
import { SaasAdminLayout } from '@/saas/SaasAdminLayout';
import { SaasDashboardPage } from '@/saas/pages/SaasDashboardPage';
import { SaasPlaceholderPage } from '@/saas/pages/SaasPlaceholderPage';
import { SaasSchoolsPage } from '@/saas/pages/SaasSchoolsPage';
import { SaasRevenuePage } from '@/saas/pages/SaasRevenuePage';
import { SaasPayoutsPage } from '@/saas/pages/SaasPayoutsPage';
import { SaasPlansConfigPage } from '@/saas/pages/SaasPlansConfigPage';
import { SaasAuditLogsPage } from '@/saas/pages/SaasAuditLogsPage';
import { SaasTransactionsPage } from '@/saas/pages/SaasTransactionsPage';
import { SaasSubscriptionsPage } from '@/saas/pages/SaasSubscriptionsPage';
import { SaasExpirationsPage } from '@/saas/pages/SaasExpirationsPage';
import { SaasUsersPage } from '@/saas/pages/SaasUsersPage';
import { SaasSupportPage } from '@/saas/pages/SaasSupportPage';

const Admin = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'superadmin']}>{children}</RoleGuard>
);
const AdminFinancial = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'financial', 'superadmin']}>{children}</RoleGuard>
);
const AdminTeacher = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard allowed={['school_admin', 'teacher', 'superadmin']}>{children}</RoleGuard>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AuthGate />}>
          {/* Página fora do AppLayout — bloqueia acesso ao app até trocar a senha. */}
          <Route path="/app/change-password" element={<ChangePasswordPage />} />
          <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<Admin><StudentsPage /></Admin>} />
          <Route path="students/new" element={<Admin><StudentsPage /></Admin>} />
          <Route path="staff" element={<Admin><StaffPage /></Admin>} />
          <Route path="classes" element={<Admin><ClassesPage /></Admin>} />
          <Route path="grades" element={<AdminTeacher><GradesPage /></AdminTeacher>} />
          <Route path="grades/boletim" element={<AdminTeacher><GradesPage /></AdminTeacher>} />
          <Route path="attendance" element={<AdminTeacher><AttendancePage /></AdminTeacher>} />
          <Route path="timeclock" element={<TimeclockPage />} />
          <Route path="journeys" element={<Admin><JourneysPage /></Admin>} />
          <Route path="calendar" element={<AdminTeacher><CalendarPage /></AdminTeacher>} />
          <Route path="finance" element={<AdminFinancial><FinancePage /></AdminFinancial>} />
          <Route path="finance/entries" element={<AdminFinancial><FinancePage /></AdminFinancial>} />
          <Route path="finance/expenses" element={<AdminFinancial><ExpensesPage /></AdminFinancial>} />
          <Route path="finance/balance" element={<AdminFinancial><BalancePage /></AdminFinancial>} />
          <Route path="invoices" element={<AdminFinancial><FinancePage /></AdminFinancial>} />
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
              <Route path="resumo"           element={<SaasPlaceholderPage title="Resumo executivo" subtitle="Indicadores consolidados da operação SaaS." />} />
              <Route path="escolas"          element={<SaasSchoolsPage />} />
              <Route path="planos"           element={<SaasSubscriptionsPage />} />
              <Route path="vencimentos"      element={<SaasExpirationsPage />} />
              <Route path="status"           element={<SaasPlaceholderPage title="Status das contas" subtitle="Contas ativas, suspensas, canceladas e trials." />} />
              <Route path="admins"           element={<SaasPlaceholderPage title="Administradores do SaaS" subtitle="Time de operação e suporte." />} />
              <Route path="usuarios-escolas" element={<SaasUsersPage />} />
              <Route path="permissoes"       element={<SaasPlaceholderPage title="Perfis e permissões" subtitle="Papéis do time SaaS e permissões granulares." />} />
              <Route path="logs-acesso"      element={<SaasAuditLogsPage />} />
              <Route path="receitas"         element={<SaasRevenuePage />} />
              <Route path="repasses"         element={<SaasPayoutsPage />} />
              <Route path="transacoes"       element={<SaasTransactionsPage />} />
              <Route path="gateway"          element={<SaasPlaceholderPage title="Gateway de pagamento" subtitle="Integração, chaves, webhooks e ambiente." />} />
              <Route path="config/planos"           element={<SaasPlansConfigPage />} />
              <Route path="config/recursos"         element={<SaasPlaceholderPage title="Recursos do sistema" subtitle="Feature flags globais e por escola." />} />
              <Route path="config/personalizacoes"  element={<SaasPlaceholderPage title="Personalizações" subtitle="Branding e textos institucionais." />} />
              <Route path="config/integracoes"      element={<SaasPlaceholderPage title="Integrações" subtitle="Gateway, e-mail, WhatsApp, storage e webhooks." />} />
              <Route path="config/notificacoes"     element={<SaasPlaceholderPage title="Notificações" subtitle="Templates, disparos e avisos globais." />} />
              <Route path="config/seguranca"        element={<SaasPlaceholderPage title="Segurança" subtitle="Políticas de senha, sessão, 2FA e IP allowlist." />} />
              <Route path="suporte"          element={<SaasSupportPage />} />
              <Route path="*" element={<SaasPlaceholderPage title="Página não encontrada" />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
