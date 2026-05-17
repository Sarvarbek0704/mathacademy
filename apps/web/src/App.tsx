import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';

import StaffLogin from './pages/staff/StaffLogin';
import GuardianLogin from './pages/guardian/GuardianLogin';
import { StaffLayout } from './components/layout/StaffLayout';
import { GuardianLayout } from './components/layout/GuardianLayout';

import StaffDashboard from './pages/staff/StaffDashboard';
import StudentsPage from './pages/staff/StudentsPage';
import StudentDetailPage from './pages/staff/StudentDetailPage';
import UsersPage from './pages/staff/UsersPage';
import AcademicYearsPage from './pages/staff/AcademicYearsPage';
import GroupsPage from './pages/staff/GroupsPage';
import AssessmentsPage from './pages/staff/AssessmentsPage';
import AttendancePage from './pages/staff/AttendancePage';
import RankingPage from './pages/staff/RankingPage';
import RiskPage from './pages/staff/RiskPage';
import ViolationsPage from './pages/staff/ViolationsPage';
import DisciplineActionsPage from './pages/staff/DisciplineActionsPage';
import LeavesPage from './pages/staff/LeavesPage';
import PaymentsPage from './pages/staff/PaymentsPage';
import InvoicesPage from './pages/staff/InvoicesPage';
import RolesPage from './pages/staff/RolesPage';
import TimetablePage from './pages/staff/TimetablePage';
import StaffAnnouncementsPage from './pages/staff/StaffAnnouncementsPage';
import AwardsPage from './pages/staff/AwardsPage';
import MealBillingPage from './pages/staff/MealBillingPage';
import DormBillingPage from './pages/staff/DormBillingPage';
import DisplaysPage from './pages/staff/DisplaysPage';
import CertificatesPage from './pages/staff/CertificatesPage';
import CompetitionsPage from './pages/staff/CompetitionsPage';
import TracksPage from './pages/staff/TracksPage';
import CohortsPage from './pages/staff/CohortsPage';
import SubjectsPage from './pages/staff/SubjectsPage';
import CampusesPage from './pages/staff/CampusesPage';
import NotificationsPage from './pages/staff/NotificationsPage';
import ReportsPage from './pages/staff/ReportsPage';
import EventsPage from './pages/staff/EventsPage';
import DormsPage from './pages/staff/DormsPage';
import MediaCenterPage from './pages/staff/MediaCenterPage';
import GuardianDashboard from './pages/guardian/GuardianDashboard';
import GuardianStudent from './pages/guardian/GuardianStudent';
import GuardianGrades from './pages/guardian/GuardianGrades';
import GuardianAttendance from './pages/guardian/GuardianAttendance';
import GuardianDiscipline from './pages/guardian/GuardianDiscipline';
import GuardianBilling from './pages/guardian/GuardianBilling';
import GuardianEvents from './pages/guardian/GuardianEvents';
import GuardianNotifications from './pages/guardian/GuardianNotifications';
import GuardianCertificates from './pages/guardian/GuardianCertificates';
import GuardianTimetable from './pages/guardian/GuardianTimetable';
import GuardianAnnouncements from './pages/guardian/GuardianAnnouncements';

import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/staff/login" replace />} />
              <Route path="/staff/login" element={<StaffLogin />} />
              <Route path="/guardian/login" element={<GuardianLogin />} />

              <Route path="/staff" element={<StaffLayout />}>
                <Route path="dashboard" element={<StaffDashboard />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="students/:id" element={<StudentDetailPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="academic-years" element={<AcademicYearsPage />} />
                <Route path="groups" element={<GroupsPage />} />
                <Route path="assessments" element={<AssessmentsPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="ranking" element={<RankingPage />} />
                <Route path="risk" element={<RiskPage />} />
                <Route path="violations" element={<ViolationsPage />} />
                <Route path="discipline-actions" element={<DisciplineActionsPage />} />
                <Route path="leaves" element={<LeavesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="tracks" element={<TracksPage />} />
                <Route path="cohorts" element={<CohortsPage />} />
                <Route path="subjects" element={<SubjectsPage />} />
                <Route path="timetable" element={<TimetablePage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="competitions" element={<CompetitionsPage />} />
                <Route path="awards" element={<AwardsPage />} />
                <Route path="certificates" element={<CertificatesPage />} />
                <Route path="roles" element={<RolesPage />} />
                <Route path="announcements" element={<StaffAnnouncementsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="displays" element={<DisplaysPage />} />
                <Route path="dorms" element={<DormsPage />} />
                <Route path="campuses" element={<CampusesPage />} />
                <Route path="meal-billing" element={<MealBillingPage />} />
                <Route path="dorm-billing" element={<DormBillingPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="files" element={<MediaCenterPage />} />
              </Route>

              <Route path="/guardian" element={<GuardianLayout />}>
                <Route path="dashboard" element={<GuardianDashboard />} />
                <Route path="student" element={<GuardianStudent />} />
                <Route path="grades" element={<GuardianGrades />} />
                <Route path="attendance" element={<GuardianAttendance />} />
                <Route path="discipline" element={<GuardianDiscipline />} />
                <Route path="billing" element={<GuardianBilling />} />
                <Route path="events" element={<GuardianEvents />} />
                <Route path="notifications" element={<GuardianNotifications />} />
                <Route path="certificates" element={<GuardianCertificates />} />
                <Route path="timetable" element={<GuardianTimetable />} />
                <Route path="announcements" element={<GuardianAnnouncements />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
