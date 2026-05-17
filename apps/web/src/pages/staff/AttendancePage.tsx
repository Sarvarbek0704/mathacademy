import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCrud } from '@/hooks/useCrud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus, UserCheck, Loader2, Search, Check, X, ShieldAlert, AlertCircle, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

const ATTENDANCE_STATUSES = [
  { id: 'PRESENT', label: 'Keldi', icon: Check, color: 'text-success bg-success/10 border-success/20' },
  { id: 'ABSENT', label: 'Kelmadi', icon: X, color: 'text-destructive bg-destructive/10 border-destructive/20' },
  { id: 'LATE', label: 'Kechikdi', icon: AlertCircle, color: 'text-warning bg-warning/10 border-warning/20' },
  { id: 'EXCUSED', label: 'Sababli', icon: ShieldAlert, color: 'text-info bg-info/10 border-info/20' },
];

interface AttendanceMark {
  studentId: string;
  studentName: string;
  status: string | null;
  note: string | null;
}

interface AttendanceSessionDetail {
  id: string;
  sessionDate: string;
  type: string;
  group: {
    id: string;
    name: string;
    grade: string;
  };
  attendance: AttendanceMark[];
  summary: {
    PRESENT: number;
    ABSENT: number;
    LATE: number;
    EXCUSED: number;
  };
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { data, loading, total, page, totalPages, setSearch, setPage, create } = useCrud({ endpoint: '/staff/attendance/sessions' });
  
  const [modalOpen, setModalOpen] = useState(false);
  const [markingOpen, setMarkingOpen] = useState(false);
  const [markingSession, setMarkingSession] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, { status: string, note: string }>>({});
  const [searchStudent, setSearchStudent] = useState('');
  
  const [form, setForm] = useState({ type: 'CLASS', sessionDate: '', groupId: '', note: '' });

