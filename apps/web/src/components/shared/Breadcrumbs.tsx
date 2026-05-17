import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Map path segments to human-readable names
  const routeMap: Record<string, string> = {
    staff: 'Admin',
    dashboard: 'Dashboard',
    students: "O'quvchilar",
    groups: 'Guruhlar',
    'academic-years': "O'quv yillari",
    sections: 'Bo\'limlar',
    tracks: "Yo'nalishlar",
    cohorts: 'Kohortalar',
    subjects: 'Fanlar',
    timetable: 'Dars jadvali',
    attendance: 'Davomat',
    leaves: "Ta'til so'rovlari",
    assessments: 'Testlar',
    ranking: 'Reyting',
    risk: 'Risk bahosi',
    violations: 'Qoidabuzarliklar',
    'discipline-actions': 'Jazolar',
    payments: "To'lovlar",
    invoices: 'Hisob-fakturalar',
    'meal-billing': 'Ovqat billing',
    'dorm-billing': 'Yotoqxona billing',
    events: 'Tadbirlar',
    competitions: 'Musobaqalar',
    awards: 'Mukofotlar',
    certificates: 'Sertifikatlar',
    users: 'Foydalanuvchilar',
    roles: 'Rollar',
    announcements: "E'lonlar",
    notifications: 'Bildirishnomalar',
    displays: 'Monitorlar',
    dorms: 'Yotoqxonalar',
    campuses: 'Kampuslar',
    files: 'Fayllar',
    reports: 'Hisobotlar',
    'media-center': 'Media markazi',
    guardian: 'Ota-ona',
    student: "O'quvchi profili",
    grades: 'Baholar',
    billing: "To'lovlar",
    discipline: 'Intizom',
  };

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1 md:space-x-2">
        <li className="inline-flex items-center">
          <Link
            to="/staff/dashboard"
            className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Home className="h-3.5 w-3.5 mr-1.5" />
            Bosh sahifa
          </Link>
        </li>
        {pathnames.slice(1).map((value, index) => {
          const last = index === pathnames.length - 2;
          const to = `/${pathnames.slice(0, index + 2).join('/')}`;
          const label = routeMap[value] || value.charAt(0).toUpperCase() + value.slice(1);

          return (
            <li key={to}>
              <div className="flex items-center">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mx-1" />
                {last ? (
                  <span className="text-xs font-semibold text-foreground">
                    {label}
                  </span>
                ) : (
                  <Link
                    to={to}
                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    {label}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
