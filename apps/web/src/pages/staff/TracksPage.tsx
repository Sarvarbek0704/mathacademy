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
  Route, 
  Trash2, 
  Edit2, 
  Plus, 
  Search,
  Loader2,
  Users,
  Compass,
  Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TracksPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/tracks' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ name: '', description: '' });

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedTrack.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Yo'nalishlar" 
        description="Akademiyadagi ta'lim yo'nalishlari va ixtisosliklar" 
        action={{ 
          label: "Yo'nalish qo'shish", 
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ name: '', description: '' });
            setIsEditing(false);
            setModalOpen(true);
          }
        }} 
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Yo'nalishlardan qidirish..." className="pl-10" onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((track: any) => (
            <Card key={track.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full bg-card">
              <CardHeader className="p-5">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Compass className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setSelectedTrack(track);
                        setForm({ name: track.name, description: track.description || '' });
                        setIsEditing(true);
                        setModalOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedTrack(track); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-4 text-lg">{track.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 flex-1 space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {track.description || 'Tavsif mavjud emas.'}
                </p>
                
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Guruhlar</span>
                    <span className="text-sm font-semibold">{track.groupCount || 0}</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">A'zolar</span>
                    <span className="text-sm font-semibold">{track.studentCount || 0}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 border-t bg-muted/20">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <Trophy className="h-3.5 w-3.5" />
                  Akademik natijadorlik: Yuqori
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Form SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? "Yo'nalishni tahrirlash" : "Yangi yo'nalish qo'shish"} size="sm">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Yo'nalish nomi</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Masalan: SAT Intensive" />
          </div>

          <div className="space-y-2">
            <Label>Tavsifi</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Yo'nalish haqida batafsil ma'lumot..." rows={4} />
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
        description="Ushbu yo'nalishni o'chirishga ishonchingiz komilmi?" 
        confirmText="O'chirish" 
        variant="destructive" 
        onConfirm={async () => { await remove(selectedTrack.id); setDeleteOpen(false); }} 
      />
    </div>
  );
}
