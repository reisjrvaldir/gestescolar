import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthGate } from '@/auth/AuthGate';
import { RoleGuard } from '@/auth/RoleGuard';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
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
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<AuthGate />}>
          {/* Página fora do AppLayout — bloqueia acesso ao app até trocar a senha. */}
          <Route path="/app/change-password" element={<ChangePasswordPage />} />
          <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<Admin><StudentsPage /></Admin>} />
          <Route path="staff" element={<Admin><StaffPage /></Admin>} />
          <Route path="classes" element={<Admin><ClassesPage /></Admin>} />
          <Route path="grades" element={<AdminTeacher><GradesPage /></AdminTeacher>} />
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
              <Route path="escolas"          element={<SaasPlaceholderPage title="Todas as escolas" subtitle="Gerencie todas as escolas cadastradas na plataforma." />} />
              <Route path="planos"           element={<SaasPlaceholderPage title="Planos e assinaturas" subtitle="Controle assinaturas ativas, upgrades, downgrades e cancelamentos." />} />
              <Route path="vencimentos"      element={<SaasPlaceholderPage title="Vencimentos" subtitle="Acompanhamento de vencimentos e ações rápidas." />} />
              <Route path="status"           element={<SaasPlaceholderPage title="Status das contas" subtitle="Contas ativas, suspensas, canceladas e trials." />} />
              <Route path="admins"           element={<SaasPlaceholderPage title="Administradores do SaaS" subtitle="Time de operação e suporte." />} />
              <Route path="usuarios-escolas" element={<SaasPlaceholderPage title="Usuários das escolas" subtitle="Visão consolidada dos usuários administrativos das escolas." />} />
              <Route path="permissoes"       element={<SaasPlaceholderPage title="Perfis e permissões" subtitle="Papéis do time SaaS e permissões granulares." />} />
              <Route path="logs-acesso"      element={<SaasPlaceholderPage title="Logs de acesso" subtitle="Auditoria de logins, ações críticas e eventos." />} />
              <Route path="receitas"         element={<SaasPlaceholderPage title="Receitas do SaaS" subtitle="MRR, ARR, ticket médio, churn e evolução." />} />
              <Route path="repasses"         element={<SaasPlaceholderPage title="Repasses para escolas" subtitle="Splits e valores líquidos por escola." />} />
              <Route path="transacoes"       element={<SaasPlaceholderPage title="Cobranças e transações" subtitle="Todas as cobranças SaaS e transações do gateway." />} />
              <Route path="gateway"          element={<SaasPlaceholderPage title="Gateway de pagamento" subtitle="Integração, chaves, webhooks e ambiente." />} />
              <Route path="config/planos"           element={<SaasPlaceholderPage title="Configuração de planos" subtitle="Cadastro, edição e destaque dos planos SaaS." />} />
              <Route path="config/recursos"         element={<SaasPlaceholderPage title="Recursos do sistema" subtitle="Feature flags globais e por escola." />} />
              <Route path="config/personalizacoes"  element={<SaasPlaceholderPage title="Personalizações" subtitle="Branding e textos institucionais." />} />
              <Route path="config/integracoes"      element={<SaasPlaceholderPage title="Integrações" subtitle="Gateway, e-mail, WhatsApp, storage e webhooks." />} />
              <Route path="config/notificacoes"     element={<SaasPlaceholderPage title="Notificações" subtitle="Templates, disparos e avisos globais." />} />
              <Route path="config/seguranca"        element={<SaasPlaceholderPage title="Segurança" subtitle="Políticas de senha, sessão, 2FA e IP allowlist." />} />
              <Route path="suporte"          element={<SaasPlaceholderPage title="Suporte ao cliente" subtitle="Tickets, contato rápido e observações internas." />} />
              <Route path="*" element={<SaasPlaceholderPage title="Página não encontrada" />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
