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
  Trophy, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Swords,
  Timer,
  Medal,
  Loader2,
  ExternalLink,
  Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function CompetitionsPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/competitions' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ 
    name: '', 
    mode: 'SOLO', 
    rules: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(1, 'day').format('YYYY-MM-DD')
  });

  const modes = [
    { value: 'SOLO', label: 'Yakkalik', icon: Target, color: 'text-blue-600 bg-blue-50' },
    { value: 'TEAM', label: 'Jamoaviy', icon: Swords, color: 'text-purple-600 bg-purple-50' },
    { value: 'TOURNAMENT', label: 'Turnir', icon: Timer, color: 'text-orange-600 bg-orange-50' }
  ];

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedComp.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Musobaqalar" 
        description="Akademiya ichki va tashqi o'quv musobaqalarini boshqarish" 
        action={{ 
          label: "Musobaqa yaratish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ name: '', mode: 'SOLO', rules: '', startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(1, 'day').format('YYYY-MM-DD') });
            setIsEditing(false);
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Musobaqalardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((comp: any) => {
            const modeInfo = modes.find(m => m.value === comp.mode) || modes[0];
            const ModeIcon = modeInfo.icon;
            
            return (
              <Card key={comp.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full">
                <CardHeader className="p-5 pb-2">
                  <div className="flex justify-between items-start">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", modeInfo.color)}>
                      <Trophy className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setSelectedComp(comp);
                        setForm({ 
                          name: comp.name, 
                          mode: comp.mode || 'SOLO', 
                          rules: comp.rules || '',
                          startDate: dayjs(comp.startDate || comp.start_date).format('YYYY-MM-DD'),
                          endDate: dayjs(comp.endDate || comp.end_date).format('YYYY-MM-DD')
                        });
                        setIsEditing(true);
                        setModalOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedComp(comp); setDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px] font-bold border-none h-4 px-1.5", modeInfo.color)}>
                      {modeInfo.label}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base line-clamp-1">{comp.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-4 flex-1">
                  <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Timer className="h-3.5 w-3.5" />
                      {dayjs(comp.startDate || comp.start_date).format('DD MMM')} - {dayjs(comp.endDate || comp.end_date).format('DD MMM, YYYY')}
                    </div>
                    <p className="line-clamp-2 italic leading-relaxed">
                      {comp.rules || 'Qoidalar kiritilmagan'}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20 mt-auto">
                  <Button variant="link" className="p-0 h-auto text-[10px] gap-1 text-primary">
                    Ishtirokchilar ro'yxati <ExternalLink className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Musobaqani tahrirlash" : "Yangi musobaqa"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Musobaqa nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Matematika olimpiadasi" />
          </div>

          <div className="space-y-2">
            <Label>Rejim</Label>
            <Select value={form.mode} onValueChange={v => setForm({ ...form, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {modes.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanish sanasi</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tugash sanasi</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Qoidalar va tavsif</Label>
            <Textarea value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })} placeholder="Musobaqa shartlari va qoidalari..." rows={5} />
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
        description="Musobaqani o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedComp.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
