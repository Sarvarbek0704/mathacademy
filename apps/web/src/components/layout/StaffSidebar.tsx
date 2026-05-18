import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, type StaffUser } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, ClipboardList,
  Trophy, DollarSign, Bell, Monitor, Shield, Building2, ChevronDown, ChevronRight,
  LogOut, Sun, Moon, PanelLeftClose, PanelLeft, BarChart3, AlertTriangle,
  UserCheck, FileText, Award, Flag, Clock, Home, Layers, Route, UsersRound,
  BookMarked, Scale, Receipt, Utensils, BedDouble, Megaphone, FolderOpen,
  ScrollText, Settings, X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AppLogoIcon } from '@/components/shared/AppLogo';

interface NavItem {
  label: string;
  icon: any;
  path?: string;
  permission?: string;
  children?: { label: string; path: string; icon: any; permission?: string }[];
}

const navGroups: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/staff/dashboard' },
  {
    label: 'Akademik', icon: BookOpen,
    children: [
      { label: "O'quv yillari", path: '/staff/academic-years', icon: Calendar, permission: 'academic_years.read' },
      { label: 'Guruhlar', path: '/staff/groups', icon: UsersRound, permission: 'groups.read' },
      { label: "Yo'nalishlar", path: '/staff/tracks', icon: Route, permission: 'tracks.read' },
      { label: 'Kohortalar', path: '/staff/cohorts', icon: Layers, permission: 'cohorts.read' },
      { label: 'Fanlar', path: '/staff/subjects', icon: BookMarked, permission: 'subjects.read' },
      { label: 'Dars jadvali', path: '/staff/timetable', icon: Clock, permission: 'timetable.read' },
    ],
  },
  {
    label: "O'quvchilar", icon: GraduationCap,
    children: [
      { label: "Barcha o'quvchilar", path: '/staff/students', icon: GraduationCap, permission: 'students.read' },
      { label: 'Davomat', path: '/staff/attendance', icon: UserCheck, permission: 'attendance.read' },
      { label: "Ta'til so'rovlari", path: '/staff/leaves', icon: FileText, permission: 'leaves.read' },
    ],
  },
  {
    label: 'Baholash', icon: ClipboardList,
    children: [
      { label: 'Testlar', path: '/staff/assessments', icon: ClipboardList, permission: 'assessments.read' },
      { label: 'Reyting', path: '/staff/ranking', icon: BarChart3, permission: 'ranking.read' },
      { label: 'Risk bahosi', path: '/staff/risk', icon: AlertTriangle, permission: 'risk.read' },
    ],
  },
  {
    label: 'Intizom', icon: Shield,
    children: [
      { label: 'Qoidabuzarliklar', path: '/staff/violations', icon: Flag, permission: 'discipline.read' },
      { label: 'Jazolar', path: '/staff/discipline-actions', icon: Scale, permission: 'discipline.read' },
    ],
  },
  {
    label: 'Moliya', icon: DollarSign,
    children: [
      { label: 'Billing', path: '/staff/billing', icon: DollarSign, permission: 'billing.read' },
      { label: "To'lovlar", path: '/staff/payments', icon: Receipt, permission: 'billing.read' },
      { label: 'Hisob-fakturalar', path: '/staff/invoices', icon: FileText, permission: 'billing.read' },
      { label: 'Ovqat billing', path: '/staff/meal-billing', icon: Utensils, permission: 'billing.read' },
      { label: 'Yotoqxona billing', path: '/staff/dorm-billing', icon: BedDouble, permission: 'billing.read' },
    ],
  },
  {
    label: 'Tadbirlar', icon: Trophy,
    children: [
      { label: 'Tadbirlar', path: '/staff/events', icon: Trophy, permission: 'events.read' },
      { label: 'Musobaqalar', path: '/staff/competitions', icon: Award, permission: 'competitions.read' },
      { label: 'Mukofotlar', path: '/staff/awards', icon: Award, permission: 'awards.read' },
      { label: 'Sertifikatlar', path: '/staff/certificates', icon: ScrollText, permission: 'certificates.read' },
    ],
  },
  { label: 'Hisobotlar', icon: BarChart3, path: '/staff/reports' },
  {
    label: 'Tizim', icon: Settings,
    children: [
      { label: 'Foydalanuvchilar', path: '/staff/users', icon: Users, permission: 'users.view' },
      { label: 'Rollar', path: '/staff/roles', icon: Shield, permission: 'roles.view' },
      { label: "E'lonlar", path: '/staff/announcements', icon: Megaphone, permission: 'announcements.read' },
      { label: 'Bildirishnomalar', path: '/staff/notifications', icon: Bell, permission: 'notifications.read' },
      { label: 'Monitorlar', path: '/staff/displays', icon: Monitor, permission: 'displays.read' },
      { label: 'Yotoqxonalar', path: '/staff/dorms', icon: Home, permission: 'dorms.read' },
      { label: 'Kampuslar', path: '/staff/campuses', icon: Building2, permission: 'campuses.read' },
      { label: 'Fayllar', path: '/staff/files', icon: FolderOpen, permission: 'files.read' },
    ],
  },
];

