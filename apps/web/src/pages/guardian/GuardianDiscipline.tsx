import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, AlertTriangle, ShieldAlert, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GuardianDiscipline() {
  const { data: discRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'discipline'],
    queryFn: async () => (await api.get('/guardian/student/discipline')).data
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const actions = discRes?.discipline?.actions || [];
  const violations = discRes?.discipline?.violations || [];

  const actionColumns: Column<any>[] = [
    { 
      key: 'actionType', 
      title: 'Chora turi', 
      render: (i) => <span className="font-bold">{i.actionType}</span> 
    },
    { key: 'reason', title: 'Sabab' },
    { 
      key: 'issuedAt', 
      title: 'Sana', 
      render: (i) => i.issuedAt ? new Date(i.issuedAt).toLocaleDateString('uz') : '-' 
    },
    { key: 'issuedBy', title: 'Kim tomonidan' },
    { 
      key: 'status', 
      title: 'Holat', 
      render: (i) => <StatusBadge status={i.isActive ? 'ACTIVE' : 'CLOSED'} /> 
    },
  ];

  const violationColumns: Column<any>[] = [
    { 
      key: 'ruleCode', 
      title: 'Qoida kodi', 
      render: (i) => <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{i.ruleCode}</span> 
    },
    { key: 'description', title: 'Tavsif' },
    { 
      key: 'severity', 
      title: 'Ogʻirlik darajasi', 
      render: (i) => {
        const status = i.severity === 'HIGH' ? 'RED' : i.severity === 'MEDIUM' ? 'YELLOW' : 'GREEN';
        return <StatusBadge status={status} label={i.severity} />;
      }
    },
    { 
      key: 'detectedAt', 
      title: 'Aniqlangan sana', 
      render: (i) => i.detectedAt ? new Date(i.detectedAt).toLocaleDateString('uz') : '-' 
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Intizom" 
        description="Farzandingizning intizomiy holati va chora-tadbirlar" 
      />

      <Tabs defaultValue="actions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Choralar
          </TabsTrigger>
          <TabsTrigger value="violations" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Qoidabuzarliklar
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="actions" className="mt-6 space-y-4">
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <DataTable 
              columns={actionColumns} 
              data={actions} 
              emptyMessage="Hozircha intizomiy choralar yo'q" 
            />
          </div>
        </TabsContent>

        <TabsContent value="violations" className="mt-6 space-y-4">
          <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
            <DataTable 
              columns={violationColumns} 
              data={violations} 
              emptyMessage="Hozircha qoidabuzarliklar qayd etilmagan" 
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
