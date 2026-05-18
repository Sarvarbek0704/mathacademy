import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { RouteFallback } from '@/components/shared/PageSkeleton';

// ─── Layouts & Auth pages (NOT lazy — needed immediately) ────────────────────
import { StaffLayout } from './components/layout/StaffLayout';
import { GuardianLayout } from './components/layout/GuardianLayout';
import StaffLogin from './pages/staff/StaffLogin';
import GuardianLogin from './pages/guardian/GuardianLogin';
import NotFound from './pages/NotFound';

// ─── Staff pages (lazy loaded) ───────────────────────────────────────────────
const StaffDashboard        = lazy(() => import('./pages/staff/StaffDashboard'));
const StudentsPage          = lazy(() => import('./pages/staff/StudentsPage'));
const StudentDetailPage     = lazy(() => import('./pages/staff/StudentDetailPage'));
const UsersPage             = lazy(() => import('./pages/staff/UsersPage'));
const AcademicYearsPage     = lazy(() => import('./pages/staff/AcademicYearsPage'));
const GroupsPage            = lazy(() => import('./pages/staff/GroupsPage'));
const AssessmentsPage       = lazy(() => import('./pages/staff/AssessmentsPage'));
const AttendancePage        = lazy(() => import('./pages/staff/AttendancePage'));
const RankingPage           = lazy(() => import('./pages/staff/RankingPage'));
const RiskPage              = lazy(() => import('./pages/staff/RiskPage'));
const ViolationsPage        = lazy(() => import('./pages/staff/ViolationsPage'));
const DisciplineActionsPage = lazy(() => import('./pages/staff/DisciplineActionsPage'));
const LeavesPage            = lazy(() => import('./pages/staff/LeavesPage'));
const PaymentsPage          = lazy(() => import('./pages/staff/PaymentsPage'));
const InvoicesPage          = lazy(() => import('./pages/staff/InvoicesPage'));
const RolesPage             = lazy(() => import('./pages/staff/RolesPage'));
const TimetablePage         = lazy(() => import('./pages/staff/TimetablePage'));
const StaffAnnouncementsPage = lazy(() => import('./pages/staff/StaffAnnouncementsPage'));
const AwardsPage            = lazy(() => import('./pages/staff/AwardsPage'));
const BillingPage           = lazy(() => import('./pages/staff/BillingPage'));
const MealBillingPage       = lazy(() => import('./pages/staff/MealBillingPage'));
const DormBillingPage       = lazy(() => import('./pages/staff/DormBillingPage'));
const DisplaysPage          = lazy(() => import('./pages/staff/DisplaysPage'));
const CertificatesPage      = lazy(() => import('./pages/staff/CertificatesPage'));
const CompetitionsPage      = lazy(() => import('./pages/staff/CompetitionsPage'));
const TracksPage            = lazy(() => import('./pages/staff/TracksPage'));
const CohortsPage           = lazy(() => import('./pages/staff/CohortsPage'));
const SubjectsPage          = lazy(() => import('./pages/staff/SubjectsPage'));
const CampusesPage          = lazy(() => import('./pages/staff/CampusesPage'));
const NotificationsPage     = lazy(() => import('./pages/staff/NotificationsPage'));
const ReportsPage           = lazy(() => import('./pages/staff/ReportsPage'));
const EventsPage            = lazy(() => import('./pages/staff/EventsPage'));
const DormsPage             = lazy(() => import('./pages/staff/DormsPage'));
const MediaCenterPage       = lazy(() => import('./pages/staff/MediaCenterPage'));

