import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, Receipt, Wallet, CreditCard, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';

export default function GuardianBilling() {
  const { data: billRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'invoices'],
    queryFn: async () => (await api.get('/guardian/student/invoices')).data
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const invoices = billRes?.invoices || [];
  const totals = billRes?.totals || { totalInvoiced: 0, totalPaid: 0, totalPending: 0 };

  const columns: Column<any>[] = [
    { 
      key: 'invoiceNumber', 
      title: 'Hujjat #', 
      render: (i) => <span className="font-mono font-medium">{i.invoiceNumber}</span> 
    },
    { key: 'type', title: 'Turi' },
    { 
      key: 'amount', 
      title: 'Summa', 
      render: (i) => <span>{Number(i.amount).toLocaleString()} so'm</span> 
    },
    { 
      key: 'pendingAmount', 
      title: 'Qoldiq', 
      render: (i) => <span className={Number(i.pendingAmount) > 0 ? "text-destructive font-medium" : ""}>{Number(i.pendingAmount).toLocaleString()} so'm</span> 
    },
    { 
      key: 'status', 
      title: 'Holat', 
      render: (i) => <StatusBadge status={i.status} /> 
    },
    { 
      key: 'dueDate', 
      title: 'Muddat', 
      render: (i) => i.dueDate ? new Date(i.dueDate).toLocaleDateString('uz') : '-' 
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="To'lovlar" 
        description="Hisob-fakturalar, to'lovlar va qarzdorliklar" 
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Jami to'langan" value={`${Number(totals.totalPaid).toLocaleString()} so'm`} icon={<Wallet className="h-4 w-4" />} color="success" />
        <StatCard title="To'lanmagan" value={`${Number(totals.totalPending).toLocaleString()} so'm`} icon={<AlertCircle className="h-4 w-4" />} color="destructive" />
        <StatCard title="Jami hisob" value={`${Number(totals.totalInvoiced).toLocaleString()} so'm`} icon={<Receipt className="h-4 w-4" />} color="primary" />
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <DataTable 
          columns={columns} 
          data={invoices} 
          emptyMessage="Hisob-fakturalar hali mavjud emas" 
        />
      </div>
    </div>
  );
}
