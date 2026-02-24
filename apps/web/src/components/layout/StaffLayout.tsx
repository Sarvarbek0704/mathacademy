import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { StaffSidebar } from './StaffSidebar';
import { Breadcrumbs } from '../shared/Breadcrumbs';
import { Loader2 } from 'lucide-react';

export function StaffLayout() {
  const { user, loading } = useAuth();

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
      <StaffSidebar />
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 max-w-[1440px] mx-auto">
          <Breadcrumbs />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
