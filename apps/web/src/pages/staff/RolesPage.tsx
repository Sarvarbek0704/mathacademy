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
import { Shield, ShieldAlert, ShieldCheck, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [managingRole, setManagingRole] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // Fetch roles
  const { data: rolesRes, isLoading: rolesLoading } = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: async () => (await api.get('/rbac/roles')).data
  });
  const roles = rolesRes?.data || [];

  // Fetch permissions
  const { data: permsRes } = useQuery({
    queryKey: ['rbac', 'permissions'],
    queryFn: async () => (await api.get('/rbac/permissions?limit=200')).data
  });
  const allPermissions = permsRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/rbac/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Rol muvaffaqiyatli yaratildi');
      setModalOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/rbac/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Rol yangilandi');
      setModalOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles'] });
      toast.success('Rol o\'chirildi');
      setDeleteOpen(false);
    }
  });

  const assignPermsMutation = useMutation({
    mutationFn: ({ id, permissionIds }: any) => api.post(`/rbac/roles/${id}/permissions`, { permissionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'role-perms', managingRole?.id] });
      toast.success('Huquqlar saqlandi');
      setPermsOpen(false);
    }
  });

  const openPerms = async (role: any) => {
    setManagingRole(role);
    setPermsOpen(true);
    try {
      const res = await api.get(`/rbac/roles/${role.id}/permissions`);
      setSelectedPerms(res.data.data.map((p: any) => String(p.id)));
    } catch (error) {
      toast.error('Huquqlarni yuklab bo\'lmadi');
    }
  };

  const columns: Column<any>[] = [
    { 
      key: 'name', title: 'Rol nomi', 
      render: (item) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-bold">{item.name}</span>
        </div>
      )
    },
    { key: 'description', title: 'Tavsif' },
    { 
      key: 'perms', title: 'Huquqlar', 
      render: (item) => (
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => openPerms(item)}>
          Huquqlarni boshqarish
        </Button>
      )
    }
  ];

  const handleSubmit = () => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Rollar va huquqlar" 
        description="Tizimdagi rollarni boshqarish va ularga tegishli huquqlarni belgilash" 
        action={{ label: "Yangi rol qo'shish", onClick: () => { setEditing(null); setForm({ name: '', description: '' }); setModalOpen(true); } }}
      />

      <DataTable 
        columns={columns} 
        data={roles} 
        loading={rolesLoading}
        actions={(item) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setForm({ name: item.name, description: item.description || '' }); setModalOpen(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Role creation/edit Modal */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Rolni tahrirlash' : "Yangi rol qo'shish"} size="md">
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Rol nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Manager, Teacher" />
          </div>
          <div className="space-y-2">
            <Label>Tavsif</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Rol vazifasi haqida qisqacha..." />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Saqlash
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Permissions Management Drawer */}
      <SlideOver open={permsOpen} onOpenChange={setPermsOpen} title={`"${managingRole?.name}" huquqlari`} description="Ushbu rolga tegishli barcha amallarni belgilang" size="lg">
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allPermissions.map((perm: any) => (
              <div key={perm.id} className="flex items-start space-x-3 p-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all cursor-pointer group"
                onClick={() => {
                  if (selectedPerms.includes(String(perm.id))) {
                    setSelectedPerms(selectedPerms.filter(id => id !== String(perm.id)));
                  } else {
                    setSelectedPerms([...selectedPerms, String(perm.id)]);
                  }
                }}
              >
                <div className="mt-0.5">
                  <Checkbox 
                    checked={selectedPerms.includes(String(perm.id))}
                    onCheckedChange={() => {}} // Controlled by div click
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold font-mono text-primary/80 group-hover:text-primary">{perm.code}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{perm.name}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-6 border-t flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm pb-4">
            <Button variant="outline" onClick={() => setPermsOpen(false)}>Yopish</Button>
            <Button onClick={() => assignPermsMutation.mutate({ id: managingRole.id, permissionIds: selectedPerms })} disabled={assignPermsMutation.isPending}>
              {assignPermsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Huquqlarni saqlash
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} onOpenChange={setDeleteOpen} 
        title="Rolni o'chirish" description="Haqiqatan ham ushbu rolni o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi."
        confirmText="O'chirish" variant="destructive" 
        onConfirm={() => deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
