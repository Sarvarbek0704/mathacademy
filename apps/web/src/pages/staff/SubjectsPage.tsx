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
  BookMarked,
  Trash2,
  Edit2,
  Plus,
  Search,
  Loader2,
  Code,
  Layers,
  GraduationCap,
  Route,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

export default function SubjectsPage() {
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/subjects' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ name: '', code: '', trackId: '' });

  const { data: tracksRes } = useQuery({
    queryKey: ['staff', 'tracks', 'for-subjects'],
    queryFn: async () => (await api.get('/staff/tracks?limit=100')).data,
  });
  const tracks = tracksRes?.data || [];

  const handleCreateOrUpdate = async () => {
    if (!form.name.trim()) { toast.error('Fan nomi kiritilishi shart'); return; }
    const payload: any = { name: form.name.trim(), code: form.code.trim() || undefined };
    if (form.trackId) payload.trackId = form.trackId;
    if (isEditing) {
      await update(selectedSubject.id, payload);
    } else {
      await create(payload);
    }
    setModalOpen(false);
  };

  const openCreate = () => {
    setForm({ name: '', code: '', trackId: '' });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (subject: any) => {
    setSelectedSubject(subject);
    setForm({
      name: subject.name,
      code: subject.code || '',
      trackId: subject.trackId ? String(subject.trackId) : '',
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fanlar boshqaruvi"
        description="Akademiyada o'qitiladigan barcha fanlar ro'yxati"
        action={{
          label: "Fan qo'shish",
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate,
        }}
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Fanlardan qidirish..."
            className="pl-10"
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookMarked className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Hali fanlar qo'shilmagan</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Fan qo'shish
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.map((subject: any) => {
            const trackColor = subject.track?.color;
            return (
              <Card
                key={subject.id}
                className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full shadow-sm"
                style={trackColor ? { borderTopColor: trackColor, borderTopWidth: 3 } : undefined}
              >
                <CardHeader className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                      <BookMarked className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(subject)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => { setSelectedSubject(subject); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-4 text-lg line-clamp-1">{subject.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                    {subject.code && (
                      <Badge variant="outline" className="text-[10px] font-mono leading-none py-0.5 border-orange-200 text-orange-700 bg-orange-50">
                        {subject.code}
                      </Badge>
                    )}
                    {subject.track && (
                      <Badge
                        variant="outline"
                        className="text-[10px] leading-none py-0.5"
                        style={trackColor ? { borderColor: trackColor, color: trackColor } : undefined}
                      >
                        <Route className="h-2.5 w-2.5 mr-1" />
                        {subject.track.name}
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-end">
                  <div className="pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>{subject.groupsCount ?? subject.groupCount ?? 0} guruh</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-primary" />
                      <span>{subject.lessonsCount ?? 0} dars</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={isEditing ? 'Fanni tahrirlash' : "Yangi fan qo'shish"}
        size="sm"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Yo'nalish (ixtiyoriy)</Label>
            <Select value={form.trackId} onValueChange={v => setForm({ ...form, trackId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Yo'nalish tanlang..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Yo'nalishsiz —</SelectItem>
                {tracks.map((t: any) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Fan qaysi yo'nalishga tegishli ekanligi</p>
          </div>

          <div className="space-y-2">
            <Label>Fan nomi *</Label>
            <Input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Masalan: Matematika"
            />
          </div>

          <div className="space-y-2">
            <Label>Kod (ixtiyoriy)</Label>
            <div className="relative">
              <Input
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="MASALAN: MATH-01"
                className="pl-9"
              />
              <Code className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground">Fanning qisqa kodi (identifikator)</p>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
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
        description="Ushbu fanni o'chirishga ishonchingiz komilmi? Bu amaldan so'ng ushbu fanga bog'langan barcha ma'lumotlar o'chib ketishi mumkin."
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => { if (selectedSubject) { await remove(selectedSubject.id); setDeleteOpen(false); } }}
      />
    </div>
  );
}
