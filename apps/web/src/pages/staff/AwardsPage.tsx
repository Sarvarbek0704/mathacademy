import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Trophy, Medal, Award, Pencil, Trash2, Loader2, User, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AwardsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    studentId: '', 
    type: 'AWARD', 
    title: '', 
    description: '', 
    issuedDate: new Date().toISOString().split('T')[0] 
  });

  // Queries
  const { data: awardsRes, isLoading } = useQuery({
    queryKey: ['staff', 'awards'],
    queryFn: async () => (await api.get('/staff/awards')).data
  });
  const awards = awardsRes?.data || [];

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students-simple'],
    queryFn: async () => (await api.get('/staff/students?limit=500')).data
  });
  const students = studentsRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/staff/awards', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success('Muvaffaqiyatli saqlandi');
      setModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/staff/awards/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success('Ma\'lumot yangilandi');
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/awards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success('O\'chirildi');
      setDeleteOpen(false);
    }
  });

  const columns: Column<any>[] = [
    { 
      key: 'type', title: 'Turi', 
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.type === 'AWARD' ? <Trophy className="h-4 w-4 text-warning" /> : <Award className="h-4 w-4 text-info" />}
          <span className="text-xs font-bold uppercase">{item.type}</span>
        </div>
      )
    },
    { 
      key: 'student', title: 'O\'quvchi', 
      render: (item) => (
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{item.studentName || item.student?.fullName || 'Noma\'lum'}</span>
        </div>
      )
    },
    { key: 'title', title: 'Nomi', render: (item) => <span className="font-bold">{item.title}</span> },
    { key: 'issuedDate', title: 'Sana', render: (item) => item.issuedDate ? new Date(item.issuedDate).toLocaleDateString('uz') : '-' }
  ];

  const handleSubmit = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Mukofotlar va Sertifikatlar" 
        description="O'quvchilarning erishgan yutuqlari, IELTS/SAT sertifikatlari va mukofotlari hisobi." 
        action={{ label: "Yangi yutuq qo'shish", onClick: () => { setEditing(null); setForm({ studentId: '', type: 'AWARD', title: '', description: '', issuedDate: new Date().toISOString().split('T')[0] }); setModalOpen(true); } }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="O'quvchi ismi yoki mukofot bo'yicha qidirish..." />
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Filter className="h-4 w-4" /> Saralash
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={awards} 
        loading={isLoading}
        actions={(item) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => { 
                setEditing(item); 
                setForm({ 
                    studentId: item.studentId || item.student?.id || '', 
                    type: item.type || 'AWARD', 
                    title: item.title || '', 
                    description: item.description || '', 
                    issuedDate: item.issuedDate ? new Date(item.issuedDate).toISOString().split('T')[0] : '' 
                }); 
                setModalOpen(true); 
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Tahrirlash' : "Yangi ma'lumot qo'shish"} size="md">
        <div className="space-y-5 pt-4">
          <div className="space-y-2">
            <Label>O'quvchi</Label>
            <Select value={form.studentId} onValueChange={v => setForm({ ...form, studentId: v })}>
              <SelectTrigger><SelectValue placeholder="O'quvchini tanlang" /></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                        {s.full_name || s.fullName} ({s.group_name || s.groupName || 'Guruhsiz'})
                    </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Turi</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWARD">Mukofot (Award)</SelectItem>
                  <SelectItem value="CERTIFICATE">Sertifikat (IELTS, SAT, etc)</SelectItem>
                  <SelectItem value="MEDAL">Medal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sana</Label>
              <Input type="date" value={form.issuedDate} onChange={e => setForm({ ...form, issuedDate: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nomi / Sarlavha</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Masalan: IELTS 8.5, Matematika olimpiadasi 1-o'rin" />
          </div>

          <div className="space-y-2">
            <Label>Tavsif (Ixtiyoriy)</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Batafsil ma'lumot..." className="min-h-[100px]" />
          </div>

          <div className="flex justify-end gap-2 mt-8 pt-4 border-t">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} onOpenChange={setDeleteOpen} 
        title="O'chirish" description="Ushbu yutuq ma'lumotini o'chirmoqchimisiz?"
        confirmText="O'chirish" variant="destructive" 
        onConfirm={() => deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
