import { useState } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
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
  BedDouble,
  Plus,
  Trash2,
  Edit2,
  Users,
  MapPin,
  Loader2,
  DoorOpen,
  UserPlus,
  UserMinus,
  ChevronRight,
  CalendarDays,
  Hash,
  Shield,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import dayjs from 'dayjs';

const GENDER_POLICIES = [
  { value: 'MALE', label: 'Erkaklar' },
  { value: 'FEMALE', label: 'Ayollar' },
];

export default function DormsPage() {
  const queryClient = useQueryClient();
  const { data: dorms, loading, create, remove, update } = useCrud({ endpoint: '/staff/dorms' });

  // Panel state
  const [dormDetailOpen, setDormDetailOpen] = useState(false);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [dormFormOpen, setDormFormOpen] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRoomOpen, setDeleteRoomOpen] = useState(false);

  // Selected items
  const [selectedDorm, setSelectedDorm] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [editingDorm, setEditingDorm] = useState<any>(null);
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [deletingRoom, setDeletingRoom] = useState<any>(null);

  // Forms
  const [dormForm, setDormForm] = useState({
    name: '',
    description: '',
    isActive: true,
    campusId: '',
  });
  const [roomForm, setRoomForm] = useState({
    roomCode: '',
    capacity: '4',
    genderPolicy: 'MALE',
  });
  const [assignForm, setAssignForm] = useState({
    studentId: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: '',
    note: '',
  });

  // Queries
  const { data: campusesRes } = useQuery({
    queryKey: ['staff', 'campuses', 'list'],
    queryFn: async () => (await api.get('/staff/campuses?limit=200')).data,
  });
  const campuses = campusesRes?.data || [];

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'for-dorms'],
    queryFn: async () => (await api.get('/staff/students?limit=200&status=ACTIVE')).data,
  });
  const allStudents: any[] = studentsRes?.data || [];

  // Dorm detail (with rooms)
  const { data: dormDetailRes, isLoading: dormDetailLoading } = useQuery({
    queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id],
    queryFn: async () => (await api.get(`/staff/dorms/${selectedDorm.id}`)).data,
    enabled: !!selectedDorm?.id && dormDetailOpen,
  });
  const dormRooms: any[] = dormDetailRes?.rooms || dormDetailRes?.data?.rooms || [];

  // Room assignments
  const { data: assignmentsRes, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['staff', 'dorms', 'rooms', selectedRoom?.id, 'assignments'],
    queryFn: async () =>
      (await api.get(`/staff/dorms/rooms/${selectedRoom.id}/assignments`)).data,
    enabled: !!selectedRoom?.id && roomDetailOpen,
  });
  const assignments: any[] = assignmentsRes?.data || assignmentsRes || [];
  const activeAssignments = assignments.filter(
    (a: any) => !a.endDate || dayjs(a.endDate).isAfter(dayjs()),
  );

  // Mutations
  const createRoomMut = useMutation({
    mutationFn: async ({ dormId, body }: { dormId: string; body: any }) =>
      (await api.post(`/staff/dorms/${dormId}/rooms`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms'] });
      setRoomFormOpen(false);
      setEditingRoom(null);
      setRoomForm({ roomCode: '', capacity: '4', genderPolicy: 'MALE' });
      toast.success("Xona qo'shildi");
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const updateRoomMut = useMutation({
    mutationFn: async ({ roomId, body }: { roomId: string; body: any }) =>
      (await api.patch(`/staff/dorms/rooms/${roomId}`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms'] });
      setRoomFormOpen(false);
      setEditingRoom(null);
      setRoomForm({ roomCode: '', capacity: '4', genderPolicy: 'MALE' });
      toast.success('Xona yangilandi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const deleteRoomMut = useMutation({
    mutationFn: async ({ dormId, roomId }: { dormId: string; roomId: string }) =>
      (await api.delete(`/staff/dorms/${dormId}/rooms/${roomId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms'] });
      setDeleteRoomOpen(false);
      toast.success("Xona o'chirildi");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Xona o\'chirib bo\'lmadi (ichida o\'quvchilar bor)'),
  });

  const assignMut = useMutation({
    mutationFn: async ({ roomId, body }: { roomId: string; body: any }) =>
      (await api.post(`/staff/dorms/rooms/${roomId}/assignments`, body)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['staff', 'dorms', 'rooms', selectedRoom?.id, 'assignments'],
      });
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id] });
      setAssignFormOpen(false);
      setAssignForm({ studentId: '', startDate: dayjs().format('YYYY-MM-DD'), endDate: '', note: '' });
      toast.success("O'quvchi biriktirildi");
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Xatolik yuz berdi'),
  });

  const endAssignmentMut = useMutation({
    mutationFn: async ({ roomId, assignmentId }: { roomId: string; assignmentId: string }) =>
      (await api.patch(`/staff/dorms/rooms/${roomId}/assignments/${assignmentId}/end`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['staff', 'dorms', 'rooms', selectedRoom?.id, 'assignments'],
      });
      queryClient.invalidateQueries({ queryKey: ['staff', 'dorms', 'detail', selectedDorm?.id] });
      toast.success('Biriktirish yakunlandi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  // Helpers
  const occupiedStudentIds = new Set(
    activeAssignments.map((a: any) => String(a.studentId)),
  );
  const availableStudents = allStudents.filter((s: any) => {
    if (occupiedStudentIds.has(String(s.id))) return false;
    if (selectedRoom?.genderPolicy && selectedRoom.genderPolicy !== 'MIXED') {
      const gender = s.gender || s.sex;
      if (gender && gender !== selectedRoom.genderPolicy) return false;
    }
    return true;
  });

  const getRoomOccupancyColor = (current: number, capacity: number) => {
    const pct = capacity > 0 ? current / capacity : 0;
    if (pct >= 1) return 'text-red-600';
    if (pct >= 0.8) return 'text-amber-600';
    return 'text-green-600';
  };

  const handleCreateDorm = async () => {
    if (!dormForm.name.trim()) { toast.error('Nom kiriting'); return; }
    const payload: any = {
      name: dormForm.name.trim(),
      description: dormForm.description.trim() || undefined,
      campusId: dormForm.campusId || undefined,
      isActive: dormForm.isActive,
    };
    if (editingDorm) {
      await update(editingDorm.id, payload);
    } else {
      await create(payload);
    }
    setDormFormOpen(false);
  };

  const handleCreateRoom = () => {
    if (!roomForm.roomCode.trim()) { toast.error('Xona kodi kiriting'); return; }
    const capacity = parseInt(roomForm.capacity);
    if (!capacity || capacity < 1) { toast.error("Sig'im 1 dan kam bo'lmasin"); return; }
    const body = {
      roomCode: roomForm.roomCode.trim(),
      capacity,
      genderPolicy: roomForm.genderPolicy || undefined,
    };
    if (editingRoom) {
      updateRoomMut.mutate({ roomId: String(editingRoom.id), body });
    } else {
      createRoomMut.mutate({ dormId: selectedDorm.id, body });
    }
  };

  const handleAssign = () => {
    if (!assignForm.studentId) { toast.error("O'quvchini tanlang"); return; }
    if (selectedRoom?.genderPolicy && selectedRoom.genderPolicy !== 'MIXED') {
      const student = allStudents.find((s: any) => String(s.id) === String(assignForm.studentId));
      const gender = student?.gender || student?.sex;
      if (gender && gender !== selectedRoom.genderPolicy) {
        const policyLabel = GENDER_POLICIES.find((g) => g.value === selectedRoom.genderPolicy)?.label;
        toast.error(`Bu xona "${policyLabel}" uchun. Boshqa jins tanlayolmaysiz.`);
        return;
      }
    }
    const body: any = { studentId: assignForm.studentId };
    if (assignForm.startDate) body.startDate = assignForm.startDate;
    if (assignForm.endDate) body.endDate = assignForm.endDate;
    if (assignForm.note.trim()) body.note = assignForm.note.trim();
    assignMut.mutate({ roomId: selectedRoom.id, body });
  };

  const openDormDetail = (dorm: any) => {
    setSelectedDorm(dorm);
    setDormDetailOpen(true);
    setRoomDetailOpen(false);
    setSelectedRoom(null);
  };

  const openRoomDetail = (room: any) => {
    setSelectedRoom(room);
    setRoomDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yotoqxonalar boshqaruvi"
        description="Talabalar turar joylari, xonalar va joylashtirishlar"
        action={{
          label: "Yotoqxona qo'shish",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setEditingDorm(null);
            setDormForm({ name: '', description: '', isActive: true, campusId: '' });
            setDormFormOpen(true);
          },
        }}
      />

      {loading ? (
        <CardGridSkeleton cards={6} />
      ) : dorms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
          <BedDouble className="h-12 w-12 opacity-20" />
          <p className="text-sm">Yotoqxonalar topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dorms.map((dorm: any) => {
            const totalCap = dorm.totalCapacity || 0;
            const occupied = dorm.totalOccupancy || 0;
            const pct = totalCap > 0 ? Math.min(Math.round((occupied / totalCap) * 100), 100) : 0;

            return (
              <Card
                key={dorm.id}
                className="hover:border-primary/50 transition-all overflow-hidden flex flex-col"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex justify-between items-start">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <BedDouble className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingDorm(dorm);
                          setDormForm({
                            name: dorm.name || '',
                            description: dorm.description || '',
                            isActive: dorm.isActive ?? true,
                            campusId: dorm.campusId ? String(dorm.campusId) : '',
                          });
                          setDormFormOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => { setSelectedDorm(dorm); setDeleteOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-3 text-base">{dorm.name}</CardTitle>
                  {dorm.description && (
                    <CardDescription className="flex items-center gap-1 text-xs mt-1">
                      <MapPin className="h-3 w-3 flex-shrink-0" /> {dorm.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3 flex-1">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-lg font-bold">{dorm.roomsCount || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Xonalar</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-lg font-bold">{totalCap}</p>
                      <p className="text-[10px] text-muted-foreground">Sig'im</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className={cn('text-lg font-bold', getRoomOccupancyColor(occupied, totalCap))}>
                        {occupied}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Band</p>
                    </div>
                  </div>
                  {totalCap > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>To'lganlik</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn('h-2', pct >= 100 ? '[&>div]:bg-red-500' : pct >= 80 ? '[&>div]:bg-amber-500' : '')}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant={dorm.isActive ? 'default' : 'secondary'} className="text-[10px] h-5">
                      {dorm.isActive ? 'Faol' : 'Nofaol'}
                    </Badge>
                    {dorm.campusName && (
                      <span className="text-[10px] text-muted-foreground">{dorm.campusName}</span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => openDormDetail(dorm)}
                  >
                    <DoorOpen className="h-4 w-4" />
                    Xonalarni boshqarish
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dorm Create/Edit */}
      <SlideOver
        open={dormFormOpen}
        onOpenChange={setDormFormOpen}
        title={editingDorm ? 'Yotoqxonani tahrirlash' : "Yangi yotoqxona qo'shish"}
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Nomi <span className="text-destructive">*</span></Label>
            <Input
              value={dormForm.name}
              onChange={(e) => setDormForm({ ...dormForm, name: e.target.value })}
              placeholder="1-sonli Yotoqxona"
            />
          </div>
          <div className="space-y-2">
            <Label>Manzil / Tavsif</Label>
            <Input
              value={dormForm.description}
              onChange={(e) => setDormForm({ ...dormForm, description: e.target.value })}
              placeholder="B-blok, 2-qavat"
            />
          </div>
          {campuses.length > 0 && (
            <div className="space-y-2">
              <Label>Kampus</Label>
              <Select
                value={dormForm.campusId || '_none'}
                onValueChange={(v) => setDormForm({ ...dormForm, campusId: v === '_none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kampusni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Tanlanmagan</SelectItem>
                  {campuses.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Holati</Label>
            <Select
              value={dormForm.isActive ? 'ACTIVE' : 'INACTIVE'}
              onValueChange={(v) => setDormForm({ ...dormForm, isActive: v === 'ACTIVE' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Faol</SelectItem>
                <SelectItem value="INACTIVE">Nofaol</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row justify-end pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDormFormOpen(false)}>
              Bekor qilish
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateDorm}>
              {editingDorm ? 'Saqlash' : 'Yaratish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Dorm Detail (Rooms list) */}
      <SlideOver
        open={dormDetailOpen}
        onOpenChange={(open) => {
          setDormDetailOpen(open);
          if (!open) { setRoomDetailOpen(false); setSelectedRoom(null); }
        }}
        title={selectedDorm ? `${selectedDorm.name} — Xonalar` : 'Xonalar'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Room add button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {dormRooms.length > 0 ? `${dormRooms.length} ta xona` : 'Xonalar mavjud emas'}
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => {
                setEditingRoom(null);
                setRoomForm({ roomCode: '', capacity: '4', genderPolicy: 'MALE' });
                setRoomFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Xona qo'shish
            </Button>
          </div>

          {dormDetailLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            </div>
          ) : dormRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <DoorOpen className="h-12 w-12 opacity-20" />
              <p className="text-sm">Hali xona qo'shilmagan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dormRooms.map((room: any) => {
                const occ = room.currentOccupancy ?? 0;
                const cap = room.capacity ?? 0;
                const pct = cap > 0 ? Math.min(Math.round((occ / cap) * 100), 100) : 0;
                const isFull = occ >= cap;
                return (
                  <div
                    key={room.id}
                    className={cn(
                      'flex items-center gap-4 p-3 rounded-lg border bg-card hover:border-primary/50 transition-all cursor-pointer',
                      selectedRoom?.id === room.id && 'border-primary ring-1 ring-primary',
                    )}
                    onClick={() => openRoomDetail(room)}
                  >
                    <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                      <Hash className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{room.roomCode}</span>
                        {room.genderPolicy && room.genderPolicy !== 'MIXED' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                            <Shield className="h-2.5 w-2.5" />
                            {GENDER_POLICIES.find((g) => g.value === room.genderPolicy)?.label}
                          </Badge>
                        )}
                        {isFull && (
                          <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-none">
                            To'lgan
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {occ} / {cap} joy
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <Progress
                          value={pct}
                          className={cn(
                            'h-1.5',
                            isFull ? '[&>div]:bg-red-500' : pct >= 80 ? '[&>div]:bg-amber-500' : '',
                          )}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingRoom(room);
                          setRoomForm({
                            roomCode: room.roomCode || '',
                            capacity: String(room.capacity ?? 4),
                            genderPolicy: room.genderPolicy || 'MALE',
                          });
                          setRoomFormOpen(true);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingRoom(room);
                          setDeleteRoomOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SlideOver>

      {/* Room Detail (assignments) */}
      <SlideOver
        open={roomDetailOpen}
        onOpenChange={setRoomDetailOpen}
        title={
          selectedRoom
            ? `Xona ${selectedRoom.roomCode} — O'quvchilar`
            : "O'quvchilar"
        }
        size="md"
      >
        <div className="space-y-5">
          {/* Room info */}
          {selectedRoom && (
            <div className="flex items-center gap-4 p-3 bg-muted/40 rounded-lg text-sm">
              <div>
                <span className="font-semibold">Xona: {selectedRoom.roomCode}</span>
                <span className="text-muted-foreground ml-2">
                  ({selectedRoom.currentOccupancy ?? 0} / {selectedRoom.capacity} joy)
                </span>
              </div>
              {selectedRoom.genderPolicy && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {GENDER_POLICIES.find((g) => g.value === selectedRoom.genderPolicy)?.label}
                </Badge>
              )}
            </div>
          )}

          {/* Active occupants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Joriy o'quvchilar</h3>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setAssignForm({
                    studentId: '',
                    startDate: dayjs().format('YYYY-MM-DD'),
                    endDate: '',
                    note: '',
                  });
                  setAssignFormOpen(true);
                }}
                disabled={
                  selectedRoom &&
                  (selectedRoom.currentOccupancy ?? 0) >= (selectedRoom.capacity ?? 0)
                }
              >
                <UserPlus className="h-3.5 w-3.5" />
                O'quvchi qo'shish
              </Button>
            </div>

            {assignmentsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary opacity-50" />
              </div>
            ) : activeAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Users className="h-8 w-8 opacity-20" />
                <p className="text-sm">Bu xonada hozir o'quvchi yo'q</p>
              </div>
            ) : (
              <ScrollArea className="max-h-64 rounded-md border">
                <div className="p-2 space-y-1">
                  {activeAssignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.studentName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <CalendarDays className="h-3 w-3" />
                          {a.startDate ? dayjs(a.startDate).format('DD.MM.YYYY') : '—'}
                          {a.endDate && ` – ${dayjs(a.endDate).format('DD.MM.YYYY')}`}
                        </div>
                        {a.note && (
                          <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
                            {a.note}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive gap-1 flex-shrink-0"
                        onClick={() =>
                          endAssignmentMut.mutate({
                            roomId: String(selectedRoom.id),
                            assignmentId: String(a.id),
                          })
                        }
                        disabled={endAssignmentMut.isPending}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Chiqarish
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* History */}
          {assignments.filter((a: any) => a.endDate && dayjs(a.endDate).isBefore(dayjs())).length >
            0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                Tarix (sobiq o'quvchilar)
              </h3>
              <ScrollArea className="max-h-40 rounded-md border">
                <div className="p-2 space-y-1">
                  {assignments
                    .filter((a: any) => a.endDate && dayjs(a.endDate).isBefore(dayjs()))
                    .map((a: any) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{a.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.startDate ? dayjs(a.startDate).format('DD.MM.YYYY') : '—'} –{' '}
                            {a.endDate ? dayjs(a.endDate).format('DD.MM.YYYY') : '—'}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          Yakunlangan
                        </Badge>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Room Create/Edit Form */}
      <SlideOver
        open={roomFormOpen}
        onOpenChange={(open) => {
          setRoomFormOpen(open);
          if (!open) setEditingRoom(null);
        }}
        title={editingRoom ? 'Xonani tahrirlash' : "Yangi xona qo'shish"}
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Xona kodi <span className="text-destructive">*</span></Label>
            <Input
              value={roomForm.roomCode}
              onChange={(e) => setRoomForm({ ...roomForm, roomCode: e.target.value })}
              placeholder="101, A-12, ..."
            />
          </div>
          <div className="space-y-2">
            <Label>Sig'im (joylar soni) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={roomForm.capacity}
              onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Jins siyosati</Label>
            <Select
              value={roomForm.genderPolicy}
              onValueChange={(v) => setRoomForm({ ...roomForm, genderPolicy: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GENDER_POLICIES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row justify-end pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRoomFormOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleCreateRoom}
              disabled={createRoomMut.isPending || updateRoomMut.isPending}
            >
              {(createRoomMut.isPending || updateRoomMut.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {editingRoom ? 'Saqlash' : "Qo'shish"}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Student Assignment Form */}
      <SlideOver
        open={assignFormOpen}
        onOpenChange={setAssignFormOpen}
        title="O'quvchini xonaga biriktirish"
        size="sm"
      >
        <div className="space-y-5">
          {selectedRoom && (
            <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground">
              Xona: <span className="font-semibold text-foreground">{selectedRoom.roomCode}</span>
              {' '}({selectedRoom.currentOccupancy ?? 0}/{selectedRoom.capacity} joy band)
            </div>
          )}
          <div className="space-y-2">
            <Label>O'quvchi <span className="text-destructive">*</span></Label>
            <Select
              value={assignForm.studentId || '_none'}
              onValueChange={(v) => setAssignForm({ ...assignForm, studentId: v === '_none' ? '' : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="O'quvchini tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Tanlang...</SelectItem>
                {availableStudents.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.fullName || s.full_name}
                    {(s.groupName || s.group?.name) && (
                      <span className="text-muted-foreground ml-1">
                        · {s.groupName || s.group?.name}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kirish sanasi</Label>
              <Input
                type="date"
                value={assignForm.startDate}
                onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Chiqish sanasi</Label>
              <Input
                type="date"
                value={assignForm.endDate}
                onChange={(e) => setAssignForm({ ...assignForm, endDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Izoh</Label>
            <Input
              value={assignForm.note}
              onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
              placeholder="Ixtiyoriy izoh..."
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row justify-end pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAssignFormOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto gap-2"
              onClick={handleAssign}
              disabled={assignMut.isPending}
            >
              {assignMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Biriktirish
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Delete Dorm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Yotoqxonani o'chirish"
        description="Ushbu yotoqxonani o'chirishga ishonchingiz komilmi? Undagi barcha xonalar ham o'chirilishi mumkin."
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          await remove(selectedDorm.id);
          setDeleteOpen(false);
        }}
      />

      {/* Delete Room */}
      <ConfirmDialog
        open={deleteRoomOpen}
        onOpenChange={setDeleteRoomOpen}
        title="Xonani o'chirish"
        description={`Xona "${deletingRoom?.roomCode}" ni o'chirishga ishonchingiz komilmi? Ichida o'quvchilar bo'lsa o'chirib bo'lmaydi.`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={() => {
          if (!deletingRoom || !selectedDorm) return;
          deleteRoomMut.mutate({
            dormId: String(selectedDorm.id),
            roomId: String(deletingRoom.id),
          });
        }}
      />
    </div>
  );
}
