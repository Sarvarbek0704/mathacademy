import { useState } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Monitor, 
  MapPin, 
  Trash2, 
  Edit2, 
  Plus, 
  Loader2,
  Tv,
  Info,
  Power,
  RefreshCcw,
  Layout
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DisplaysPage() {
  const { data, loading, create, remove, update } = useCrud({ endpoint: '/staff/displays' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedDisplay, setSelectedDisplay] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [form, setForm] = useState({ 
    name: '', 
    location: '', 
    status: 'ACTIVE' 
  });

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedDisplay.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm({ name: '', location: '', status: 'ACTIVE' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (display: any) => {
    setSelectedDisplay(display);
    setForm({ 
      name: display.name, 
      location: display.location || '', 
      status: display.status || 'ACTIVE' 
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Monitorlar boshqaruvi" 
        description="Akademiya hududidagi info-panellar va ekranlar" 
        action={{ 
          label: "Monitor qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate
        }} 
      />

      {loading ? (
        <CardGridSkeleton cards={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((display: any) => (
            <Card key={display.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full">
              <CardHeader className="p-5">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border">
                    <Tv className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(display)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedDisplay(display); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-4 text-lg flex items-center gap-2">
                  {display.name}
                  <Badge variant={display.status === 'ACTIVE' ? "success" : "secondary"} className="text-[9px] px-1.5 h-4">
                    {display.status || 'ACTIVE'}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" /> {display.location || 'Joylashuv kiritilmagan'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <div className="bg-muted/30 p-3 rounded-lg border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Ma'lumot</span>
                  <div className="flex items-center gap-2">
                    <Layout className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Asosiy Dashboard</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20 flex justify-between">
                <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 bg-background">
                  <Power className="h-3 w-3" /> Qayta yoqish
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-[10px] gap-1 bg-background">
                  <RefreshCcw className="h-3 w-3" /> Yangilash
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Monitorni tahrirlash" : "Yangi monitor qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Monitor nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Kirish ekrani" />
          </div>

          <div className="space-y-2">
            <Label>Joylashuvi</Label>
            <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Masalan: A-blok kutish zali" />
          </div>

          <div className="space-y-2">
            <Label>Holati</Label>
            <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Faol</SelectItem>
                <SelectItem value="INACTIVE">Nofaol</SelectItem>
                <SelectItem value="MAINTENANCE">Ta'mirda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg flex items-start gap-3 border border-amber-100 dark:border-amber-900/30">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Monitorlar orqali e'lonlar, haftalik jadval va o'quvchilar natijalarini real-vaqt rejimida ko'rsatib turish mumkin.
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
        description="Ushbu monitorni tizimdan o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedDisplay.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
