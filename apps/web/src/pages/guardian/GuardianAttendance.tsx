import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, Calendar, UserCheck, UserMinus, Clock } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Input } from '@/components/ui/input';

export default function GuardianAttendance() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const { data: attRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'attendance', month],
    queryFn: async () => (await api.get(`/guardian/student/attendance?month=${month}`)).data
  });

  const records = attRes?.records || [];
  const summary = attRes?.summary || { PRESENT: 0, ABSENT: 0, LATE: 0, total: 0 };

  const columns: Column<any>[] = [
    { 
      key: 'date', 
      title: 'Sana', 
      render: (i) => i.date ? new Date(i.date).toLocaleDateString('uz', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' }) : '-' 
    },
    { key: 'group', title: 'Guruh' },
    { key: 'type', title: 'Turi' },
    { 
      key: 'status', 
      title: 'Holat', 
      render: (i) => <StatusBadge status={i.status} /> 
    },
    { key: 'note', title: 'Eslatma', render: (i) => i.note || '-' },
  ];

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader 
          title="Davomat" 
          description="Farzandingizning oylik davomat ko'rsatkichlari" 
        />
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)} 
            className="w-40 h-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Kelgan" value={String(summary.PRESENT || 0)} icon={<UserCheck className="h-4 w-4" />} color="success" />
        <StatCard title="Kelmagan" value={String(summary.ABSENT || 0)} icon={<UserMinus className="h-4 w-4" />} color="destructive" />
        <StatCard title="Kechikkan" value={String(summary.LATE || 0)} icon={<Clock className="h-4 w-4" />} color="warning" />
        <StatCard title="Foiz" value={`${records.length > 0 ? Math.round(((summary.PRESENT || 0) / records.length) * 100) : 0}%`} icon={<Calendar className="h-4 w-4" />} color="info" />
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={records} 
          emptyMessage="Ushbu oy uchun davomat ma'lumotlari mavjud emas" 
        />
      </div>
    </div>
  );
}
