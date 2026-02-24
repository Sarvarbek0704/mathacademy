import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ViolationsPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create, update, remove } = useCrud({ endpoint: '/staff/discipline/violations' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [form, setForm] = useState({ studentId: '', ruleCode: '', description: '', severity: 'LOW' });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'all_violations'],
    queryFn: async () => {
      const res = await api.get('/staff/students?limit=250');
      return res.data;
    }
  });
  const studentsList = studentsRes?.data || [];

  const severityLabels: Record<string, string> = { LOW: 'Past', MEDIUM: 'O\'rta', HIGH: 'Yuqori' };
  const severityColors: Record<string, string> = { LOW: 'info', MEDIUM: 'warning', HIGH: 'destructive' };

  const columns: Column<any>[] = [
    { key: 'student', title: "O'quvchi", render: (i) => i.student?.fullName || i.student?.full_name || '-' },
    { key: 'ruleCode', title: 'Turi', render: (i) => i.ruleCode || i.rule_code || '-' },
    { key: 'severity', title: 'Daraja', render: (i) => <StatusBadge status={severityColors[i.severity] || 'info'} label={severityLabels[i.severity] || i.severity} /> },
    { key: 'detectedAt', title: 'Sana', render: (i) => (i.detectedAt || i.detected_at) ? new Date(i.detectedAt || i.detected_at).toLocaleDateString('uz') : '-' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Qoidabuzarliklar" description="Intizom buzilish holatlari" action={{ label: 'Yangi qoidabuzarlik', onClick: () => { setEditing(null); setForm({ studentId: '', ruleCode: '', description: '', severity: 'LOW' }); setModalOpen(true); } }} />
      <DataTable columns={columns} data={data} loading={loading} searchable onSearch={setSearch}
        pagination={{ page, totalPages, total, onPageChange: setPage }}
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => { 
                setEditing(item); 
                setForm({ 
                  studentId: String(item.studentId || item.student_id || ''), 
                  ruleCode: item.ruleCode || item.rule_code || '', 
                  description: item.description || '', 
                  severity: item.severity || 'LOW' 
                }); 
                setModalOpen(true); 
              }}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        )} />
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Tahrirlash' : 'Yangi qoidabuzarlik'} size="sm">
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
            <Label>Turi (Rule Code)</Label>
            <Select value={form.ruleCode} onValueChange={v => setForm({ ...form, ruleCode: v })}>
              <SelectTrigger><SelectValue placeholder="Kodini tanlang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PHONE">Telefon</SelectItem>
                <SelectItem value="UNIFORM">Forma</SelectItem>
                <SelectItem value="LATE">Kechikish</SelectItem>
                <SelectItem value="BEHAVIOR">Xulq-atvor</SelectItem>
                <SelectItem value="OTHER">Boshqa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Daraja</Label>
            <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Past</SelectItem>
                <SelectItem value="MEDIUM">O'rta</SelectItem>
                <SelectItem value="HIGH">Yuqori</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tavsif</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Qoidabuzarlik haqida batafsil..." rows={4} />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
          <Button className="w-full sm:w-auto" onClick={async () => { if (editing) await update(editing.id, form); else await create(form); setModalOpen(false); }}>{editing ? 'Saqlash' : 'Yaratish'}</Button>
        </div>
      </SlideOver>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="O'chirish" description="Bu qoidabuzarlikni o'chirishga ishonchingiz komilmi?"
        confirmText="O'chirish" variant="destructive" onConfirm={async () => { if (deleting) { await remove(deleting.id); setDeleteOpen(false); } }} />
    </div>
  );
}
