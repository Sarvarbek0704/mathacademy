import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, CheckCircle, RefreshCw, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function AcademicYearsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', isCurrent: false });

  // Fetch Academic Years
  const { data: ayRes, isLoading } = useQuery({
    queryKey: ['staff', 'academic-years'],
    queryFn: async () => (await api.get('/staff/academic-years')).data
  });

  const years = ayRes?.items || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post('/staff/academic-years', payload)).data,
    onSuccess: () => {
      toast.success("O'quv yili yaratildi");
      queryClient.invalidateQueries({ queryKey: ['staff', 'academic-years'] });
      setModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: any) => (await api.patch(`/staff/academic-years/${id}`, payload)).data,
    onSuccess: () => {
      toast.success("O'quv yili yangilandi");
      queryClient.invalidateQueries({ queryKey: ['staff', 'academic-years'] });
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/staff/academic-years/${id}`)).data,
    onSuccess: () => {
      toast.success("O'quv yili o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['staff', 'academic-years'] });
      setDeleteOpen(false);
    }
  });

  const setCurrentMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/staff/academic-years/${id}/set-current`)).data,
    onSuccess: () => {
      toast.success("Joriy o'quv yili o'zgartirildi");
      queryClient.invalidateQueries({ queryKey: ['staff', 'academic-years'] });
    }
  });

  const columns: Column<any>[] = [
    { key: 'name', title: 'Nomi', render: (i) => <span className="font-bold text-primary">{i.name}</span> },
    { key: 'startDate', title: 'Boshlanishi', render: (i) => i.startDate ? new Date(i.startDate).toLocaleDateString('uz') : '-' },
    { key: 'endDate', title: 'Tugashi', render: (i) => i.endDate ? new Date(i.endDate).toLocaleDateString('uz') : '-' },
    { key: 'isCurrent', title: 'Holat', render: (i) => i.isCurrent ? <StatusBadge status="ACTIVE" label="Joriy" /> : <StatusBadge status="CLOSED" label="Tugagan" /> },
  ];

  const openCreate = () => { 
    setEditing(null); 
    setForm({ name: '', startDate: '', endDate: '', isCurrent: false }); 
    setModalOpen(true); 
  };
  
  const openEdit = (item: any) => { 
    setEditing(item); 
    setForm({ 
      name: item.name, 
      startDate: item.startDate?.split('T')[0] || '', 
      endDate: item.endDate?.split('T')[0] || '', 
      isCurrent: item.isCurrent 
    }); 
    setModalOpen(true); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader 
        title="O'quv yillari" 
        description="Akademiya uchun akademik o'quv yillarini boshqarish" 
        action={{ label: "Yangi o'quv yili", onClick: openCreate, icon: <RefreshCw className="h-4 w-4" /> }} 
      />

      <DataTable 
        columns={columns} 
        data={years} 
        loading={isLoading}
        actions={(item) => (
          <div className="flex items-center gap-1">
            {!item.isCurrent && (
              <Button 
                variant="ghost" 
                size="icon" 
                title="Joriy qilish" 
                onClick={() => setCurrentMutation.mutate(item.id)}
                disabled={setCurrentMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 text-success" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => { setDeleting(item); setDeleteOpen(true); }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )} 
      />

      <SlideOver 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        title={editing ? 'Tahrirlash' : "Yangi o'quv yili"}
        description="Akademik yil ma'lumotlarini kiriting. Joriy yil qilib belgilash barcha guruhlarni ushbu yilga bog'laydi."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>O'quv yili nomi</Label>
            <Input 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })} 
              placeholder="Masalan: 2024-2025" 
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanish sanasi</Label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={form.startDate} 
                  onChange={e => setForm({ ...form, startDate: e.target.value })} 
                  className="pl-9"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tugash sanasi</Label>
              <div className="relative">
                <Input 
                  type="date" 
                  value={form.endDate} 
                  onChange={e => setForm({ ...form, endDate: e.target.value })} 
                  className="pl-9"
                  required
                />
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-dashed text-xs text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            Yangi yil yaratilgandan so'ng, uni jilddagi "Joriy" tugmasi orqali asosiy yil sifatida belgilashingiz mumkin.
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" className="w-full gap-2" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Pencil className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              {editing ? 'Saqlash' : 'Yaratish'}
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
          </div>
        </form>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="O'quv yilini o'chirish" 
        description={`"${deleting?.name}" o'quv yilini o'chirishga ishonchingiz komilmi? Bu amalni ortga qaytarib bo'lmaydi.`}
        confirmText="Ha, o'chirish" 
        variant="destructive" 
        onConfirm={async () => { 
          if (deleting) { 
            deleteMutation.mutate(deleting.id); 
          } 
        }} 
      />
    </div>
  );
}
