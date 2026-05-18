import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, Award, ExternalLink } from 'lucide-react';

export default function GuardianCertificates() {
  const { data: certRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'certificates'],
    queryFn: async () => (await api.get('/guardian/student/certificates')).data
  });

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  const certificates = certRes?.certificates || [];

  const columns: Column<any>[] = [
    { 
      key: 'type', 
      title: 'Turi', 
      render: (i) => <span className="font-bold flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> {i.type}</span> 
    },
    { 
      key: 'score', 
      title: 'Natija', 
      render: (i) => <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">{i.score}</span> 
    },
    { 
      key: 'issueDate', 
      title: 'Berilgan sana', 
      render: (i) => i.issueDate ? new Date(i.issueDate).toLocaleDateString('uz') : '-' 
    },
    { 
      key: 'expiryDate', 
      title: 'Amal qilish muddati', 
      render: (i) => i.expiryDate ? new Date(i.expiryDate).toLocaleDateString('uz') : 'Cheksiz' 
    },
    { key: 'issuedBy', title: 'Tashkilot' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Sertifikatlar" 
        description="IELTS, SAT va boshqa xalqaro sertifikatlar natijalari" 
      />

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={certificates} 
          emptyMessage="Sertifikatlar hali qo'shilmagan" 
        />
      </div>
    </div>
  );
}
