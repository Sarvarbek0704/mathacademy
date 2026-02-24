import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Filter,
  Trophy,
  Megaphone,
  School,
  Loader2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function EventsPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/events' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [form, setForm] = useState({ 
    title: '', 
    type: 'EVENT', 
    date: '', 
    description: '', 
    location: '' 
  });

  const eventTypes: Record<string, { label: string, color: string, icon: any }> = {
    EVENT: { label: 'Tadbir', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Calendar },
    COMPETITION: { label: 'Musobaqa', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Trophy },
    HOLIDAY: { label: 'Bayram', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: Megaphone },
    MEETING: { label: 'Yig\'ilish', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Users },
    OTHER: { label: 'Boshqa', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400', icon: School },
  };

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedEvent.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
    setIsEditing(false);
  };

  const openCreate = () => {
    setForm({ title: '', type: 'EVENT', date: dayjs().format('YYYY-MM-DDTHH:mm'), description: '', location: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (event: any) => {
    setSelectedEvent(event);
    setForm({ 
      title: event.title, 
      type: event.type || 'EVENT', 
      date: dayjs(event.date).format('YYYY-MM-DDTHH:mm'), 
      description: event.description || '', 
      location: event.location || '' 
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Tadbirlar boshqaruvi" 
        description="Akademiya tadbirlari, bayramlar va yig'ilishlarni rejalashtirish" 
        action={{ 
          label: "Tadbir qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate
        }} 
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Tadbirlardan qidirish..." 
            className="pl-10 h-10" 
            value={searchTerm} 
            onChange={e => { setSearchTerm(e.target.value); setSearch(e.target.value); }} 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((event: any) => {
            const typeInfo = eventTypes[event.type] || eventTypes.OTHER;
            const Icon = typeInfo.icon;
            return (
              <Card key={event.id} className="group hover:border-primary/50 transition-all flex flex-col h-full overflow-hidden">
                <CardHeader className="p-5 pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Badge className={cn("px-2 py-0 h-5 text-[10px] font-bold border-none", typeInfo.color)} variant="outline">
                      {typeInfo.label}
                    </Badge>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(event)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setSelectedEvent(event); setDeleteOpen(true); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base line-clamp-1">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {dayjs(event.date).format('DD.MM.YYYY')}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {dayjs(event.date).format('HH:mm')}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {event.location || 'Joylashuv belgilanmagan'}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                    {event.description || 'Tavsif mavjud emas'}
                  </p>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20">
                  <Button variant="link" className="p-0 h-auto text-[11px] gap-1 text-primary">
                    Batafsil ma'lumot <ExternalLink className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Tadbirni tahrirlash" : "Yangi tadbir qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Tadbir nomi</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Masalan: Navro'z bayrami" />
          </div>

          <div className="space-y-2">
            <Label>Turi</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(eventTypes).map(([val, info]) => (
                  <SelectItem key={val} value={val}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sana va vaqt</Label>
            <Input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Manzil / Joy</Label>
            <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Masalan: Asosiy zal" />
          </div>

          <div className="space-y-2">
            <Label>Tavsif</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tadbir haqida batafsil..." rows={4} />
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
        title="Tadbirni o'chirish" 
        description="Ushbu tadbirni o'chirishga ishonchingiz komilmi? Bu amalni ortga qaytarib bo'lmaydi." 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedEvent.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
