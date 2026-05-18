import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { StaffSidebar } from './StaffSidebar';
import { Breadcrumbs } from '../shared/Breadcrumbs';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppLogoIcon } from '@/components/shared/AppLogo';

export function StaffLayout() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.type !== 'STAFF') {
    return <Navigate to="/staff/login" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <StaffSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

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
          <div className="p-4 sm:p-6 max-w-[1440px] mx-auto">
            <Breadcrumbs />
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
