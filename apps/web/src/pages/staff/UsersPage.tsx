import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Users, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Key
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function UsersPage() {
  const { data, loading, setSearch, create, update, remove } = useCrud({ endpoint: '/staff/users' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  
  const [form, setForm] = useState({ 
    username: '', fullName: '', password: '', 
    phone: '', email: '', isActive: true, roleIds: [] as string[] 
  });

  const { data: rolesResponse } = useQuery({
    queryKey: ['rbac', 'roles', 'for_users'],
    queryFn: async () => (await api.get('/rbac/roles?limit=100')).data
  });
  const rolesList = rolesResponse?.data || [];

  const handleCreateOrUpdate = async () => {
    const body: any = { 
      username: form.username, 
      fullName: form.fullName,
      isActive: form.isActive,
      roleIds: form.roleIds
    };
    if (form.phone) body.phone = form.phone;
    if (form.email) body.email = form.email;
    if (form.password) body.password = form.password;

    if (editing) {
      await update(editing.id, body);
    } else {
      await create({ ...body, password: form.password || 'changeme123' });
    }
    setModalOpen(false);
  };

  const toggleRole = (roleId: string) => {
    setForm(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId) 
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId]
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Foydalanuvchilar" 
        description="Tizimga kirish huquqiga ega bo'lgan xodimlar va administratorlar" 
        action={{ 
          label: "Yangi foydalanuvchi", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setEditing(null);
            setForm({ username: '', fullName: '', password: '', phone: '', email: '', isActive: true, roleIds: [] });
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Foydalanuvchilardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((user: any) => (
            <Card key={user.id} className="group hover:border-primary/50 transition-all shadow-sm overflow-hidden flex flex-col">
              <CardHeader className="p-5 flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-background shadow-md">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                      {(user.fullName || user.username)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base line-clamp-1">{user.fullName}</CardTitle>
                    <CardDescription className="text-xs font-mono">@{user.username}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditing(user);
                        setForm({ 
                          username: user.username, 
                          fullName: user.fullName || '', 
                          password: '',
                          phone: user.phone || '',
                          email: user.email || '',
                          isActive: user.isActive ?? true,
                          roleIds: user.roles?.map((r: any) => String(r.id || r)) || []
                        });
                        setModalOpen(true);
                   }}> <Edit2 className="h-4 w-4" /> </Button>
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleting(user); setDeleteOpen(true); }}> <Trash2 className="h-4 w-4" /> </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-2 flex-1 space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {(user.roles || []).map((role: any) => (
                    <Badge key={role.id || role} variant="secondary" className="text-[9px] uppercase tracking-tighter px-1.5 h-4">
                      {role.name || role}
                    </Badge>
                  ))}
                  {(user.roles || []).length === 0 && <span className="text-[10px] text-muted-foreground italic">Rol biriktirilmagan</span>}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{user.email || 'Email kiritilmagan'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{user.phone || 'Telefon kiritilmagan'}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20 flex justify-between items-center">
                 <div className="flex items-center gap-1.5">
                   {user.isActive ? (
                     <Badge variant="success" className="h-5 gap-1 text-[10px]">
                       <CheckCircle2 className="h-3 w-3" /> FAOL
                     </Badge>
                   ) : (
                     <Badge variant="destructive" className="h-5 gap-1 text-[10px]">
                       <XCircle className="h-3 w-3" /> NOFAOL
                     </Badge>
                   )}
                 </div>
                 <span className="text-[10px] text-muted-foreground font-medium">
                   Kirish: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('uz') : 'Hech qachon'}
                 </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Foydalanuvchini tahrirlash" : "Yangi xodim qo'shish"} size="md">
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ism va Familiya</Label>
              <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="Ismni kiriting" />
            </div>
            <div className="space-y-2">
              <Label>Username (Login)</Label>
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="alisher_99" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Parol {editing && '(Bo\'sh qoldirilsa o\'zgarmaydi)'}</Label>
            <div className="relative">
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Maxfiy kod" className="pl-9" />
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+998" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="example@mail.uz" />
            </div>
          </div>

          <div className="space-y-3">
             <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Tizimdagi rollar</Label>
             <div className="grid grid-cols-2 gap-3 p-4 border rounded-xl bg-muted/20">
               {rolesList.map((role: any) => (
                 <div key={role.id} className="flex items-center space-x-2 group">
                   <Checkbox 
                     id={`u-role-${role.id}`} 
                     checked={form.roleIds.includes(String(role.id))}
                     onCheckedChange={() => toggleRole(String(role.id))}
                   />
                   <Label htmlFor={`u-role-${role.id}`} className="font-medium cursor-pointer text-sm group-hover:text-primary transition-colors">
                     {role.name}
                   </Label>
                 </div>
               ))}
             </div>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-xl bg-primary/5">
            <div className="space-y-0.5">
              <Label>Tizimga kirish huquqi</Label>
              <p className="text-[11px] text-muted-foreground">Ushbu xodim joriy holatda tizimga kira oladi.</p>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {editing ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="Foydalanuvchini o'chirish" 
        description={`"${deleting?.fullName || deleting?.username}" ni butunlay o'chirmoqchimisiz?`}
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { if (deleting) { await remove(deleting.id); setDeleteOpen(false); } }} 
      />
    </div>
  );
}
