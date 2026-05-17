import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const MIN_HOUR = 8;
const MAX_HOUR = 21;
const SLOT_PX = 80;
const TOTAL_HEIGHT = (MAX_HOUR - MIN_HOUR) * SLOT_PX;

function lessonPosition(startsAt: string, endsAt: string): { top: number; height: number } {
  if (!startsAt || !endsAt) return { top: 0, height: SLOT_PX };
  const startMin = timeToMinutes(startsAt);
  const endMin = timeToMinutes(endsAt);
  const top = (startMin / 60 - MIN_HOUR) * SLOT_PX;
  const height = Math.max(((endMin - startMin) / 60) * SLOT_PX, 36);
  return { top, height };
}

const WEEKDAYS = [
  { value: 1, label: 'Dushanba' },
  { value: 2, label: 'Seshanba' },
  { value: 3, label: 'Chorshanba' },
  { value: 4, label: 'Payshanba' },
  { value: 5, label: 'Juma' },
  { value: 6, label: 'Shanba' },
];

const HOUR_LABELS = Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }, (_, i) => i + MIN_HOUR);

export default function TimetablePage() {
  const {
    data: timetable,
    loading,
    create,
    remove,
    update,
    refetch: refetchTimetables,
  } = useCrud({ endpoint: '/staff/timetables' });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [selectedTimetableId, setSelectedTimetableId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get the currently selected timetable from the full list
  const selectedTimetable = selectedTimetableId 
    ? timetable?.find((t: any) => String(t.id) === selectedTimetableId)
    : null;

  // Fetch detailed timetable when one is selected
  const { 
    data: detailedTimetable, 
    isLoading: loadingDetails, 
    refetch: refetchDetails 
  } = useQuery({
    queryKey: ['staff', 'timetables', 'detail', selectedTimetableId],
    queryFn: async () => {
      if (!selectedTimetableId) return null;
      const res = await api.get(`/staff/timetables/${selectedTimetableId}`);
      return res.data;
    },
    enabled: !!selectedTimetableId,
  });

  const activeTimetable = detailedTimetable || selectedTimetable;
  const isLoading = loading || (selectedTimetableId && loadingDetails);

  const [form, setForm] = useState({
    dayOfWeek: 1,
    periodNo: 1,
    subjectId: '',
    teacherUserId: '',
    room: '',
    startsAt: '09:00',
    endsAt: '10:30',
  });

  const [timetableForm, setTimetableForm] = useState({
    name: '',
    groupId: '',
    academicYearId: '',
  });
  const [isCreatingTimetable, setIsCreatingTimetable] = useState(false);

  const { data: subjectsRes } = useQuery({
    queryKey: ['staff', 'subjects', 'for_timetable'],
    queryFn: async () => {
      const res = await api.get('/staff/subjects?limit=100');
      return res.data?.data || [];
    },
  });
  const subjects = subjectsRes || [];

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'for_timetable'],
    queryFn: async () => {
      const res = await api.get('/staff/groups?limit=100');
      return res.data?.data || [];
    },
  });
  const groups = groupsRes || [];

  const { data: academicYearsRes } = useQuery({
    queryKey: ['academic-years', 'for_timetable'],
    queryFn: async () => {
      const res = await api.get('/staff/academic-years?limit=100');
      return res.data?.data || [];
    },
  });
  const academicYears = academicYearsRes || [];

  const { data: teachersRes } = useQuery({
    queryKey: ['staff', 'users', 'teachers'],
    queryFn: async () => {
      const res = await api.get('/staff/users?limit=100');
      return res.data?.data || [];
    },
  });
  const teachers = teachersRes || [];

  const handleCreateOrUpdate = async () => {
    if (!form.subjectId || !form.startsAt || !form.endsAt) {
      toast.error("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    if (!selectedTimetable) {
      toast.error('Jadval tanlamayn turibdi');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        dayOfWeek: form.dayOfWeek,
        periodNo: form.periodNo,
        subjectId: form.subjectId,
        teacherUserId: form.teacherUserId === 'none' ? null : (form.teacherUserId || null),
        room: form.room || null,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      };

      if (isEditing && selectedSlot) {
        await api.patch(
          `/staff/timetables/${selectedTimetable.id}/lessons/${selectedSlot.id}`,
          payload,
        );
        toast.success('Dars muvaffaqiyatli yangilandi');
      } else {
        await api.post(`/staff/timetables/${selectedTimetable.id}/lessons`, payload);
        toast.success("Dars muvaffaqiyatli qo'shildi");
      }

      // Invalidate and refetch timetables
      await refetchTimetables();
      if (selectedTimetableId) {
        await refetchDetails();
      }

      setModalOpen(false);
      setForm({
        dayOfWeek: 1,
        periodNo: 1,
        subjectId: '',
        teacherUserId: '',
        room: '',
        startsAt: '09:00',
        endsAt: '10:30',
      });
      setIsEditing(false);
      setSelectedSlot(null);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Xatolik yuz berdi';
      toast.error(message);
      console.error('Error saving lesson:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateTimetable = async () => {
    if (!timetableForm.name.trim() || !timetableForm.groupId || !timetableForm.academicYearId) {
      toast.error("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: timetableForm.name.trim(),
        groupId: timetableForm.groupId,
        academicYearId: timetableForm.academicYearId,
      };

      if (selectedTimetable && selectedTimetable.id) {
        // Update existing timetable
        await api.patch(`/staff/timetables/${selectedTimetable.id}`, payload);
        toast.success('Jadval muvaffaqiyatli yangilandi');
      } else {
        // Create new timetable
        await create(payload);
        toast.success('Jadval muvaffaqiyatli yaratildi');
      }

      setTimetableForm({ name: '', groupId: '', academicYearId: '' });
      setIsCreatingTimetable(false);
      setSelectedTimetableId(null);
      setModalOpen(false);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Jadval yaratishda xatolik yuz berdi';
      toast.error(message);
      console.error('Error creating/updating timetable:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dars jadvali"
        description="Haftalik darslar va xonalar taqsimoti"
        action={{
          label: 'Jadval yaratish',
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setIsCreatingTimetable(true);
            setTimetableForm({ name: '', groupId: '', academicYearId: '' });
            setSelectedTimetableId(null);
            setModalOpen(true);
          },
        }}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 md:flex-none md:w-64">
            <Label htmlFor="tt-select" className="mb-2 block">
              Jadval tanlang
            </Label>
            <Select value={selectedTimetableId || ''} onValueChange={setSelectedTimetableId}>
              <SelectTrigger id="tt-select">
                <SelectValue placeholder="Jadvalni tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {timetable?.map((tt: any) => (
                  <SelectItem key={tt.id} value={String(tt.id)}>
                    {tt.name} • {tt.group?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex bg-muted p-1 rounded-lg">
            <Button
              variant={viewMode === 'GRID' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setViewMode('GRID')}
              disabled={!selectedTimetable}
            >
              Grid ko'rinishi
            </Button>
            <Button
              variant={viewMode === 'LIST' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8"
              onClick={() => setViewMode('LIST')}
              disabled={!selectedTimetable}
            >
              Ro'yxat
            </Button>
          </div>
        </div>

      {!activeTimetable && !isLoading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Jadvalni tanlang</p>
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        </div>
      ) : viewMode === 'GRID' && activeTimetable ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-card p-4">
            <div>
              <h3 className="text-lg font-bold">{activeTimetable.name}</h3>
              <p className="text-xs text-muted-foreground">
                {activeTimetable.groupName || activeTimetable.group?.name} • {activeTimetable.academicYearName || activeTimetable.academicYear?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{activeTimetable.lessons?.length || activeTimetable.lessonsCount || 0} dars</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setTimetableForm({
                    name: activeTimetable.name,
                    groupId: String(activeTimetable.groupId || ''),
                    academicYearId: String(activeTimetable.academicYearId || ''),
                  });
                  setIsCreatingTimetable(true);
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
                  setSelectedSlot(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

              <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
                <div className="min-w-[800px]">
                  {/* Header row */}
                  <div className="grid grid-cols-[72px_repeat(6,1fr)] border-b bg-muted/30 sticky top-0 z-20">
                    <div className="p-3 border-r" />
                    {WEEKDAYS.map((day) => (
                      <div key={day.value} className="p-3 text-center border-r last:border-r-0">
                        <span className="text-xs font-bold uppercase tracking-wider">{day.label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Timeline body */}
                  <div className="flex" style={{ height: TOTAL_HEIGHT }}>
                    {/* Time labels */}
                    <div className="w-[72px] shrink-0 relative border-r bg-muted/10">
                      {HOUR_LABELS.map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 flex items-start px-2 pt-0.5"
                          style={{ top: (hour - MIN_HOUR) * SLOT_PX }}
                        >
                          <span className="text-[10px] font-mono text-muted-foreground leading-none">
                            {String(hour).padStart(2, '0')}:00
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Day columns */}
                    {WEEKDAYS.map((day) => {
                      const dayLessons =
                        activeTimetable.lessons?.filter((l: any) => l.dayOfWeek === day.value) || [];
                      return (
                        <div
                          key={day.value}
                          className="flex-1 relative border-r last:border-r-0 group/col"
                          style={{ height: TOTAL_HEIGHT }}
                        >
                          {/* Hour grid lines */}
                          {HOUR_LABELS.map((hour, i) => (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 border-t border-border/40"
                              style={{ top: i * SLOT_PX }}
                            />
                          ))}
                          {/* Half-hour grid lines */}
                          {HOUR_LABELS.slice(0, -1).map((_, i) => (
                            <div
                              key={i}
                              className="absolute left-0 right-0 border-t border-dashed border-border/20"
                              style={{ top: i * SLOT_PX + SLOT_PX / 2 }}
                            />
                          ))}
                          {/* Lessons */}
                          {dayLessons.map((lesson: any) => {
                            const { top, height } = lessonPosition(lesson.startsAt, lesson.endsAt);
                            return (
                              <div
                                key={lesson.id}
                                className="absolute left-1 right-1 rounded-md border p-1.5 text-xs bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer group/lesson overflow-hidden z-10 transition-colors"
                                style={{ top, height }}
                                onClick={() => {
                                  setSelectedSlot(lesson);
                                  setForm({
                                    dayOfWeek: lesson.dayOfWeek,
                                    periodNo: lesson.periodNo,
                                    subjectId: String(lesson.subjectId || lesson.subject?.id || ''),
                                    teacherUserId: String(lesson.teacherUserId || lesson.teacherId || ''),
                                    room: lesson.room || '',
                                    startsAt: lesson.startsAt || '09:00',
                                    endsAt: lesson.endsAt || '10:30',
                                  });
                                  setIsEditing(true);
                                  setModalOpen(true);
                                }}
                              >
                                <div className="font-bold line-clamp-1 text-blue-900 dark:text-blue-100 pr-4">
                                  {lesson.subject?.name || 'Fan'}
                                </div>
                                <div className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                                  {lesson.teacherName || lesson.teacher?.name || 'Ustoz'}
                                </div>
                                <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {lesson.startsAt}–{lesson.endsAt}
                                </div>
                                <button
                                  className="absolute top-1 right-1 h-5 w-5 rounded bg-destructive/10 text-destructive items-center justify-center hidden group-hover/lesson:flex hover:bg-destructive hover:text-white transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSlot(lesson);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                          {/* Add button */}
                          <button
                            className="absolute bottom-2 right-2 h-6 w-6 rounded-full bg-primary/20 text-primary items-center justify-center hidden group-hover/col:flex hover:bg-primary hover:text-white z-10 transition-colors"
                            onClick={() => {
                              setForm({
                                dayOfWeek: day.value,
                                periodNo: 1,
                                subjectId: '',
                                teacherUserId: '',
                                room: '',
                                startsAt: '09:00',
                                endsAt: '',
                              });
                              setIsEditing(false);
                              setModalOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'LIST' && activeTimetable ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <div>
                  <h3 className="text-lg font-bold">{activeTimetable.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {activeTimetable.groupName || activeTimetable.group?.name} • {activeTimetable.academicYearName || activeTimetable.academicYear?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{activeTimetable.lessons?.length || activeTimetable.lessonsCount || 0} dars</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setTimetableForm({
                        name: activeTimetable.name,
                        groupId: String(activeTimetable.groupId || ''),
                        academicYearId: String(activeTimetable.academicYearId || ''),
                      });
                      setIsCreatingTimetable(true);
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
                      setSelectedSlot(null);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {activeTimetable.lessons?.length > 0 ? (
                <div className="space-y-2">
                  {activeTimetable.lessons.map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/50 group hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{lesson.subject?.name || 'Fan'}</p>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {lesson.teacherName || lesson.teacher?.name || 'Ustozsiz'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 inline mr-1" />
                          {WEEKDAYS.find((w) => w.value === lesson.dayOfWeek)?.label}{' '}
                          - {lesson.startsAt}-{lesson.endsAt}
                        </p>
                        {lesson.room && (
                          <p className="text-xs text-muted-foreground">Xona: {lesson.room}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedSlot(lesson);
                            setForm({
                              dayOfWeek: lesson.dayOfWeek,
                              periodNo: lesson.periodNo,
                              subjectId: String(lesson.subjectId || lesson.subject?.id || ''),
                              teacherUserId: String(lesson.teacherUserId || lesson.teacherId || ''),
                              room: lesson.room || '',
                              startsAt: lesson.startsAt || '09:00',
                              endsAt: lesson.endsAt || '10:30',
                            });
                            setIsEditing(true);
                            setModalOpen(true);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            setSelectedSlot(lesson);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">Hech qanday dars yo'q</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      {/* Form SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setIsCreatingTimetable(false);
            setIsEditing(false);
          }
        }}
        title={
          isCreatingTimetable
            ? selectedTimetable && selectedTimetable.id
              ? 'Jadvalni tahrirlash'
              : 'Jadval yaratish'
            : isEditing
              ? 'Darsni tahrirlash'
              : "Yangi dars qo'shish"
        }
        size="sm"
      >
        {isCreatingTimetable ? (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="tt-name">Jadval nomi *</Label>
              <Input
                id="tt-name"
                value={timetableForm.name}
                onChange={(e) => setTimetableForm({ ...timetableForm, name: e.target.value })}

                placeholder="Masalan: 10-A sinfi jadavali"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tt-group">Guruh *</Label>
              <Select
                value={timetableForm.groupId}
                onValueChange={(v) => setTimetableForm({ ...timetableForm, groupId: v })}
              >
                <SelectTrigger id="tt-group">
                  <SelectValue placeholder="Guruhni tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tt-ay">O'quv yili *</Label>
              <Select
                value={timetableForm.academicYearId}
                onValueChange={(v) => setTimetableForm({ ...timetableForm, academicYearId: v })}
              >
                <SelectTrigger id="tt-ay">
                  <SelectValue placeholder="O'quv yilini tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay: any) => (
                    <SelectItem key={ay.id} value={String(ay.id)}>
                      {ay.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  setModalOpen(false);
                  setIsCreatingTimetable(false);
                }}
                disabled={isSubmitting}
              >
                Bekor qilish
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleCreateTimetable}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saqlanyapti...
                  </>
                ) : selectedTimetable && selectedTimetable.id ? (
                  'Jadvalni yangilash'
                ) : (
                  'Jadval yaratish'
                )}
              </Button>
            </div>
          </div>
        ) : !selectedTimetable ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            Dars qo'shish uchun jadvalni tanlang
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="dayofweek">Hafta kuni *</Label>
              <Select
                value={String(form.dayOfWeek)}
                onValueChange={(v) => setForm({ ...form, dayOfWeek: parseInt(v, 10) })}
              >
                <SelectTrigger id="dayofweek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 1, label: 'Dushanba' },
                    { value: 2, label: 'Seshanba' },
                    { value: 3, label: 'Chorshanba' },
                    { value: 4, label: 'Payshanba' },
                    { value: 5, label: 'Juma' },
                    { value: 6, label: 'Shanba' },
                    { value: 7, label: 'Yakshanba' },
                  ].map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodo">Dars raqami (Periodo) *</Label>
              <Input
                id="periodo"
                type="number"
                min="1"
                value={form.periodNo}
                onChange={(e) => setForm({ ...form, periodNo: parseInt(e.target.value, 10) || 1 })}
                placeholder="1, 2, 3..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Fan *</Label>
              <Select
                value={form.subjectId}
                onValueChange={(v) => setForm({ ...form, subjectId: v })}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Fanni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starttime">Boshlanish vaqti</Label>
                <Input
                  id="starttime"
                  type="time"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endtime">Tugash vaqti</Label>
                <Input
                  id="endtime"
                  type="time"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room">Xona / Manzil</Label>
              <Input
                id="room"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="Masalan: 301-xona"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher">O'qituvchi</Label>
              <Select
                value={form.teacherUserId}
                onValueChange={(v) => setForm({ ...form, teacherUserId: v })}
              >
                <SelectTrigger id="teacher">
                  <SelectValue placeholder="O'qituvchini tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Biriktirilmagan</SelectItem>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Bekor qilish
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleCreateOrUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saqlanyapti...
                  </>
                ) : isEditing ? (
                  'Saqlash'
                ) : (
                  "Darsni qo'shish"
                )}
              </Button>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'chirish"
        description={
          selectedTimetable && !selectedSlot
            ? "Ushbu jadvalni va undagi barcha darslarni o'chirishga ishonchingiz komilmi?"
            : "Jadvaldagi ushbu darsni o'chirishga ishonchingiz komilmi?"
        }
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          try {
            if (selectedTimetable && !selectedSlot) {
              // Delete timetable
              await api.delete(`/staff/timetables/${selectedTimetable.id}`);
              toast.success("Jadval muvaffaqiyatli o'chirildi");
              await refetchTimetables();
              if (selectedTimetableId) {
                await refetchDetails();
              }
              setSelectedTimetableId(null);
            } else if (selectedSlot && selectedTimetable) {
              // Delete lesson
              await api.delete(
                `/staff/timetables/${selectedTimetable.id}/lessons/${selectedSlot.id}`,
              );
              toast.success("Dars muvaffaqiyatli o'chirildi");
              await refetchTimetables();
              if (selectedTimetableId) {
                await refetchDetails();
              }
            }

            setDeleteOpen(false);
            setSelectedSlot(null);
          } catch (error: any) {
            const message = error?.response?.data?.message || "O'chirishda xatolik yuz berdi";
            toast.error(message);
            console.error('Error deleting:', error);
          }
        }}
      />
    </div>
  );
}
