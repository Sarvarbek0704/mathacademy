import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { useAuth, type GuardianUser } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, GraduationCap, ClipboardList, UserCheck, Shield,
  Receipt, Trophy, Bell, ScrollText, LogOut, Sun, Moon, PanelLeftClose, PanelLeft, Loader2,
  CalendarDays, Megaphone
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/guardian/dashboard' },
  { label: "O'quvchi profili", icon: GraduationCap, path: '/guardian/student' },
  { label: 'Dars jadvali', icon: CalendarDays, path: '/guardian/timetable' },
  { label: 'Baholar', icon: ClipboardList, path: '/guardian/grades' },
  { label: 'Davomat', icon: UserCheck, path: '/guardian/attendance' },
  { label: 'E\'lonlar', icon: Megaphone, path: '/guardian/announcements' },
  { label: 'Intizom', icon: Shield, path: '/guardian/discipline' },
  { label: "To'lovlar", icon: Receipt, path: '/guardian/billing' },
  { label: 'Tadbirlar', icon: Trophy, path: '/guardian/events' },
  { label: 'Bildirishnomalar', icon: Bell, path: '/guardian/notifications' },
  { label: 'Sertifikatlar', icon: ScrollText, path: '/guardian/certificates' },
];

export function GuardianLayout() {
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        <aside className={cn(
          "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
          collapsed ? "w-[68px]" : "w-[240px]"
        )}>
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!collapsed && (
              <Link to="/guardian/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">M</div>
                <span className="font-bold text-sm">Ota-ona paneli</span>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}
              className="text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8">
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {navItems.map(item => (
              <Link key={item.path} to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>

          <div className="border-t border-sidebar-border p-2 space-y-1">
            <button onClick={toggleTheme}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && <span>{theme === 'dark' ? 'Kunduzgi' : 'Tungi'} rejim</span>}
            </button>
            <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2", collapsed ? "justify-center" : "")}>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                  {guardianUser?.studentFullName?.charAt(0) || 'G'}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{guardianUser?.studentFullName}</p>
                  <p className="text-xs text-sidebar-foreground/60">Ota-ona</p>
                </div>
              )}
              <button onClick={() => setLogoutOpen(true)} className="text-sidebar-foreground/60 hover:text-destructive transition-colors">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="p-6 max-w-[1200px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={logoutOpen} onOpenChange={setLogoutOpen}
        title="Tizimdan chiqish" description="Haqiqatan ham chiqmoqchimisiz?"
        confirmText="Chiqish" variant="destructive" onConfirm={handleLogout}
      />
    </>
  );
}
