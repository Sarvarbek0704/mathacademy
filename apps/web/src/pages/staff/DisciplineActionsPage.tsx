import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';

export default function DisciplineActionsPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create } = useCrud({ endpoint: '/staff/discipline/actions' });
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ studentId: '', actionType: 'WARNING', reason: '', violationIds: [] as string[] });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'all_actions'],
    queryFn: async () => {
      const res = await api.get('/staff/students?limit=250');
      return res.data;
    }
  });
  const studentsList = studentsRes?.data || [];

  const { data: violationsRes } = useQuery({
    queryKey: ['staff', 'discipline', 'violations', form.studentId],
    queryFn: async () => {
      if (!form.studentId) return { data: [] };
      const res = await api.get(`/staff/discipline/violations?studentId=${form.studentId}&limit=50`);
      return res.data;
    },
    enabled: !!form.studentId
  });
  const studentViolations = violationsRes?.data || [];

  const actionTypeLabels: Record<string, string> = { 
    WARNING: 'Ogohlantirish', 
    RESTRICTION: 'Cheklash', 
    FINAL_NOTICE: 'Oxirgi ogohlantirish', 
    EXPELLED: 'Chetlatish' 
  };
  const actionTypeColors: Record<string, string> = { 
    WARNING: 'warning', 
    RESTRICTION: 'warning', 
    FINAL_NOTICE: 'destructive', 
    EXPELLED: 'destructive' 
  };

  const columns: Column<any>[] = [
    { key: 'student', title: "O'quvchi", render: (i) => i.student?.fullName || i.student?.full_name || '-' },
    { key: 'actionType', title: 'Jazo turi', render: (i) => <StatusBadge status={actionTypeColors[i.actionType] || 'warning'} label={actionTypeLabels[i.actionType] || i.actionType} /> },
    { key: 'reason', title: 'Sabab', render: (i) => <span className="max-w-xs truncate block">{i.reason}</span> },
    { key: 'issuedAt', title: 'Sana', render: (i) => (i.issuedAt || i.issued_at) ? new Date(i.issuedAt || i.issued_at).toLocaleDateString('uz') : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Jazolar" description="Intizomiy choralar" action={{ label: 'Yangi jazo', onClick: () => { setForm({ violationId: '', type: 'WARNING', notes: '' }); setModalOpen(true); } }} />
      <DataTable columns={columns} data={data} loading={loading} searchable onSearch={setSearch}
        pagination={{ page, totalPages, total, onPageChange: setPage }} />
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title="Yangi intizomiy chora" size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>O'quvchi</Label>
            <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v, violationIds: [] })}>
              <SelectTrigger><SelectValue placeholder="O'quvchini tanlang" /></SelectTrigger>
              <SelectContent>
                {studentsList.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.fullName || s.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Jazo turi</Label>
            <Select value={form.actionType} onValueChange={v => setForm({ ...form, actionType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(actionTypeLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Bog'langan qoidabuzarliklar (Ixtiyoriy)</Label>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {studentViolations.length > 0 ? (
                studentViolations.map((v: any) => (
                  <div key={v.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`v-${v.id}`} 
                      checked={form.violationIds.includes(String(v.id))}
                      onCheckedChange={(checked) => {
                        if (checked) setForm({ ...form, violationIds: [...form.violationIds, String(v.id)] });
                        else setForm({ ...form, violationIds: form.violationIds.filter(id => id !== String(v.id)) });
                      }}
                    />
                    <Label htmlFor={`v-${v.id}`} className="text-sm font-normal cursor-pointer">
                      {v.ruleCode || v.rule_code} - {new Date(v.detectedAt || v.detected_at).toLocaleDateString('uz')}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">Qoidabuzarliklar mavjud emas</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sabab</Label>
            <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Jazo berilish sababi..." rows={4} />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button className="w-full sm:w-auto" onClick={async () => { await create(form); setModalOpen(false); }}>Yaratish</Button>
        </div>
      </SlideOver>
    </div>
  );
}