  // Groups for session creation
  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
  });
  const groupsList = groupsRes?.data || [];

  // Timetable lessons for selected group+date
  const selectedDayOfWeek = form.sessionDate
    ? new Date(form.sessionDate).getDay() || 7 // Sunday=0 → 7, Mon=1..Sat=6
    : null;

  const { data: timetablesRes } = useQuery({
    queryKey: ['staff', 'timetables', 'for-group', form.groupId],
    queryFn: async () => (await api.get(`/staff/timetables?groupId=${form.groupId}&limit=5`)).data,
    enabled: !!form.groupId,
  });
  const activeTimetable = timetablesRes?.data?.[0] || timetablesRes?.[0];

  const todayLessons: any[] = (activeTimetable?.lessons || []).filter(
    (l: any) => l.dayOfWeek === selectedDayOfWeek,
  );

  // Session details for marking
  const { data: sessionDetail, isLoading: loadingMarks } = useQuery<AttendanceSessionDetail>({
    queryKey: ['staff', 'attendance', 'session', markingSession?.id],
    queryFn: async () => (await api.get(`/staff/attendance/sessions/${markingSession.id}`)).data,
    enabled: !!markingSession,
  });

  // Populate marks when session data loads
  useEffect(() => {
    if (!sessionDetail) return;
    const initialMarks: Record<string, { status: string; note: string }> = {};
    sessionDetail.attendance.forEach((a) => {
      initialMarks[a.studentId] = { status: a.status || '', note: a.note || '' };
    });
    setMarks(initialMarks);
    setSearchStudent('');
  }, [sessionDetail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertMarks = useMutation({
    mutationFn: (data: any) => api.post(`/staff/attendance/sessions/${markingSession.id}/marks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'attendance', 'session', markingSession.id] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'attendance', 'sessions'] });
      toast.success('Davomat saqlandi');
      setMarkingOpen(false);
    }
  });

  const handleMark = (studentId: string, status: string) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status: prev[studentId]?.status === status ? '' : status }
    }));
  };

  const handleSaveMarks = () => {
    const marksArray = Object.entries(marks)
      .filter(([_, data]) => data.status)
      .map(([studentId, data]) => ({
        studentId,
        status: data.status,
        note: data.note
      }));
    
    upsertMarks.mutate({ marks: marksArray });
  };

  const attendanceList = sessionDetail?.attendance || [];
  const filteredStudents = attendanceList.filter((s: any) => 
    s.studentName.toLowerCase().includes(searchStudent.toLowerCase())
  );

  const columns: Column<any>[] = [
    { key: 'sessionDate', title: 'Sana', render: (i) => i.sessionDate || i.session_date ? new Date(i.sessionDate || i.session_date).toLocaleDateString('uz') : '-' },
    { key: 'type', title: 'Turi', render: (i) => <StatusBadge status="ACTIVE" label={i.type === 'CLASS' ? 'Dars' : i.type === 'STUDY_HALL' ? 'O\'qish zali' : 'Tadbir'} /> },
    { key: 'group', title: 'Guruh', render: (i) => i.group?.name || '-' },
    { 
      key: 'statistics', title: 'Statistika', 
      render: (i) => (
        <div className="flex gap-1">
          <Badge variant="outline" className="text-success border-success/30 bg-success/5 font-bold">{(i.summary?.PRESENT || i.presentCount) ?? 0}</Badge>
          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 font-bold">{(i.summary?.ABSENT || i.absentCount) ?? 0}</Badge>
          <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 font-bold">{(i.summary?.LATE || i.lateCount) ?? 0}</Badge>
        </div>
      ) 
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Davomat boshqaruvi" description="Dars va tadbirlar uchun davomatlarni belgilang" action={{ label: 'Yangi sessiya', onClick: () => { setForm({ type: 'CLASS', sessionDate: new Date().toISOString().split('T')[0], groupId: '', note: '' }); setModalOpen(true); } }} />
      
      <DataTable 
        columns={columns} data={data} loading={loading} searchable onSearch={setSearch}
        pagination={{ page, totalPages, total, onPageChange: setPage }} 
        actions={(item) => (
          <Button variant="outline" size="sm" onClick={() => { setMarkingSession(item); setMarkingOpen(true); }} className="gap-2">
            <UserCheck className="h-4 w-4" /> Davomatni olish
          </Button>
        )}
      />

      {/* New Session SlideOver */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title="Yangi davomat sessiyasi" size="sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Sana</Label>
            <Input
              type="date"
              value={form.sessionDate}
              onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Guruh</Label>
            <Select value={form.groupId} onValueChange={(v) => setForm({ ...form, groupId: v })}>
              <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
              <SelectContent>
                {groupsList.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Scheduled lessons for this day */}
          {form.groupId && form.sessionDate && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Bugungi jadval darslar
              </p>
              {todayLessons.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Bu kunda rejalashtirilgan dars yo'q
                </p>
              ) : (
                <div className="space-y-1">
                  {todayLessons.map((l: any) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between text-xs bg-background border rounded px-2 py-1.5"
                    >
                      <div>
                        <span className="font-medium">{l.subject?.name || 'Fan'}</span>
                        <span className="text-muted-foreground ml-2">
                          {l.startsAt}–{l.endsAt}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setForm({ ...form, type: 'CLASS', note: `${l.subject?.name || 'Fan'} darsi` })}
                      >
                        Tanlash
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Turi</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CLASS">Dars</SelectItem>
                <SelectItem value="STUDY_HALL">O'qish zali</SelectItem>
                <SelectItem value="EVENT">Tadbir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Izoh (Ixtiyoriy)</Label>
            <Textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Sessiya haqida qisqacha ma'lumot"
              rows={2}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
            Bekor qilish
          </Button>
          <Button className="w-full sm:w-auto" onClick={async () => { await create(form); setModalOpen(false); }}>
            Yaratish
          </Button>
        </div>
      </SlideOver>

      {/* Attendance Marking SlideOver */}
      <SlideOver open={markingOpen} onOpenChange={setMarkingOpen} title="Davomatni belgilash" size="lg">
        {loadingMarks ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">O'quvchilar ro'yxati yuklanmoqda...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full -mx-6 px-6">
            <div className="sticky top-0 bg-background pt-2 pb-4 space-y-4 z-10 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{sessionDetail?.group?.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(sessionDetail?.sessionDate).toLocaleDateString('uz')} • {sessionDetail?.type === 'CLASS' ? 'Dars' : 'Tadbir'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <Check className="h-3 w-3 text-success" /> {Object.values(marks).filter(m => m.status === 'PRESENT').length}
                  </Badge>
                  <Badge variant="outline" className="gap-1.5 py-1">
                    <X className="h-3 w-3 text-destructive" /> {Object.values(marks).filter(m => m.status === 'ABSENT').length}
                  </Badge>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="O'quvchilarni qidirish..." 
                  className="pl-10" 
                  value={searchStudent}
                  onChange={e => setSearchStudent(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-2">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">O'quvchilar topilmadi</div>
              ) : (
                filteredStudents.map((s: any) => {
                  const currentStatus = marks[s.studentId]?.status;
                  return (
                    <Card key={s.studentId} className={cn("transition-all duration-200 border-l-4", 
                      currentStatus === 'PRESENT' ? 'border-l-success border-success/10 bg-success/5' :
                      currentStatus === 'ABSENT' ? 'border-l-destructive border-destructive/10 bg-destructive/5' :
                      currentStatus === 'LATE' ? 'border-l-warning border-warning/10 bg-warning/5' :
                      currentStatus === 'EXCUSED' ? 'border-l-info border-info/10 bg-info/5' :
                      'border-l-muted'
                    )}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0">
                            <span className="font-bold text-sm block truncate">{s.studentName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono">ID: {s.studentId}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ATTENDANCE_STATUSES.map(status => (
                              <Button
                                key={status.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleMark(s.studentId, status.id)}
                                className={cn(
                                  "h-8 px-2.5 gap-1.5 text-[11px] font-bold transition-all",
                                  currentStatus === status.id 
                                    ? status.color 
                                    : "bg-background hover:bg-muted text-muted-foreground"
                                )}
                              >
                                <status.icon className={cn("h-3.5 w-3.5", currentStatus === status.id ? "" : "opacity-40")} />
                                {status.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t mt-auto flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMarkingOpen(false)}>Bekor qilish</Button>
              <Button className="flex-1 gap-2" onClick={handleSaveMarks} disabled={upsertMarks.isPending}>
                {upsertMarks.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
