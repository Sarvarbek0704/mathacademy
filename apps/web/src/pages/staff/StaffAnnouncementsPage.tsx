import { useState } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Megaphone,
  Pencil,
  Trash2,
  Loader2,
  Send,
  Eye,
  Clock,
  User,
  Search,
  Plus,
  AlertCircle,
  CalendarDays,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';

export default function StaffAnnouncementsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [previewing, setPreviewing] = useState<any>(null);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({ title: '', body: '', audience: 'ALL' });

  // Fetch announcements
  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ['staff', 'announcements', 'all'],
    queryFn: async () => (await api.get('/staff/announcements')).data,
  });
  const announcements = (announcementsRes?.data || []).filter((a: any) => {
    const title = String(a.title || '').toLowerCase();
    const body = String(a.body || a.content || '').toLowerCase();
    const q = search.toLowerCase();
    return title.includes(q) || body.includes(q);
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/staff/announcements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'announcements'] });
      toast.success("E'lon muvaffaqiyatli chop etildi");
      setModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/staff/announcements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'announcements'] });
      toast.success("E'lon yangilandi");
      setModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'announcements'] });
      toast.success("E'lon o'chirildi");
      setDeleteOpen(false);
    },
  });

  const handleSubmit = () => {
    if (form.title.trim().length < 3) {
      toast.error('Sarlavha kamida 3 ta belgidan iborat bo‘lishi kerak');
      return;
    }
    if (form.body.trim().length < 3) {
      toast.error('Xabar matni kamida 3 ta belgidan iborat bo‘lishi kerak');
      return;
    }

    const payload = {
      audience: form.audience,
      title: form.title.trim(),
      body: form.body.trim(),
      isPublished: true,
    };

    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="E'lonlar va xabarlar"
        description="Akademiya miqyosidagi e'lonlarni boshqarish."
        action={{
          label: "Yangi e'lon",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setEditing(null);
            setForm({ title: '', body: '', audience: 'ALL' });
            setModalOpen(true);
          },
        }}
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="E'lonlardan qidirish..."
            className="pl-10"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {announcements.map((item: any) =>
            (() => {
              const audience = item.audience || item.type || 'ALL';
              return (
                <Card
                  key={item.id}
                  className="group hover:border-primary/50 transition-all flex flex-col h-full shadow-sm overflow-hidden border-l-4"
                  style={{
                    borderLeftColor:
                      audience === 'GUARDIANS'
                        ? 'hsl(var(--destructive))'
                        : audience === 'STAFF'
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted-foreground)/0.2)',
                  }}
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <Badge
                        variant={
                          audience === 'GUARDIANS'
                            ? 'destructive'
                            : audience === 'STAFF'
                              ? 'info'
                              : 'secondary'
                        }
                        className="text-[10px] px-2 h-5 font-bold tracking-wider"
                      >
                        {audience}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditing(item);
                            setForm({
                              title: item.title || '',
                              body: item.body || item.content || '',
                              audience,
                            });
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            setDeleting(item);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle
                      className="text-lg font-black leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
                      onClick={() => {
                        setPreviewing(item);
                        setPreviewOpen(true);
                      }}
                    >
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex-1">
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {item.body || item.content}
                    </p>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 mt-auto flex flex-col gap-3">
                    <div className="flex items-center justify-between w-full text-[11px] font-medium text-muted-foreground pt-4 border-t">
                      <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                        <User className="h-3.5 w-3.5" /> {item.authorName || "Ma'muriyat"}
                      </div>
                      <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                        <CalendarDays className="h-3.5 w-3.5" />{' '}
                        {new Date(item.publishedAt || item.createdAt).toLocaleDateString('uz')}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 group/btn"
                      onClick={() => {
                        setPreviewing(item);
                        setPreviewOpen(true);
                      }}
                    >
                      To'liq o'qish{' '}
                      <ChevronRight className="h-3 w-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })(),
          )}
          {announcements.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4 bg-muted/20 rounded-2xl border-2 border-dashed">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
              <p className="text-muted-foreground font-medium italic">E'lonlar topilmadi</p>
            </div>
          )}
        </div>
      )}

      {/* Editor SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "E'lonni tahrirlash" : "Yangi e'lon chop etish"}
        size="lg"
      >
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label>Sarlavha</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="E'lon sarlavhasini kiriting..."
              className="font-bold text-lg h-12"
            />
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> E'lon turi
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['ALL', 'STAFF', 'GUARDIANS', 'PUBLIC', 'DISPLAY'].map((t) => (
                <Button
                  key={t}
                  variant={form.audience === t ? 'default' : 'outline'}
                  size="sm"
                  className="text-[10px] h-9 font-bold tracking-widest"
                  onClick={() => setForm({ ...form, audience: t })}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Xabar matni</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="E'lon matnini batafsil yozing..."
              className="min-h-[350px] leading-relaxed resize-none text-base border-primary/10 focus:border-primary/30"
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 pt-6 border-t sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto h-11 px-8"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Send className="h-4 w-4 mr-2" /> {editing ? 'Saqlash' : 'Chop etish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Preview SlideOver */}
      <SlideOver
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="E'lon ko'rinishi"
        size="md"
      >
        {previewing && (
          <div className="space-y-6 pt-4">
            <div className="space-y-3">
              <Badge
                variant={
                  (previewing.audience || previewing.type) === 'GUARDIANS'
                    ? 'destructive'
                    : (previewing.audience || previewing.type) === 'STAFF'
                      ? 'info'
                      : 'secondary'
                }
                className="rounded-sm px-2 text-[10px] font-bold"
              >
                {previewing.audience || previewing.type || 'ALL'}
              </Badge>
              <h2 className="text-3xl font-black text-foreground leading-[1.1]">
                {previewing.title}
              </h2>
              <div className="flex items-center gap-6 text-[11px] text-muted-foreground font-bold uppercase tracking-tight pt-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />{' '}
                  {new Date(previewing.publishedAt || previewing.createdAt).toLocaleDateString(
                    'uz',
                    { month: 'long', day: 'numeric', year: 'numeric' },
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-primary" />{' '}
                  {previewing.authorName || "Ma'muriyat"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border-none shadow-sm bg-muted/30 p-8">
              <p className="whitespace-pre-wrap text-foreground/90 leading-[1.6] text-lg font-medium italic">
                "{previewing.body || previewing.content}"
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button variant="outline" className="px-10" onClick={() => setPreviewOpen(false)}>
                Yopish
              </Button>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="E'lonni o'chirish"
        description="Ushbu e'lonni butunlay o'chirib tashlamoqchimisiz? Bu amalni qaytarib bo'lmaydi."
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
