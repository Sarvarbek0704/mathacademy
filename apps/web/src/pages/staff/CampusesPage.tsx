import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, 
  MapPin, 
  Trash2, 
  Edit2, 
  Plus, 
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function CampusesPage() {
  const { data, loading, create, remove, update } = useCrud({ endpoint: '/campuses' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [form, setForm] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    email: '' 
  });

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedCampus.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm({ name: '', address: '', phone: '', email: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (campus: any) => {
    setSelectedCampus(campus);
    setForm({ 
      name: campus.name, 
      address: campus.address || '', 
      phone: campus.phone || '', 
      email: campus.email || '' 
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Kampuslar boshqaruvi" 
        description="Akademiya hududlari va bino ma'lumotlari" 
        action={{ 
          label: "Kampus qo'shish", 
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
          {data.map((campus: any) => (
            <Card key={campus.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full">
              <CardHeader className="p-5">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(campus)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedCampus(campus); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-4 text-lg">{campus.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4 flex-1">
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="leading-tight">{campus.address || 'Manzil kiritilmagan'}</span>
                  </div>
                  {campus.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{campus.phone}</span>
                    </div>
                  )}
                  {campus.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{campus.email}</span>
                    </div>
                  )}
                </div>
                
                <div className="pt-2 flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Guruhlar</span>
                    <span className="text-sm font-semibold">{campus.groupCount || 0}</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">O'quvchilar</span>
                    <span className="text-sm font-semibold">{campus.studentCount || 0}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20 mt-auto">
                <Button variant="link" className="p-0 h-auto text-[11px] gap-1 text-primary">
                  Kampus xaritasi <ExternalLink className="h-3 w-3" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Kampusni tahrirlash" : "Yangi kampus qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Bosh bino" />
          </div>

          <div className="space-y-2">
            <Label>Manzili</Label>
            <Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Toliq manzil..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+998..." />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="campus@math.uz" />
            </div>
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
        description="Ushbu kampusni o'chirishga ishonchingiz komilmi? Bu amalni ortga qaytarib bo'lmaydi." 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedCampus.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
