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
          <Route path="messages" element={<MessagesPage />} />
          <Route path="leave-requests" element={<LeaveRequestsPage />} />
          <Route path="documents" element={<StaffDocumentsPage />} />
          <Route path="settings" element={<Admin><SettingsPage /></Admin>} />
          <Route path="tickets" element={<TicketsPage />} />
          <Route path="lgpd" element={<LgpdPage />} />
          <Route path="*" element={<PlaceholderPage title="Página não encontrada" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
