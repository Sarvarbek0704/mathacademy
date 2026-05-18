import { useState, useMemo } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  MapPin,
  Users,
  Trash2,
  Edit2,
  Plus,
  Search,
  Trophy,
  School,
  Loader2,
  Clock,
  UserPlus,
  UserMinus,
  Film,
  MoreHorizontal,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const EVENT_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  MOVIE_TIME: {
    label: 'Kino kechasi',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Film,
  },
  TOURNAMENT: {
    label: 'Musobaqa',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Trophy,
  },
  MEETING: {
    label: "Yig'ilish",
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Users,
  },
  OTHER: {
    label: 'Boshqa',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    icon: MoreHorizontal,
  },
};

export default function EventsPage() {
  const queryClient = useQueryClient();
  const { data: allEvents, loading, setSearch, create, remove, update } = useCrud({
    endpoint: '/staff/events',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [form, setForm] = useState({
    title: '',
    type: 'OTHER',
    startsAt: '',
    endsAt: '',
    description: '',
    campusId: '',
  });

  // Participants state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState('');

  // Students for participant selection
  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'for-events'],
    queryFn: async () => (await api.get('/staff/students?limit=200')).data,
  });
  const allStudents: any[] = studentsRes?.data || [];

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'for-events'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
  });
  const groups: any[] = groupsRes?.data || [];

  // Event detail (includes participants)
  const { data: eventDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['staff', 'events', 'detail', selectedEvent?.id],
    queryFn: async () => (await api.get(`/staff/events/${selectedEvent.id}`)).data,
    enabled: !!selectedEvent?.id && detailOpen,
  });

  const participants: any[] = eventDetail?.participants || [];

  const addParticipantsMut = useMutation({
    mutationFn: async ({ eventId, studentIds }: { eventId: string; studentIds: string[] }) =>
      (await api.post(`/staff/events/${eventId}/participants/add`, { studentIds })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'events', 'detail', selectedEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'events'] });
      setSelectedStudentIds([]);
      toast.success("Ishtirokchilar qo'shildi");
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const removeParticipantMut = useMutation({
    mutationFn: async ({ eventId, studentId }: { eventId: string; studentId: string }) =>
      (await api.delete(`/staff/events/${eventId}/participants?studentIds=${studentId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'events', 'detail', selectedEvent?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'events'] });
      toast.success("Ishtirokchi o'chirildi");
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (groupFilter) list = list.filter((s: any) => String(s.groupId || s.group?.id) === groupFilter);
    const participantIds = new Set(participants.map((p: any) => String(p.studentId)));
    return list.filter((s: any) => !participantIds.has(String(s.id)));
  }, [allStudents, groupFilter, participants]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === 'ALL') return allEvents;
    return allEvents.filter((e: any) => (e.eventType || e.type) === typeFilter);
  }, [allEvents, typeFilter]);

  const handleCreateOrUpdate = async () => {
    if (!form.title.trim()) {
      toast.error('Tadbir nomini kiriting');
      return;
    }
    const startsAt = new Date(form.startsAt);
    if (!form.startsAt || isNaN(startsAt.getTime())) {
      toast.error('Boshlanish vaqtini kiriting');
      return;
    }
    const payload: any = {
      title: form.title.trim(),
      eventType: form.type,
      startsAt: startsAt.toISOString(),
      description: form.description?.trim() || undefined,
    };
    if (form.endsAt) {
      const endsAt = new Date(form.endsAt);
      if (!isNaN(endsAt.getTime())) payload.endsAt = endsAt.toISOString();
    }
    if (form.campusId) payload.campusId = form.campusId;

    if (isEditing) {
      await update(selectedEvent.id, payload);
    } else {
      await create(payload);
    }
    setModalOpen(false);
    setIsEditing(false);
  };

  const openCreate = () => {
    setForm({
      title: '',
      type: 'OTHER',
      startsAt: dayjs().format('YYYY-MM-DDTHH:mm'),
      endsAt: dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm'),
      description: '',
      campusId: '',
    });
    setIsEditing(false);
    setModalOpen(true);
  };

  const openEdit = (event: any) => {
    setSelectedEvent(event);
    setForm({
      title: event.title,
      type: event.eventType || event.type || 'OTHER',
      startsAt: dayjs(event.startsAt).format('YYYY-MM-DDTHH:mm'),
      endsAt: event.endsAt ? dayjs(event.endsAt).format('YYYY-MM-DDTHH:mm') : '',
      description: event.description || '',
      campusId: String(event.campusId || ''),
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const openDetail = (event: any) => {
    setSelectedEvent(event);
    setSelectedStudentIds([]);
    setGroupFilter('');
    setDetailOpen(true);
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allEvents.length };
    allEvents.forEach((e: any) => {
      const t = e.eventType || e.type || 'OTHER';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [allEvents]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tadbirlar boshqaruvi"
        description="Akademiya tadbirlari, bayramlar va yig'ilishlarni rejalashtirish"
        action={{
          label: "Tadbir qo'shish",
          icon: <Plus className="h-4 w-4" />,
          onClick: openCreate,
        }}
      />

      {/* Search + Type filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tadbirlardan qidirish..."
            className="pl-10 h-10"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSearch(e.target.value);
            }}
          />
        </div>
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full sm:w-auto">
          <TabsList className="h-10">
            <TabsTrigger value="ALL" className="text-xs px-3">
              Hammasi
              <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
                {typeCounts.ALL || 0}
              </Badge>
            </TabsTrigger>
            {Object.entries(EVENT_TYPES).map(([key, info]) => (
              <TabsTrigger key={key} value={key} className="text-xs px-3">
                {info.label}
                {typeCounts[key] ? (
                  <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] px-1">
                    {typeCounts[key]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <CardGridSkeleton cards={6} />
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <Calendar className="h-12 w-12 opacity-20" />
          <p className="text-sm">Tadbirlar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event: any) => {
            const eventType = event.eventType || event.type;
            const typeInfo = EVENT_TYPES[eventType] || EVENT_TYPES.OTHER;
            const Icon = typeInfo.icon;
            const participantsCount = event.participantsCount ?? event._count?.participants ?? 0;
            return (
              <Card
                key={event.id}
                className="group hover:border-primary/50 transition-all flex flex-col h-full overflow-hidden"
              >
                <CardHeader className="p-5 pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn('px-2 py-0 h-5 text-[10px] font-bold border-none', typeInfo.color)}
                        variant="outline"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {typeInfo.label}
                      </Badge>
                      {participantsCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          <Users className="h-3 w-3 mr-1" />
                          {participantsCount}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(event)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => { setSelectedEvent(event); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base line-clamp-1">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {dayjs(event.startsAt).format('DD.MM.YYYY')}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {dayjs(event.startsAt).format('HH:mm')}
                      {event.endsAt && ` – ${dayjs(event.endsAt).format('HH:mm')}`}
                    </div>
                    {(event.campusName || event.location) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        {event.campusName || event.location}
                      </div>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic">
                      {event.description}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5"
                    onClick={() => openDetail(event)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Ishtirokchilar boshqaruvi
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Form SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={isEditing ? 'Tadbirni tahrirlash' : "Yangi tadbir qo'shish"}
        size="sm"
      >
        <div className="space-y-5">
          {isEditing && selectedEvent?.id && (
            <div className="space-y-2">
              <Label>Tadbir rasmi / banneri</Label>
              <div className="flex items-center gap-3">
                <AvatarUpload
                  ownerType="EVENT"
                  ownerId={String(selectedEvent.id)}
                  purpose="EVENT_COVER"
                  size="lg"
                  variant="banner"
                  currentUrl={selectedEvent.coverUrl || null}
                />
                <p className="text-xs text-muted-foreground">
                  Rasm yuklash uchun bosing.<br />JPG, PNG, WebP • maks 5MB
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tadbir nomi <span className="text-destructive">*</span></Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Navro'z bayrami"
            />
          </div>

          <div className="space-y-2">
            <Label>Turi</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPES).map(([val, info]) => (
                  <SelectItem key={val} value={val}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanish <span className="text-destructive">*</span></Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tugash</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>

          {groups.length > 0 && (
            <div className="space-y-2">
              <Label>Kampus</Label>
              <Input
                value={form.campusId}
                onChange={(e) => setForm({ ...form, campusId: e.target.value })}
                placeholder="Campus ID (ixtiyoriy)"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Tavsif</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tadbir haqida batafsil..."
              rows={3}
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-6 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              {isEditing ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Participants Detail SlideOver */}
      <SlideOver
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selectedEvent ? `${selectedEvent.title} — Ishtirokchilar` : 'Ishtirokchilar'}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Event meta */}
            {selectedEvent && (
              <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {dayjs(selectedEvent.startsAt).format('DD.MM.YYYY HH:mm')}
                </div>
                <Badge variant="secondary">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {participants.length} ishtirokchi
                </Badge>
              </div>
            )}

            {/* Current participants */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Joriy ishtirokchilar</h3>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Hali ishtirokchi qo'shilmagan</p>
              ) : (
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-2 space-y-1">
                    {participants.map((p: any) => (
                      <div
                        key={p.studentId}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{p.studentName}</p>
                          {p.groupName && (
                            <p className="text-xs text-muted-foreground">{p.groupName}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() =>
                            removeParticipantMut.mutate({
                              eventId: selectedEvent.id,
                              studentId: String(p.studentId),
                            })
                          }
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Add participants */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Ishtirokchi qo'shish</h3>
              <Select
                value={groupFilter || '_all'}
                onValueChange={(v) => setGroupFilter(v === '_all' ? '' : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Guruh bo'yicha filtr" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Barcha guruhlar</SelectItem>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ScrollArea className="h-48 rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      Barcha o'quvchilar qo'shilgan yoki topilmadi
                    </p>
                  ) : (
                    filteredStudents.map((s: any) => {
                      const sid = String(s.id);
                      const checked = selectedStudentIds.includes(sid);
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              if (val) setSelectedStudentIds((prev) => [...prev, sid]);
                              else setSelectedStudentIds((prev) => prev.filter((x) => x !== sid));
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {s.fullName || s.full_name}
                            </p>
                            {(s.groupName || s.group?.name) && (
                              <p className="text-xs text-muted-foreground">
                                {s.groupName || s.group?.name}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {selectedStudentIds.length > 0 && (
                <Button
                  className="w-full gap-2"
                  onClick={() =>
                    addParticipantsMut.mutate({
                      eventId: selectedEvent.id,
                      studentIds: selectedStudentIds,
                    })
                  }
                  disabled={addParticipantsMut.isPending}
                >
                  {addParticipantsMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {selectedStudentIds.length} ta o'quvchi qo'shish
                </Button>
              )}
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Tadbirni o'chirish"
        description="Ushbu tadbirni o'chirishga ishonchingiz komilmi? Bu amalni ortga qaytarib bo'lmaydi."
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          await remove(selectedEvent.id);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
