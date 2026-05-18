import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { useAuth, type GuardianUser } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, GraduationCap, ClipboardList, UserCheck, Shield,
  Receipt, Trophy, Bell, ScrollText, LogOut, Sun, Moon, PanelLeftClose, PanelLeft, Loader2,
  CalendarDays, Megaphone, Menu, X,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AppLogoIcon } from '@/components/shared/AppLogo';

const navItems = [
  { label: 'Dashboard', shortLabel: 'Bosh', icon: LayoutDashboard, path: '/guardian/dashboard' },
  { label: "O'quvchi profili", shortLabel: 'Profil', icon: GraduationCap, path: '/guardian/student' },
  { label: 'Dars jadvali', shortLabel: 'Jadval', icon: CalendarDays, path: '/guardian/timetable' },
  { label: 'Baholar', shortLabel: 'Baholar', icon: ClipboardList, path: '/guardian/grades' },
  { label: 'Davomat', shortLabel: 'Davomat', icon: UserCheck, path: '/guardian/attendance' },
  { label: "E'lonlar", shortLabel: "E'lonlar", icon: Megaphone, path: '/guardian/announcements' },
  { label: 'Intizom', shortLabel: 'Intizom', icon: Shield, path: '/guardian/discipline' },
  { label: "To'lovlar", shortLabel: "To'lov", icon: Receipt, path: '/guardian/billing' },
  { label: 'Tadbirlar', shortLabel: 'Tadbir', icon: Trophy, path: '/guardian/events' },
  { label: 'Bildirishnomalar', shortLabel: 'Xabar', icon: Bell, path: '/guardian/notifications' },
  { label: 'Sertifikatlar', shortLabel: 'Sertif.', icon: ScrollText, path: '/guardian/certificates' },
];

// First 5 items shown in mobile bottom bar; rest via drawer
const BOTTOM_NAV_ITEMS = navItems.slice(0, 5);

export function GuardianLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.type !== 'GUARDIAN') {
    return <Navigate to="/guardian/login" replace />;
  }

  const guardianUser = user as GuardianUser;

  const handleLogout = async () => {
    await logout();
    navigate('/guardian/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const handleNavClick = () => {
    if (mobileOpen) setMobileOpen(false);
  };

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Mobile drawer backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
          // Mobile: fixed overlay; Desktop: relative
          "fixed inset-y-0 left-0 z-50 lg:relative lg:z-auto",
          // Mobile slide; Desktop always visible
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0",
          // Width
          "w-[240px]",
          collapsed && "lg:w-[68px]",
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <Link
              to="/guardian/dashboard"
              onClick={handleNavClick}
              className={cn("flex items-center gap-2.5", collapsed && "lg:hidden")}
            >
              <AppLogoIcon size={32} className="shrink-0" />
              <div className="leading-tight">
                <span className="font-extrabold text-sm tracking-tight">Math</span>
                <span className="font-extrabold text-sm tracking-tight text-indigo-400">Academy</span>
              </div>
            </Link>
            <Link
              to="/guardian/dashboard"
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

            {/* Mobile: close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {navItems.map(item => (
              <Link
                key={item.path}
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
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-2 space-y-1">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              <span className={cn(collapsed && "lg:hidden")}>
                {theme === 'dark' ? 'Kunduzgi' : 'Tungi'} rejim
              </span>
            </button>

            <div className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2",
              collapsed && "lg:justify-center",
            )}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                  {guardianUser?.studentFullName?.charAt(0) || 'G'}
                </AvatarFallback>
              </Avatar>
              <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
                <p className="text-sm font-medium truncate">{guardianUser?.studentFullName}</p>
                <p className="text-xs text-sidebar-foreground/60">Ota-ona</p>
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background flex flex-col min-w-0">
          {/* Mobile top header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-background lg:hidden shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="h-9 w-9"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2.5">
              <AppLogoIcon size={28} />
              <div className="leading-tight">
                <span className="font-extrabold text-sm tracking-tight">Math</span>
                <span className="font-extrabold text-sm tracking-tight text-indigo-500">Academy</span>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 max-w-[1200px] mx-auto pb-20 lg:pb-6">
              <Outlet />
            </div>
          </div>

          {/* Mobile bottom navigation */}
          <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t lg:hidden">
            <div className="flex items-center justify-around px-2 py-1">
              {BOTTOM_NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0",
                    isActive(item.path)
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5 shrink-0",
                    isActive(item.path) && "text-primary"
                  )} />
                  <span className="text-[10px] font-medium truncate max-w-[56px] text-center leading-tight">
                    {item.shortLabel}
                  </span>
                </Link>
              ))}
              {/* "More" button opens the full drawer */}
              <button
                onClick={() => setMobileOpen(true)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-medium">Ko'proq</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Tizimdan chiqish"
        description="Haqiqatan ham chiqmoqchimisiz?"
        confirmText="Chiqish"
        variant="destructive"
        onConfirm={handleLogout}
      />
    </>
  );
}
