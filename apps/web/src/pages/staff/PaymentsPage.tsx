import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCrud } from '@/hooks/useCrud';
import { useState } from 'react';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import { Receipt, DollarSign, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';


export default function PaymentsPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create } = useCrud({ endpoint: '/staff/billing/payments' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ 
    invoiceId: '', paidAmount: '0', method: 'CASH', reference: '' 
  });

  const { data: invoicesRes } = useQuery({
    queryKey: ['staff', 'billing', 'invoices', 'pending'],
    queryFn: async () => {
      const res = await api.get('/staff/billing/invoices', { params: { status: 'PENDING', limit: 200 } });
      return res.data;
    }
  });
  const invoicesList = invoicesRes?.data || invoicesRes?.items || [];

  const { data: billingSummary } = useQuery({
    queryKey: ['staff', 'billing', 'summary'],
    queryFn: async () => (await api.get('/staff/billing/summary')).data,
  });

  const totalCollected = billingSummary?.totalCollected ?? 0;
  const totalPending = billingSummary?.totalPending ?? 0;
  const totalOverdue = billingSummary?.totalOverdue ?? 0;

  const paidCount = billingSummary?.paidCount ?? 0;
  const pendingCount = billingSummary?.pendingCount ?? 0;
  const partialCount = billingSummary?.partialCount ?? 0;
  const totalCount = paidCount + pendingCount + partialCount || 1;
  const paymentStats = [
    { name: "To'langan", value: Math.round((paidCount / totalCount) * 100), color: 'hsl(152,60%,40%)' },
    { name: "To'lanmagan", value: Math.round((pendingCount / totalCount) * 100), color: 'hsl(0,72%,51%)' },
    { name: 'Qisman', value: Math.round((partialCount / totalCount) * 100), color: 'hsl(38,92%,50%)' },
  ];

  const methodLabels: Record<string, string> = { 
    CASH: 'Naqd', CARD: 'Karta', TRANSFER: 'O\'tkazma', OTHER: 'Boshqa' 
  };
  const columns: Column<any>[] = [
    { key: 'student', title: "O'quvchi", render: (i) => i.invoice?.student?.fullName || i.invoice?.student?.full_name || i.studentName || '-' },
    { key: 'amount', title: 'Summa', render: (i) => <span className="font-bold">{Number(i.amount || i.paidAmount || 0).toLocaleString()} so'm</span> },
    { key: 'method', title: 'Usul', render: (i) => methodLabels[i.method] || i.method || '-' },
    { key: 'status', title: 'Holat', render: (i) => <StatusBadge status={i.status || 'PAID'} /> },
    { key: 'date', title: 'Sana', render: (i) => (i.createdAt || i.created_at) ? new Date(i.createdAt || i.created_at).toLocaleDateString('uz') : '-' },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="To'lovlar" description="Barcha to'lovlar tarixi" action={{ 
        label: "To'lovni qayd etish", 
        onClick: () => {
          setForm({ invoiceId: '', paidAmount: '0', method: 'CASH', reference: '' });
          setModalOpen(true);
        }
      }} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Jami yig'ilgan"
          value={`${Number(totalCollected).toLocaleString()} so'm`}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Kutilayotgan"
          value={`${Number(totalPending).toLocaleString()} so'm`}
          icon={<Receipt className="h-5 w-5" />}
          color="warning"
        />
        <StatCard
          title="Muddati o'tgan"
          value={`${Number(totalOverdue).toLocaleString()} so'm`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="destructive"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DataTable columns={columns} data={data} loading={loading} searchable onSearch={setSearch} pagination={{ page, totalPages, total, onPageChange: setPage }} />
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base">To'lov holati</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={paymentStats} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} fontSize={11}>
                {paymentStats.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title="To'lovni qayd etish" size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Hisob-faktura (Invoice)</Label>
            <Select value={form.invoiceId} onValueChange={v => {
              const selectedInv = invoicesList.find((inv: any) => String(inv.id) === v);
              setForm({ ...form, invoiceId: v, paidAmount: selectedInv ? String(selectedInv.amount) : '0' });
            }}>
              <SelectTrigger><SelectValue placeholder="Hisobni tanlang" /></SelectTrigger>
              <SelectContent>
                {invoicesList.map((inv: any) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.student?.fullName || inv.student?.full_name} - {Number(inv.amount).toLocaleString()} so'm
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>To'lov summasi</Label>
            <Input type="number" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>To'lov usuli</Label>
            <Select value={form.method} onValueChange={v => setForm({ ...form, method: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(methodLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kvitansiya / Tranzaksiya raqami (Ixtiyoriy)</Label>
            <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="TRX-123456" />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button className="w-full sm:w-auto" onClick={async () => { 
            const payload = {
              ...form,
              paidAmount: parseFloat(form.paidAmount),
              source: 'MANUAL',
            };
            await create(payload); 
            setModalOpen(false); 
          }}>Saqlash</Button>
        </div>
      </SlideOver>
    </div>
  );
}