// ─── Guardian pages (lazy loaded) ────────────────────────────────────────────
const GuardianDashboard     = lazy(() => import('./pages/guardian/GuardianDashboard'));
const GuardianStudent       = lazy(() => import('./pages/guardian/GuardianStudent'));
const GuardianGrades        = lazy(() => import('./pages/guardian/GuardianGrades'));
const GuardianAttendance    = lazy(() => import('./pages/guardian/GuardianAttendance'));
const GuardianDiscipline    = lazy(() => import('./pages/guardian/GuardianDiscipline'));
const GuardianBilling       = lazy(() => import('./pages/guardian/GuardianBilling'));
const GuardianEvents        = lazy(() => import('./pages/guardian/GuardianEvents'));
const GuardianNotifications = lazy(() => import('./pages/guardian/GuardianNotifications'));
const GuardianCertificates  = lazy(() => import('./pages/guardian/GuardianCertificates'));
const GuardianTimetable     = lazy(() => import('./pages/guardian/GuardianTimetable'));
const GuardianAnnouncements = lazy(() => import('./pages/guardian/GuardianAnnouncements'));

// ─── Query client ─────────────────────────────────────────────────────────────
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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/staff/login" replace />} />
                <Route path="/staff/login" element={<StaffLogin />} />
                <Route path="/guardian/login" element={<GuardianLogin />} />

                <Route path="/staff" element={<StaffLayout />}>
                  <Route path="dashboard"         element={<StaffDashboard />} />
                  <Route path="students"          element={<StudentsPage />} />
                  <Route path="students/:id"      element={<StudentDetailPage />} />
                  <Route path="users"             element={<UsersPage />} />
                  <Route path="academic-years"    element={<AcademicYearsPage />} />
                  <Route path="groups"            element={<GroupsPage />} />
                  <Route path="assessments"       element={<AssessmentsPage />} />
                  <Route path="attendance"        element={<AttendancePage />} />
                  <Route path="ranking"           element={<RankingPage />} />
                  <Route path="risk"              element={<RiskPage />} />
                  <Route path="violations"        element={<ViolationsPage />} />
                  <Route path="discipline-actions" element={<DisciplineActionsPage />} />
                  <Route path="leaves"            element={<LeavesPage />} />
                  <Route path="payments"          element={<PaymentsPage />} />
                  <Route path="invoices"          element={<InvoicesPage />} />
                  <Route path="tracks"            element={<TracksPage />} />
                  <Route path="cohorts"           element={<CohortsPage />} />
                  <Route path="subjects"          element={<SubjectsPage />} />
                  <Route path="timetable"         element={<TimetablePage />} />
                  <Route path="events"            element={<EventsPage />} />
                  <Route path="competitions"      element={<CompetitionsPage />} />
                  <Route path="awards"            element={<AwardsPage />} />
                  <Route path="certificates"      element={<CertificatesPage />} />
                  <Route path="roles"             element={<RolesPage />} />
                  <Route path="announcements"     element={<StaffAnnouncementsPage />} />
                  <Route path="notifications"     element={<NotificationsPage />} />
                  <Route path="displays"          element={<DisplaysPage />} />
                  <Route path="dorms"             element={<DormsPage />} />
                  <Route path="campuses"          element={<CampusesPage />} />
                  <Route path="billing"           element={<BillingPage />} />
                  <Route path="meal-billing"      element={<MealBillingPage />} />
                  <Route path="dorm-billing"      element={<DormBillingPage />} />
                  <Route path="reports"           element={<ReportsPage />} />
                  <Route path="files"             element={<MediaCenterPage />} />
                </Route>

                <Route path="/guardian" element={<GuardianLayout />}>
                  <Route path="dashboard"      element={<GuardianDashboard />} />
                  <Route path="student"        element={<GuardianStudent />} />
                  <Route path="grades"         element={<GuardianGrades />} />
                  <Route path="attendance"     element={<GuardianAttendance />} />
                  <Route path="discipline"     element={<GuardianDiscipline />} />
                  <Route path="billing"        element={<GuardianBilling />} />
                  <Route path="events"         element={<GuardianEvents />} />
                  <Route path="notifications"  element={<GuardianNotifications />} />
                  <Route path="certificates"   element={<GuardianCertificates />} />
                  <Route path="timetable"      element={<GuardianTimetable />} />
                  <Route path="announcements"  element={<GuardianAnnouncements />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
