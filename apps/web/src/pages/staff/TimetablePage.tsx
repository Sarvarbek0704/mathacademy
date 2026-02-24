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
  Clock, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Loader2,
  Calendar,
  BookOpen,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const WEEKDAYS = [
  { value: 'MONDAY', label: 'Dushanba' },
  { value: 'TUESDAY', label: 'Seshanba' },
  { value: 'WEDNESDAY', label: 'Chorshanba' },
  { value: 'THURSDAY', label: 'Payshanba' },
  { value: 'FRIDAY', label: 'Juma' },
  { value: 'SATURDAY', label: 'Shanba' },
];

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export default function TimetablePage() {
  const { data: timetable, loading, create, remove, update } = useCrud({ endpoint: '/staff/timetables' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  const [form, setForm] = useState({ 
    weekday: 'MONDAY', 
    startTime: '09:00', 
    endTime: '10:30', 
    subjectId: '', 
    groupId: '', 
    roomId: '' 
  });

  const { data: subjectsRes } = useQuery({
    queryKey: ['staff', 'subjects', 'for_timetable'],
    queryFn: async () => (await api.get('/staff/subjects?limit=100')).data
  });
  const subjects = subjectsRes?.items || [];

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'for_timetable'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data
  });
  const groups = groupsRes?.items || [];

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedSlot.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  const getSlotForDayAndTime = (day: string, time: string) => {
    return timetable.filter((s: any) => s.weekday === day && s.startTime.startsWith(time.split(':')[0]));
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Dars jadvali" 
        description="Haftalik darslar va xonalar taqsimoti" 
        action={{ 
          label: "Dars qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ weekday: 'MONDAY', startTime: '09:00', endTime: '10:30', subjectId: '', groupId: '', roomId: '' });
            setIsEditing(false);
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex items-center justify-between">
        <div className="flex bg-muted p-1 rounded-lg">
          <Button 
            variant={viewMode === 'GRID' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8"
            onClick={() => setViewMode('GRID')}
          >
            Grid ko'rinishi
          </Button>
          <Button 
            variant={viewMode === 'LIST' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8"
            onClick={() => setViewMode('LIST')}
          >
            Ro'yxat
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <div className="min-w-[1000px]">
            {/* Header */}
            <div className="grid grid-cols-[100px_repeat(6,1fr)] border-b bg-muted/30">
              <div className="p-3 border-r" />
              {WEEKDAYS.map(day => (
                <div key={day.value} className="p-3 text-center border-r last:border-r-0">
                  <span className="text-xs font-bold uppercase tracking-wider">{day.label}</span>
                </div>
              ))}
            </div>

            {/* Grid Body */}
            {TIME_SLOTS.map(time => (
              <div key={time} className="grid grid-cols-[100px_repeat(6,1fr)] border-b last:border-b-0 group">
                <div className="p-3 border-r bg-muted/10 flex items-center justify-center">
                  <span className="text-[11px] font-mono font-medium text-muted-foreground">{time}</span>
                </div>
                {WEEKDAYS.map(day => {
                  const slots = getSlotForDayAndTime(day.value, time);
                  return (
                    <div key={`${day.value}-${time}`} className="p-1.5 border-r last:border-r-0 min-h-[80px] hover:bg-muted/5 transition-colors relative group/day">
                      {slots.map((s: any) => (
                        <div 
                          key={s.id} 
                          className="mb-1 rounded-md border p-2 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all cursor-pointer group/slot relative"
                          onClick={() => {
                            setSelectedSlot(s);
                            setForm({ 
                              weekday: s.weekday, 
                              startTime: s.startTime, 
                              endTime: s.endTime, 
                              subjectId: String(s.subjectId || ''), 
                              groupId: String(s.groupId || ''), 
                              roomId: s.roomId || '' 
                            });
                            setIsEditing(true);
                            setModalOpen(true);
                          }}
                        >
                          <div className="font-bold line-clamp-1">{s.subject?.name || 'Fan'}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Users className="h-3 w-3" /> {s.group?.name || 'Guruh'}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {s.startTime}-{s.endTime}
                          </div>
                          <button 
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/10 text-destructive flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setSelectedSlot(s); setDeleteOpen(true); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button 
                        className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center opacity-0 group-hover/day:opacity-100 transition-opacity hover:bg-primary hover:text-white"
                        onClick={() => {
                          setForm({ weekday: day.value, startTime: time, endTime: '', subjectId: '', groupId: '', roomId: '' });
                          setIsEditing(false);
                          setModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {timetable.map((s: any) => (
             <Card key={s.id} className="group hover:border-primary/50 transition-all">
               <CardContent className="p-4 space-y-3">
                 <div className="flex justify-between items-start">
                   <Badge variant="secondary" className="text-[10px]">
                     {WEEKDAYS.find(w => w.value === s.weekday)?.label}
                   </Badge>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        setSelectedSlot(s);
                        setForm({ 
                          weekday: s.weekday, 
                          startTime: s.startTime, 
                          endTime: s.endTime, 
                          subjectId: String(s.subjectId || ''), 
                          groupId: String(s.groupId || ''), 
                          roomId: s.roomId || '' 
                        });
                        setIsEditing(true);
                        setModalOpen(true);
                     }}> <Edit2 className="h-3.5 w-3.5" /> </Button>
                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setSelectedSlot(s); setDeleteOpen(true); }}> <Trash2 className="h-3.5 w-3.5" /> </Button>
                   </div>
                 </div>
                 <div>
                   <h4 className="font-bold text-sm">{s.subject?.name}</h4>
                   <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                     <Users className="h-3.5 w-3.5" /> {s.group?.name}
                   </p>
                   <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                     <Clock className="h-3.5 w-3.5" /> {s.startTime} - {s.endTime}
                   </p>
                 </div>
               </CardContent>
             </Card>
           ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Darsni tahrirlash" : "Yangi dars qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Hafta kuni</Label>
            <Select value={form.weekday} onValueChange={v => setForm({ ...form, weekday: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanish vaqti</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tugash vaqti</Label>
              <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Fan</Label>
            <Select value={form.subjectId} onValueChange={v => setForm({ ...form, subjectId: v })}>
              <SelectTrigger><SelectValue placeholder="Fanni tanlang" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Guruh</Label>
            <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v })}>
              <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
              <SelectContent>
                {groups.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Xona / Manzil</Label>
            <Input value={form.roomId} onChange={e => setForm({ ...form, roomId: e.target.value })} placeholder="Masalan: 301-xona" />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>Saqlash</Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog 
        open={deleteOpen} 
        onOpenChange={setDeleteOpen} 
        title="O'chirish" 
        description="Jadvaldagi ushbu darsni o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedSlot.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
