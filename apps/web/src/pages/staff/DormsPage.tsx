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
  BedDouble, 
  Plus, 
  Trash2, 
  Edit2, 
  Users, 
  Home, 
  MapPin, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function DormsPage() {
  const { data, loading, create, remove, update } = useCrud({ endpoint: '/staff/dorms' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDorm, setSelectedDorm] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [form, setForm] = useState({ 
    name: '', 
    capacity: 0, 
    location: '', 
    campusId: '' 
  });

  const { data: campusesRes } = useQuery({
    queryKey: ['staff', 'campuses', 'list'],
    queryFn: async () => (await api.get('/campuses')).data
  });
  const campuses = campusesRes || [];

  const handleCreateOrUpdate = async () => {
    const payload = { ...form, capacity: Number(form.capacity) };
    if (isEditing) {
      await update(selectedDorm.id, payload);
    } else {
      await create(payload);
    }
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm({ name: '', capacity: 0, location: '', campusId: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (dorm: any) => {
    setSelectedDorm(dorm);
    setForm({ 
      name: dorm.name, 
      capacity: dorm.capacity, 
      location: dorm.location || '', 
      campusId: dorm.campusId ? String(dorm.campusId) : '' 
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Yotoqxonalar boshqaruvi" 
        description="Talabalar turar joylari va xonalar sig'imi" 
        action={{ 
          label: "Yotoqxona qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate
        }} 
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((dorm: any) => {
            const occupancy = dorm.studentCount || 0;
            const capacity = dorm.capacity || 1;
            const percent = Math.min(Math.round((occupancy / capacity) * 100), 100);
            
            return (
              <Card key={dorm.id} className="hover:border-primary/50 transition-all overflow-hidden">
                <CardHeader className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BedDouble className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(dorm)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedDorm(dorm); setDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-lg">{dorm.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" /> {dorm.location || 'Manzil belgilanmagan'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" /> Bandlik
                      </span>
                      <span>{occupancy} / {capacity}</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant={percent >= 90 ? "destructive" : percent >= 70 ? "warning" : "success"} className="text-[10px] h-5">
                      {percent >= 90 ? "Deyarli to'la" : percent >= 70 ? "O'rtacha band" : "Bo'sh joy bor"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground italic">
                      {dorm.campus?.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Yotoqxonani tahrirlash" : "Yangi yotoqxona qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: 1-sonli Yotoqxona" />
          </div>

          <div className="space-y-2">
            <Label>Sig'imi (O'rinlar soni)</Label>
            <Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} />
          </div>

          <div className="space-y-2">
            <Label>Kampus</Label>
            <Select value={form.campusId} onValueChange={v => setForm({ ...form, campusId: v })}>
              <SelectTrigger><SelectValue placeholder="Kampusni tanlang" /></SelectTrigger>
              <SelectContent>
                {campuses.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Joylashuvi / Tavsif</Label>
            <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Masalan: B-blok, 2-qavat" />
          </div>

          <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Yotoqxona qo'shilgandan so'ng, o'quvchilarni ushbu yotoqxonaga Talabalar sahifasidan biriktirishingiz mumkin.
            </p>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {isEditing ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="O'chirish" 
        description="Ushbu yotoqxonani o'chirishga ishonchingiz komilmi? Undagi o'quvchilar biriktiruvi ham o'chirilishi mumkin." 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedDorm.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
