import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCrud } from '@/hooks/useCrud';
import { useState } from 'react';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus } from 'lucide-react';

export default function InvoicesPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create } = useCrud({ endpoint: '/staff/billing/invoices' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ 
    studentId: '', amount: '0', dueDate: '', 
    periodStart: '', periodEnd: '', type: 'COURSE', description: '' 
  });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'all_billing'],
    queryFn: async () => {
      const res = await api.get('/staff/students?limit=250');
      return res.data;
    }
  });
  const studentsList = studentsRes?.data || [];

  const columns: Column<any>[] = [
    { key: 'student', title: "O'quvchi", render: (i) => i.student?.fullName || i.student?.full_name || '-' },
    { key: 'amount', title: 'Summa', render: (i) => <span className="font-bold">{Number(i.amount || 0).toLocaleString()} so'm</span> },
    { key: 'type', title: 'Turi', render: (i) => i.type || '-' },
    { key: 'status', title: 'Holat', render: (i) => <StatusBadge status={i.status || 'UNPAID'} /> },
    { key: 'dueDate', title: 'Muddat', render: (i) => (i.dueDate || i.due_date) ? new Date(i.dueDate || i.due_date).toLocaleDateString('uz') : '-' },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Hisob-fakturalar" description="To'lov majburiyatlari" action={{ 
        label: 'Yangi hisob', 
        onClick: () => {
          setForm({ 
            studentId: '', amount: '0', 
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], 
            periodStart: new Date().toISOString().split('T')[0], 
            periodEnd: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], 
            type: 'COURSE', description: '' 
          });
          setModalOpen(true);
        }
      }} />
      <DataTable columns={columns} data={data} loading={loading} searchable onSearch={setSearch} pagination={{ page, totalPages, total, onPageChange: setPage }} />
      
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title="Yangi hisob-faktura" size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>O'quvchi</Label>
            <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
              <SelectTrigger><SelectValue placeholder="O'quvchini tanlang" /></SelectTrigger>
              <SelectContent>
                {studentsList.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.fullName || s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Summa</Label>
            <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>To'lov muddati</Label>
            <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Davr (boshi)</Label>
              <Input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Davr (yakuni)</Label>
              <Input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Turi</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COURSE">Kurs to'lovi</SelectItem>
                <SelectItem value="OTHER">Boshqa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Izoh</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Hisob haqida batafsil..." rows={3} />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button className="w-full sm:w-auto" onClick={async () => { 
            const payload = {
              ...form,
              amount: parseFloat(form.amount),
            };
            await create(payload); 
            setModalOpen(false); 
          }}>Yaratish</Button>
        </div>
      </SlideOver>
    </div>
  );
}
