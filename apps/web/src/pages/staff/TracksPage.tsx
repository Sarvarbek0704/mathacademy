import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2,
  Edit2,
  Plus,
  Search,
  Loader2,
  Compass,
  Trophy,
  BookOpen,
  Star,
  Layers,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';

const TRACK_COLORS = [
  { label: 'Moviy', value: '#3B82F6', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
  { label: 'Yashil', value: '#10B981', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  { label: 'Binafsha', value: '#8B5CF6', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
  { label: "To'q sariq", value: '#F59E0B', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  { label: 'Qizil', value: '#EF4444', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
  { label: 'Pushti', value: '#EC4899', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' },
  { label: 'Tarvuz', value: '#14B8A6', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800' },
  { label: 'Jigarrang', value: '#F97316', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
];

function getColorMeta(colorValue?: string) {
  return TRACK_COLORS.find((c) => c.value === colorValue) || TRACK_COLORS[1];
}

const SUBJECT_ROLES = [
  { value: 'MAIN', label: 'Asosiy fan', desc: '30 savol × 3.1 ball = 93 ball', icon: Star },
  { value: 'SECONDARY', label: "Qo'shimcha fan", desc: '30 savol × 2.1 ball = 63 ball', icon: BookOpen },
  { value: 'MANDATORY', label: 'Majburiy fan', desc: '10 savol × 1.1 ball = 11 ball', icon: Layers },
];

function roleBadge(role: string) {
  if (role === 'MAIN') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[10px]">Asosiy</Badge>;
  if (role === 'SECONDARY') return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">Qo'shimcha</Badge>;
  return <Badge variant="outline" className="text-[10px]">Majburiy</Badge>;
}

export default function TracksPage() {
  const { data, loading, setSearch, create, remove, update, refetch } = useCrud({ endpoint: '/staff/tracks' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({ name: '', description: '', color: TRACK_COLORS[1].value });

  // Subject management state
  const [trackSubjects, setTrackSubjects] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [addSubjectId, setAddSubjectId] = useState('');
  const [addRole, setAddRole] = useState('MANDATORY');
  const [addingSubject, setAddingSubject] = useState(false);

  const fetchTrackSubjects = useCallback(async (trackId: string) => {
    setSubjectLoading(true);
    try {
      const [subjectsRes, allRes] = await Promise.all([
        api.get(`/staff/tracks/${trackId}/subjects`),
        api.get('/staff/subjects', { params: { limit: 200 } }),
      ]);
      setTrackSubjects((subjectsRes.data as any[]) || []);
      setAllSubjects(((allRes.data as any).data as any[]) || []);
    } catch {
      toast.error('Fanlarni yuklashda xato');
    } finally {
      setSubjectLoading(false);
    }
  }, []);

  const openSubjectsPanel = (track: any) => {
    setSelectedTrack(track);
    setAddSubjectId('');
    setAddRole('MANDATORY');
    setSubjectsOpen(true);
    fetchTrackSubjects(track.id);
  };

  const handleAddSubject = async () => {
    if (!addSubjectId || !selectedTrack) return;
    setAddingSubject(true);
    try {
      await api.post(`/staff/tracks/${selectedTrack.id}/subjects`, {
        subjectId: addSubjectId,
        role: addRole,
      });
      toast.success("Fan qo'shildi");
      setAddSubjectId('');
      fetchTrackSubjects(selectedTrack.id);
      refetch();
    } catch {
      toast.error("Fan qo'shishda xato");
    } finally {
      setAddingSubject(false);
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    if (!selectedTrack) return;
    try {
      await api.delete(`/staff/tracks/${selectedTrack.id}/subjects/${subjectId}`);
      toast.success("Fan olib tashlandi");
      fetchTrackSubjects(selectedTrack.id);
      refetch();
    } catch {
      toast.error("Fan olib tashlashda xato");
    }
  };

  const handleCreateOrUpdate = async () => {
    if (isEditing) {
      await update(selectedTrack.id, form);
    } else {
      await create(form);
    }
    setModalOpen(false);
  };

  const availableSubjects = allSubjects.filter(
    (s) => !trackSubjects.some((ts) => ts.subjectId === s.id),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yo'nalishlar"
        description="Akademiyadagi ta'lim yo'nalishlari va ixtisosliklar"
        action={{
          label: "Yo'nalish qo'shish",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ name: '', description: '', color: TRACK_COLORS[1].value });
            setIsEditing(false);
            setModalOpen(true);
          },
        }}
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Yo'nalishlardan qidirish..."
            className="pl-10"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((track: any) => {
            const colorMeta = getColorMeta(track.color);
            return (
              <Card
                key={track.id}
                className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full bg-card"
                style={{ borderTopColor: track.color || colorMeta.value, borderTopWidth: 3 }}
              >
                <CardHeader className="p-5">
                  <div className="flex justify-between items-start">
                    <div
                      className={`h-10 w-10 ${colorMeta.bg} rounded-lg flex items-center justify-center border ${colorMeta.border}`}
                    >
                      <Compass className={`h-6 w-6 ${colorMeta.text}`} />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Fanlarni boshqarish"
                        onClick={() => openSubjectsPanel(track)}
                      >
                        <BookOpen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedTrack(track);
                          setForm({
                            name: track.name,
                            description: track.description || '',
                            color: track.color || TRACK_COLORS[1].value,
                          });
                          setIsEditing(true);
                          setModalOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          setSelectedTrack(track);
                          setDeleteOpen(true);
                        }}
                      >
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
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                        Guruhlar
                      </span>
                      <span className="text-sm font-semibold">{track.groupCount || 0}</span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                        A'zolar
                      </span>
                      <span className="text-sm font-semibold">{track.studentCount || 0}</span>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                        Fanlar
                      </span>
                      <span className="text-sm font-semibold">{track.subjectCount || 0}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20">
                  <button
                    className={`flex items-center gap-1.5 text-[11px] font-medium ${colorMeta.text} hover:underline`}
                    onClick={() => openSubjectsPanel(track)}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Fanlarni boshqarish
                  </button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={isEditing ? "Yo'nalishni tahrirlash" : "Yangi yo'nalish qo'shish"}
        size="sm"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Yo'nalish nomi</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Masalan: SAT Intensive"
            />
          </div>

          <div className="space-y-2">
            <Label>Tavsifi</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Yo'nalish haqida batafsil ma'lumot..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Rang</Label>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${form.color === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tanlangan: {TRACK_COLORS.find((c) => c.value === form.color)?.label}
            </p>
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

      {/* Subject management panel */}
      <SlideOver
        open={subjectsOpen}
        onOpenChange={setSubjectsOpen}
        title={selectedTrack ? `${selectedTrack.name} — Fanlar` : 'Fanlar'}
        size="md"
      >
        <div className="space-y-6">
          {/* DTM info */}
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              DTM Blok test tizimi
            </p>
            {SUBJECT_ROLES.map((r) => (
              <div key={r.value} className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <r.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{r.label}:</span>
                <span>{r.desc}</span>
              </div>
            ))}
            <p className="text-[10px] text-amber-600 dark:text-amber-500 pt-1 border-t border-amber-200 dark:border-amber-800">
              Jami: 93 + 63 + 11×3 = 189 ball
            </p>
          </div>

          {/* Add subject form */}
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <p className="text-sm font-semibold">Fan qo'shish</p>
            <div className="space-y-2">
              <Label className="text-xs">Fan</Label>
              <Select value={addSubjectId} onValueChange={setAddSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Fan tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </SelectItem>
                  ))}
                  {availableSubjects.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Barcha fanlar qo'shilgan
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Rol (DTM)</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!addSubjectId || addingSubject}
              onClick={handleAddSubject}
            >
              {addingSubject ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Qo'shish
            </Button>
          </div>

          {/* Current subjects */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Joriy fanlar</p>
            {subjectLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
              </div>
            ) : trackSubjects.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Hech qanday fan qo'shilmagan
              </p>
            ) : (
              <div className="space-y-2">
                {['MAIN', 'SECONDARY', 'MANDATORY'].map((roleKey) => {
                  const subjects = trackSubjects.filter((ts) => ts.role === roleKey);
                  if (subjects.length === 0) return null;
                  return (
                    <div key={roleKey}>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                        {SUBJECT_ROLES.find((r) => r.value === roleKey)?.label}
                      </p>
                      {subjects.map((ts: any) => (
                        <div
                          key={ts.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border mb-1"
                        >
                          <div className="flex items-center gap-2">
                            {roleBadge(ts.role)}
                            <span className="text-sm font-medium">{ts.name}</span>
                            {ts.code && (
                              <span className="text-[10px] text-muted-foreground">({ts.code})</span>
                            )}
                          </div>
                          <button
                            className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => handleRemoveSubject(ts.subjectId)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
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
        onConfirm={async () => {
          if (selectedTrack) {
            await remove(selectedTrack.id);
            setDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
