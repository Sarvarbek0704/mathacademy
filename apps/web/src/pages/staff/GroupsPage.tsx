import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Loader2,
  Calendar,
  GraduationCap,
  UserCheck,
  MoreVertical,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Progress } from '@/components/ui/progress';

export default function GroupsPage() {
  const { data, loading, total, page, totalPages, setSearch, setPage, create, update, remove } = useCrud({ endpoint: '/staff/groups' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  const [form, setForm] = useState({ name: '', grade: '10', academicYearId: '' });

  const { data: currentAy } = useQuery({
    queryKey: ['academic-years', 'current', 'for_groups'],
    queryFn: async () => {
      const res = await api.get('/staff/academic-years?isCurrent=true');
      return res.data?.items?.[0];
    }
  });

  const handleCreateOrUpdate = async () => {
    const payload = {
      name: form.name,
      grade: parseInt(form.grade, 10),
      academicYearId: form.academicYearId || String(currentAy?.id || ''),
    };

    if (editing) await update(editing.id, payload);
    else await create(payload);
    
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Guruhlar boshqaruvi" 
        description="Sinflar, oqimlar va o'quv guruhlarini tashkillash" 
        action={{ 
          label: "Yangi guruh", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setEditing(null); 
            setForm({ name: '', grade: '10', academicYearId: currentAy?.id ? String(currentAy.id) : '' }); 
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Guruhlardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex bg-muted p-1 rounded-lg shrink-0">
          <Button variant={viewMode === 'GRID' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode('GRID')}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === 'LIST' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => setViewMode('LIST')}>
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className={viewMode === 'GRID' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
          {data.map((group: any) => (
            viewMode === 'GRID' ? (
              <Card key={group.id} className="group hover:border-primary/50 transition-all flex flex-col h-full shadow-sm overflow-hidden">
                <CardHeader className="p-5 pb-0">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-800">
                      <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditing(group);
                          setForm({ name: group.name, grade: String(group.grade || '10'), academicYearId: group.academicYearId ? String(group.academicYearId) : '' });
                          setModalOpen(true);
                      }}> <Edit2 className="h-4 w-4" /> </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleting(group); setDeleteOpen(true); }}> <Trash2 className="h-4 w-4" /> </Button>
                    </div>
                  </div>
                  <div className="mt-4">
                    <CardTitle className="text-xl font-black">{group.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0">
                        {group.grade}-sinf
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">• {group.academicYear?.name}</span>
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-5 flex-1 flex flex-col justify-end space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-primary" /> Sig'im
                      </span>
                      <span>{group.studentCount || 0} / 25</span>
                    </div>
                    <Progress value={((group.studentCount || 0) / 25) * 100} className="h-1.5" />
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20 flex justify-between text-[11px] font-medium text-muted-foreground">
                   <div className="flex items-center gap-1">
                     <Calendar className="h-3 w-3" />
                     Boshlangan: 02.09.2024
                   </div>
                   <div className="hover:text-primary cursor-pointer transition-colors">
                     Ro'yxatni ko'rish →
                   </div>
                </CardFooter>
              </Card>
            ) : (
              <Card key={group.id} className="hover:bg-muted/30 transition-colors border-none shadow-none bg-card/50">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center font-bold text-indigo-700 text-xs">
                       {group.name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{group.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{group.grade}-sinf • {group.studentCount || 0} o'quvchi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs" onClick={() => {
                        setEditing(group);
                        setForm({ name: group.name, grade: String(group.grade || '10'), academicYearId: group.academicYearId ? String(group.academicYearId) : '' });
                        setModalOpen(true);
                    }}> <Edit2 className="h-3.5 w-3.5" /> Tahrirlash </Button>
                  </div>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={editing ? 'Guruhni tahrirlash' : 'Yangi guruh yaratish'} size="sm">
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label>Guruh nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: 10-A" className="font-bold text-lg" />
          </div>

          <div className="space-y-2">
            <Label>Sinf (Daraja)</Label>
            <div className="flex gap-2">
              {['10', '11'].map(g => (
                <Button 
                  key={g} 
                  variant={form.grade === g ? 'default' : 'outline'} 
                  className="flex-1"
                  onClick={() => setForm({ ...form, grade: g })}
                >
                  {g}-sinf
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Akademik yil</Label>
            <Card className="bg-muted/50 border-dashed shadow-none">
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                   <p className="text-sm font-bold">{currentAy?.name || 'Yuklanmoqda...'}</p>
                   <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Joriy o'quv yili</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {editing ? 'Saqlash' : 'Guruhni yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="Guruhni o'chirish" 
        description={`"${deleting?.name}" guruhini o'chirishga ishonchingiz komilmi? Bu amaldan so'ng ushbu guruhga bog'langan barcha o'quvchilar guruhsiz qolishi mumkin.`}
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { if (deleting) { await remove(deleting.id); setDeleteOpen(false); } }} 
      />
    </div>
  );
}