interface StaffSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function StaffSidebar({ mobileOpen, onMobileClose }: StaffSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const active = navGroups.find(item =>
      item.children?.some(c => location.pathname.startsWith(c.path))
    );
    return active ? [active.label] : [];
  });
  const [logoutOpen, setLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const staffUser = user as StaffUser | null;
  const userPermissions = staffUser?.permissions || [];

  const hasPermission = (perm?: string) => {
    if (!perm) return true;
    return userPermissions.includes(perm) || userPermissions.includes('admin');
  };

  const filteredNavGroups = navGroups.map(item => {
    const filteredChildren = item.children?.filter(child => hasPermission(child.permission));
    if (item.path && !hasPermission(item.permission)) return null;
    if (item.children && filteredChildren?.length === 0) return null;
    return { ...item, children: filteredChildren };
  }).filter(Boolean) as NavItem[];

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => prev.includes(label) ? [] : [label]);
  };

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (children?: { path: string }[]) =>
    children?.some(c => location.pathname.startsWith(c.path));

  const handleLogout = async () => {
    await logout();
    navigate('/staff/login');
  };

  const handleNavClick = () => {
    if (mobileOpen) onMobileClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
        // Mobile: fixed overlay; Desktop: relative in flex flow
        "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
        // Mobile slide behavior; Desktop always visible
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
        // Width: mobile always 260px; desktop respects collapsed state
        "w-[260px]",
        collapsed && "lg:w-[68px]",
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <Link
            to="/staff/dashboard"
            onClick={handleNavClick}
            className={cn("flex items-center gap-2.5", collapsed && "lg:hidden")}
          >
            <AppLogoIcon size={32} className="shrink-0" />
            <div className="leading-tight">
              <span className="font-extrabold text-sm tracking-tight">Math</span>
              <span className="font-extrabold text-sm tracking-tight text-indigo-400">Academy</span>
            </div>
          </Link>
          {/* Collapsed desktop: just icon */}
          <Link
            to="/staff/dashboard"
            onClick={handleNavClick}
            className={cn("hidden", collapsed && "lg:flex")}
          >
            <AppLogoIcon size={32} />
          </Link>

          {/* Desktop: collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>

          {/* Mobile: close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {filteredNavGroups.map(item => {
            if (item.path) {
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={handleNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
                </Link>
              );
            }

            const groupOpen = openGroups.includes(item.label);
            const groupActive = isGroupActive(item.children);

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full",
                    groupActive
                      ? "text-sidebar-primary bg-sidebar-accent"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left truncate", collapsed && "lg:hidden")}>
                    {item.label}
                  </span>
                  <span className={cn(collapsed && "lg:hidden")}>
                    {groupOpen
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />
                    }
                  </span>
                </button>

                {groupOpen && item.children && (
                  <div className={cn(
                    "ml-4 pl-3 border-l border-sidebar-border space-y-0.5 mt-0.5 mb-1",
                    collapsed && "lg:hidden",
                  )}>
                    {item.children.map(child => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                          isActive(child.path)
                            ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <child.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
            title={theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
            <span className={cn(collapsed && "lg:hidden")}>
              {theme === 'dark' ? 'Kunduzgi rejim' : 'Tungi rejim'}
            </span>
          </button>

          <div className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2",
            collapsed && "lg:justify-center",
          )}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                {staffUser?.fullName?.charAt(0) || staffUser?.username?.charAt(0) || 'S'}
              </AvatarFallback>
            </Avatar>
            <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
              <p className="text-sm font-medium truncate">{staffUser?.fullName || staffUser?.username}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{staffUser?.roles?.join(', ')}</p>
            </div>
            <button
              onClick={() => setLogoutOpen(true)}
              className="text-sidebar-foreground/60 hover:text-destructive transition-colors shrink-0"
              title="Chiqish"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Tizimdan chiqish"
        description="Haqiqatan ham tizimdan chiqmoqchimisiz?"
        confirmText="Chiqish"
        variant="destructive"
        onConfirm={handleLogout}
      />
    </>
  );
}
