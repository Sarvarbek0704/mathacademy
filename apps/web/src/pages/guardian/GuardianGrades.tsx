import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, GraduationCap } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function GuardianGrades() {
  const { data: gradesRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'grades'],
    queryFn: async () => (await api.get('/guardian/student/grades')).data
  });

  const grades = gradesRes?.grades || [];

  const columns: Column<any>[] = [
    { 
      key: 'subject', 
      title: 'Fan', 
      render: (i) => (
        <div className="flex flex-col">
          <span className="font-medium">{i.subject}</span>
          <span className="text-xs text-muted-foreground">{i.group}</span>
        </div>
      )
    },
    { 
      key: 'title', 
      title: 'Test nomi', 
      render: (i) => (
        <div className="flex flex-col">
          <span>{i.title}</span>
          <span className="text-xs text-muted-foreground">{i.type}</span>
        </div>
      )
    },
    { 
      key: 'score', 
      title: 'Ball / Max', 
      render: (i) => {
        const pct = (i.score / i.maxScore) * 100;
        let status: 'GREEN' | 'YELLOW' | 'RED' = 'RED';
        if (pct >= 85) status = 'GREEN';
        else if (pct >= 60) status = 'YELLOW';
        else status = 'RED';

        return (
          <div className="flex items-center gap-2">
            <span className="font-bold">{i.score}</span>
            <span className="text-muted-foreground text-xs">/ {i.maxScore}</span>
            <StatusBadge status={status} label={`${pct.toFixed(0)}%`} />
          </div>
        );
      }
    },
    { 
      key: 'heldAt', 
      title: 'Sana', 
      render: (i) => i.heldAt ? new Date(i.heldAt).toLocaleDateString('uz') : '-' 
    },
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
      <PageHeader 
        title="Baholar" 
        description="Farzandingizning test va imtihon natijalari" 
      />
      
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={grades} 
          emptyMessage="Test baholari hali mavjud emas" 
        />
      </div>
    </div>
  );
}
