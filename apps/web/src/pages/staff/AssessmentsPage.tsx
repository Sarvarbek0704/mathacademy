import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
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
  Pencil,
  Trash2,
  GraduationCap,
  Loader2,
  Save,
  Send,
  Check,
  X,
  Search,
  Eye,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

interface AssessmentScoreRow {
  studentId: string;
  studentName: string;
  score: number | null;
  teacherComment: string | null;
}

interface AssessmentDetail {
  id: string;
  title: string;
  type: string;
  maxScore: number;
  isPublished: boolean;
  group: { id: string; name: string; trackId?: string };
  scores: AssessmentScoreRow[];
}

interface BlockRow {
  main: string;
  secondary: string;
  m1: string;
  m2: string;
  m3: string;
}

function calcDtmTotal(b: BlockRow): number {
  const main = parseFloat(b.main) || 0;
  const secondary = parseFloat(b.secondary) || 0;
  const m1 = parseFloat(b.m1) || 0;
  const m2 = parseFloat(b.m2) || 0;
  const m3 = parseFloat(b.m3) || 0;
  return Math.round((main * 3.1 + secondary * 2.1 + (m1 + m2 + m3) * 1.1) * 10) / 10;
}

export default function AssessmentsPage() {
  const queryClient = useQueryClient();
  const { data, loading, total, page, totalPages, setSearch, setPage, create, update, remove } =
    useCrud({ endpoint: '/staff/assessments' });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [scoringOpen, setScoringOpen] = useState(false);

  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [scoringAssessment, setScoringAssessment] = useState<any>(null);

  const [localScores, setLocalScores] = useState<
    Record<string, { score: string; comment: string }>
  >({});
  const [blockScores, setBlockScores] = useState<Record<string, BlockRow>>({});
  const [searchStudent, setSearchStudent] = useState('');

  const [form, setForm] = useState({
    title: '',
    type: 'WEEKLY_TEST',
    maxScore: '100',
    weight: '1',
    heldAt: '',
    groupId: '',
    subjectId: '',
    publishToGuardians: false,
    description: '',
  });

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
  });
  const groupsList = groupsRes?.data || [];

  const { data: subjectsRes } = useQuery({
    queryKey: ['staff', 'subjects'],
    queryFn: async () => (await api.get('/staff/subjects?limit=100')).data,
  });
  const subjectsList = subjectsRes?.data || [];

  // Fetch selected group detail (for subjects list)
  const { data: selectedGroupRes } = useQuery({
    queryKey: ['staff', 'groups', form.groupId, 'detail'],
    queryFn: async () => (await api.get(`/staff/groups/${form.groupId}`)).data,
    enabled: !!form.groupId,
  });
  const selectedGroup = selectedGroupRes?.data || selectedGroupRes;
  // detail() returns snake_case track_id; list() returns camelCase trackId — handle both
  const formGroupTrackId = (
    selectedGroup?.trackId || selectedGroup?.track_id
  )?.toString() || '';

  // Subjects come from group_subjects junction — available for any group
  const availableSubjects: any[] = (selectedGroup?.subjects || []).filter((s: any) => s?.id);

  // Fetch active timetable for the selected group (only when creating new assessment)
  const { data: timetablesRes } = useQuery({
    queryKey: ['staff', 'timetables', 'by-group', form.groupId],
    queryFn: async () => (await api.get(`/staff/timetables?groupId=${form.groupId}&limit=5`)).data,
    enabled: !!form.groupId && modalOpen && !editing,
  });
  const activeTimetableId = timetablesRes?.data?.[0]?.id;

  // Fetch timetable detail (with lessons) when we have a timetable ID
  const { data: timetableDetailRes } = useQuery({
    queryKey: ['staff', 'timetables', 'detail', activeTimetableId],
    queryFn: async () => (await api.get(`/staff/timetables/${activeTimetableId}`)).data,
    enabled: !!activeTimetableId && modalOpen && !editing,
  });
  const allTimetableLessons: any[] = timetableDetailRes?.lessons || [];

  // Day of week from selected date (1=Mon..6=Sat, 7=Sun)
  const selectedDow = useMemo(() => {
    if (!form.heldAt) return null;
    const d = new Date(form.heldAt);
    if (isNaN(d.getTime())) return null;
    const jsDay = d.getDay();
    return jsDay === 0 ? 7 : jsDay;
  }, [form.heldAt]);

  const DOW_NAMES: Record<number, string> = {
    1: 'Dushanba', 2: 'Seshanba', 3: 'Chorshanba',
    4: 'Payshanba', 5: 'Juma', 6: 'Shanba', 7: 'Yakshanba',
  };

  const lessonsOnDay = useMemo(() => {
    if (!selectedDow || !allTimetableLessons.length) return [];
    return allTimetableLessons.filter((l: any) => l.dayOfWeek === selectedDow);
  }, [selectedDow, allTimetableLessons]);

  const canCreateAssessment = editing || !activeTimetableId || lessonsOnDay.length > 0;

  const isBlockTest = scoringAssessment?.type === 'BLOCK_TEST';

  // Fetch Assessment details (including scores)
  const { data: detail, isLoading: loadingDetail } = useQuery<AssessmentDetail>({
    queryKey: ['staff', 'assessments', 'detail', scoringAssessment?.id],
    queryFn: async () => (await api.get(`/staff/assessments/${scoringAssessment.id}`)).data,
    enabled: !!scoringAssessment,
  });

  // For BLOCK_TEST: fetch group detail to get group subjects for column headers
  const { data: scoringGroupRes } = useQuery({
    queryKey: ['staff', 'groups', 'detail', detail?.group?.id],
    queryFn: async () => (await api.get(`/staff/groups/${detail!.group.id}`)).data,
    enabled: !!detail?.group?.id && isBlockTest,
  });
  const scoringGroupSubjects: any[] = (scoringGroupRes?.data || scoringGroupRes)?.subjects || [];
  // Map group subjects to block-test column roles by index
  const mainSubject = scoringGroupSubjects[0];
  const secondarySubject = scoringGroupSubjects[1];
  const mandatorySubjects = scoringGroupSubjects.slice(2, 5);

  // Fetch all students in the group to ensure we can score everyone
  const { data: groupStudentsRes } = useQuery({
    queryKey: ['staff', 'groups', detail?.group?.id, 'students'],
    queryFn: async () =>
      (await api.get(`/staff/students?groupId=${detail?.group?.id}&status=ACTIVE&limit=200`)).data,
    enabled: !!detail?.group?.id,
  });
  const groupStudents = groupStudentsRes?.data || [];
  const validGroupStudentIds = new Set(
    groupStudents.map((s: any) => String(s.id ?? '')).filter(Boolean),
  );

  // Sync details to local state
  const [lastId, setLastId] = useState<string | null>(null);
  if (detail && detail.id !== lastId) {
    const initial: any = {};
    const blockInit: Record<string, BlockRow> = {};
    (detail.scores ?? []).forEach((s) => {
      initial[s.studentId] = { score: String(s.score ?? ''), comment: s.teacherComment || '' };
      if (s.teacherComment) {
        try {
          const parsed = JSON.parse(s.teacherComment);
          if (parsed && typeof parsed === 'object' && 'main' in parsed) {
            blockInit[s.studentId] = {
              main: String(parsed.main ?? ''),
              secondary: String(parsed.secondary ?? ''),
              m1: String(parsed.m1 ?? ''),
              m2: String(parsed.m2 ?? ''),
              m3: String(parsed.m3 ?? ''),
            };
          }
        } catch {}
      }
    });
    setLocalScores(initial);
    setBlockScores(blockInit);
    setLastId(detail.id);
  }

  const upsertScoresMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post(`/staff/assessments/${scoringAssessment.id}/scores`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'assessments'] });
      queryClient.invalidateQueries({
        queryKey: ['staff', 'assessments', 'detail', scoringAssessment.id],
      });
      toast.success('Ballar saqlandi');
      setScoringOpen(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: (publish: boolean) =>
      api.patch(`/staff/assessments/${scoringAssessment.id}/publish`, { publish }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'assessments'] });
      queryClient.invalidateQueries({
        queryKey: ['staff', 'assessments', 'detail', scoringAssessment.id],
      });
      toast.success(res.data.isPublished ? "Natijalar e'lon qilindi" : "E'lon bekor qilindi");
    },
  });

  const handleScoreChange = (studentId: string, value: string) => {
    // Validate score doesn't exceed maxScore
    const num = parseFloat(value);
    if (!isNaN(num) && detail && num > detail.maxScore) {
      toast.error(`Ball maksimal balldan (${detail.maxScore}) oshmasligi kerak`);
      return;
    }
    setLocalScores((prev) => ({ ...prev, [studentId]: { ...prev[studentId], score: value } }));
  };

  const handleSaveScores = () => {
    let scoresArray: any[];

    if (isBlockTest) {
      const EMPTY: BlockRow = { main: '', secondary: '', m1: '', m2: '', m3: '' };
      scoresArray = displayStudents
        .map((s: any) => {
          const b = blockScores[s.id] || EMPTY;
          const total = calcDtmTotal(b);
          if (total === 0) return null;
          return {
            studentId: s.id,
            score: total,
            teacherComment: JSON.stringify({
              main: parseFloat(b.main) || 0,
              secondary: parseFloat(b.secondary) || 0,
              m1: parseFloat(b.m1) || 0,
              m2: parseFloat(b.m2) || 0,
              m3: parseFloat(b.m3) || 0,
            }),
          };
        })
        .filter(Boolean);
    } else {
      scoresArray = Object.entries(localScores)
        .filter(([studentId, data]) => data.score !== '' && validGroupStudentIds.has(studentId))
        .map(([studentId, data]) => ({
          studentId,
          score: parseFloat(data.score),
          teacherComment: data.comment,
        }));
    }

    if (scoresArray.length === 0) {
      toast.warning("Saqlash uchun kamida 1 ta o'quvchiga ball kiriting");
      return;
    }

    upsertScoresMutation.mutate({ scores: scoresArray });
  };

  const typeLabels: Record<string, string> = {
    WEEKLY_TEST: 'Haftalik test',
    BLOCK_TEST: 'Blok test',
    WRITTEN: 'Yozma',
    CONTROL: 'Nazorat',
    MOCK: 'Sinov',
  };

  const columns: Column<any>[] = [
    { key: 'title', title: 'Nomi', render: (i) => <span className="font-medium">{i.title}</span> },
    {
      key: 'type',
      title: 'Turi',
      render: (i) => <StatusBadge status="ACTIVE" label={typeLabels[i.type] || i.type} />,
    },
    { key: 'group', title: 'Guruh', render: (i) => i.group?.name || '-' },
    { key: 'subject', title: 'Fan', render: (i) => i.subject?.name || '-' },
    {
      key: 'scoresCount',
      title: 'Natijalar',
      render: (i) => (
        <Badge variant="secondary" className="font-bold">
          {i.scoresCount ?? 0} / {i.groupSize || '-'}
        </Badge>
      ),
    },
    {
      key: 'isPublished',
      title: 'Holat',
      render: (i) =>
        i.isPublished ? (
          <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 gap-1">
            <Send className="h-3 w-3" /> E'lon qilingan
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Eye className="h-3 w-3" /> Qoralama
          </Badge>
        ),
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      type: 'WEEKLY_TEST',
      maxScore: '100',
      weight: '1',
      heldAt: new Date().toISOString().substring(0, 16),
      groupId: '',
      subjectId: '',
      publishToGuardians: false,
      description: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      title: item.title,
      type: item.type,
      maxScore: String(item.maxScore || 100),
      weight: String(item.weight || 1),
      heldAt: item.heldAt ? new Date(item.heldAt).toISOString().substring(0, 16) : '',
      groupId: String(item.groupId || item.group_id || ''),
      subjectId: String(item.subjectId || item.subject_id || ''),
      publishToGuardians: item.publishToGuardians || item.publish_to_guardians || false,
      description: item.description || '',
    });
    setModalOpen(true);
  };

  // Merge group students with existing scores for the list
  const normalizedStudentSearch = String(searchStudent ?? '').toLowerCase();
  const displayStudents = (Array.isArray(groupStudents) ? groupStudents : [])
    .map((s: any) => {
      const studentId = String(s?.id ?? '');
      const studentName = String(s?.fullName ?? s?.full_name ?? s?.studentName ?? s?.name ?? '');
      const existing = (detail?.scores ?? []).find((sc) => String(sc.studentId) === studentId);

      return {
        id: studentId,
        name: studentName,
        score: localScores[studentId]?.score || '',
        comment: localScores[studentId]?.comment || '',
        isNew: !existing,
      };
    })
    .filter((s: any) =>
      String(s?.name ?? '')
        .toLowerCase()
        .includes(normalizedStudentSearch),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Testlar va baholash"
        description="Barcha baholash turlari"
        action={{ label: 'Yangi test', onClick: openCreate }}
      />
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        searchable
        onSearch={setSearch}
        pagination={{ page, totalPages, total, onPageChange: setPage }}
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScoringAssessment(item);
                setBlockScores({});
                setLocalScores({});
                setLastId(null);
                setScoringOpen(true);
              }}
              className="gap-2"
            >
              <GraduationCap className="h-4 w-4" /> Kirish
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDeleting(item);
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Scoring SlideOver */}
      <SlideOver
        open={scoringOpen}
        onOpenChange={setScoringOpen}
        title={isBlockTest ? 'Blok test — DTM natijalarini kiritish' : 'Natijalarni kiritish'}
        size="xl"
      >
        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">O'quvchilar va natijalar yuklanmoqda...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full -mx-6 px-6">
            <div className="sticky top-0 bg-background pt-2 pb-4 space-y-4 z-10 border-b">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-4">
                  <h3 className="font-bold text-lg truncate">{detail?.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {detail?.group?.name} • Maksimal ball:{' '}
                    <span className="font-bold text-primary">{detail?.maxScore}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Ota-onalarga
                    </span>
                    <Switch
                      checked={detail?.isPublished}
                      onCheckedChange={(c) => publishMutation.mutate(c)}
                      disabled={publishMutation.isPending}
                    />
                  </div>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="O'quvchilarni qidirish..."
                  className="pl-10"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                />
              </div>
            </div>

            {isBlockTest ? (
              <div className="flex-1 overflow-y-auto py-3">
                {/* DTM info banner */}
                <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-700 dark:text-amber-400 flex flex-wrap gap-3">
                  <span>Asosiy ×3.1 (maks 93)</span>
                  <span>Qo'shimcha ×2.1 (maks 63)</span>
                  <span>Majburiy ×1.1 (maks 11×3=33)</span>
                  <span className="font-black">Jami: 189 ball</span>
                </div>
                {/* Column headers + student rows — scrollable on small screens */}
                <div className="overflow-x-auto -mx-1">
                <div className="min-w-[560px] px-1">
                <div className="grid gap-1 items-center bg-muted/60 rounded-lg px-2 py-2 mb-2 text-[10px] font-bold uppercase tracking-tight text-muted-foreground"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 0.8fr' }}>
                  <div>O'quvchi</div>
                  <div className="text-center truncate" title={mainSubject?.name}>{mainSubject?.name || 'Asosiy'}<br/><span className="font-normal normal-case">/30</span></div>
                  <div className="text-center truncate" title={secondarySubject?.name}>{secondarySubject?.name || "Qo'shimcha"}<br/><span className="font-normal normal-case">/30</span></div>
                  <div className="text-center truncate" title={mandatorySubjects[0]?.name}>{mandatorySubjects[0]?.name || 'Maj.1'}<br/><span className="font-normal normal-case">/10</span></div>
                  <div className="text-center truncate" title={mandatorySubjects[1]?.name}>{mandatorySubjects[1]?.name || 'Maj.2'}<br/><span className="font-normal normal-case">/10</span></div>
                  <div className="text-center truncate" title={mandatorySubjects[2]?.name}>{mandatorySubjects[2]?.name || 'Maj.3'}<br/><span className="font-normal normal-case">/10</span></div>
                  <div className="text-center text-primary font-black">/189</div>
                </div>
                {/* Student rows */}
                <div className="space-y-1">
                  {displayStudents.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">O'quvchilar topilmadi</div>
                  ) : displayStudents.map((s: any) => {
                    const EMPTY: BlockRow = { main: '', secondary: '', m1: '', m2: '', m3: '' };
                    const b = blockScores[s.id] || EMPTY;
                    const total = calcDtmTotal(b);
                    const hasAny = b.main || b.secondary || b.m1 || b.m2 || b.m3;
                    const setBlock = (field: keyof BlockRow, value: string) =>
                      setBlockScores((prev) => ({
                        ...prev,
                        [s.id]: { ...(prev[s.id] || EMPTY), [field]: value },
                      }));
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          'grid gap-1 items-center rounded-lg px-2 py-1.5 transition-colors',
                          hasAny ? 'bg-primary/5 border border-primary/20' : 'border border-transparent hover:bg-muted/40',
                        )}
                        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 0.8fr' }}
                      >
                        <span className="text-sm font-medium truncate pr-1">{s.name}</span>
                        {(['main', 'secondary', 'm1', 'm2', 'm3'] as (keyof BlockRow)[]).map((field, idx) => (
                          <Input
                            key={field}
                            type="number"
                            min="0"
                            max={idx < 2 ? 30 : 10}
                            placeholder="0"
                            className="h-8 text-center px-1 text-sm font-bold"
                            value={b[field]}
                            onChange={(e) => setBlock(field, e.target.value)}
                          />
                        ))}
                        <div className={cn('text-center font-black text-sm tabular-nums', total > 0 ? 'text-primary' : 'text-muted-foreground/40')}>
                          {total > 0 ? total : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {displayStudents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">O'quvchilar topilmadi</div>
                ) : (
                  displayStudents.map((s: any) => (
                    <Card
                      key={s.id}
                      className={cn(
                        'transition-all duration-200',
                        s.score ? 'border-primary/20 bg-primary/5' : 'border-muted',
                      )}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm block truncate">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono">
                              ID: {s.id}
                            </span>
                          </div>
                          <div className="flex gap-3 w-full md:w-auto">
                            <div className="flex-1 md:w-28 relative">
                              <Input
                                type="number"
                                placeholder="0"
                                className="text-center font-bold h-9"
                                value={s.score}
                                onChange={(e) => handleScoreChange(s.id, e.target.value)}
                              />
                              <div className="absolute -top-6 right-0 text-[10px] text-muted-foreground">
                                Ball / {detail?.maxScore}
                              </div>
                            </div>
                            <div className="flex-[2] md:w-60">
                              <Input
                                placeholder="Izoh..."
                                className="h-9 text-xs"
                                value={s.comment}
                                onChange={(e) =>
                                  setLocalScores((prev) => ({
                                    ...prev,
                                    [s.id]: { ...prev[s.id], comment: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t mt-auto flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setScoringOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSaveScores}
                disabled={upsertScoresMutation.isPending}
              >
                {upsertScoresMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Saqlash
              </Button>
            </div>
          </div>
        )}
      </SlideOver>

      {/* CRUD Modals */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? 'Tahrirlash' : 'Yangi test'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 col-span-1 md:col-span-2">
            <Label>Nomi</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Masalan: Qavariq ko'pburchaklar bo'yicha test"
            />
          </div>
          <div className="space-y-2">
            <Label>Guruh</Label>
            <Select
              value={form.groupId}
              onValueChange={(v) => setForm({ ...form, groupId: v, subjectId: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groupsList.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fan</Label>
            <Select
              value={form.subjectId}
              onValueChange={(v) => setForm({ ...form, subjectId: v })}
              disabled={!form.groupId || availableSubjects.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !form.groupId
                      ? 'Avval guruhni tanlang'
                      : availableSubjects.length === 0
                      ? 'Bu guruhga fan biriktirilmagan'
                      : 'Fanni tanlang'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Turi</Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  type: v,
                  maxScore: v === 'BLOCK_TEST' ? '189' : form.maxScore,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY_TEST">Haftalik test</SelectItem>
                <SelectItem value="BLOCK_TEST">Blok test (DTM — 189 ball)</SelectItem>
                <SelectItem value="WRITTEN">Yozma</SelectItem>
                <SelectItem value="CONTROL">Nazorat</SelectItem>
                <SelectItem value="MOCK">Sinov</SelectItem>
              </SelectContent>
            </Select>
            {form.type === 'BLOCK_TEST' && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                DTM: Asosiy 93 + Qo'shimcha 63 + Majburiy 3×11 = 189 ball
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>O'tkazilgan vaqt</Label>
            <Input
              type="datetime-local"
              value={form.heldAt}
              onChange={(e) => setForm({ ...form, heldAt: e.target.value })}
            />
          </div>
          {!editing && form.groupId && form.heldAt && (
            <div className="col-span-1 md:col-span-2">
              {lessonsOnDay.length > 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                    {DOW_NAMES[selectedDow ?? 1]} kuni {lessonsOnDay.length} ta dars mavjud:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lessonsOnDay.map((l: any) => (
                      <Badge key={l.id} variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:text-emerald-400">
                        {l.periodNo}-dars • {l.subject?.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : activeTimetableId ? (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">
                    <strong>{DOW_NAMES[selectedDow ?? 1]}</strong> kuni bu guruhda dars yo'q. Test faqat dars bo'lgan kuni tuzilishi mumkin.
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <div className="space-y-2">
            <Label>Max ball</Label>
            <Input
              type="number"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Vazn (koeffitsient)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
            />
          </div>
          <div className="space-y-2 col-span-1 md:col-span-2">
            <Label>Qo'shimcha izoh</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Test haqida qisqacha ma'lumot"
              rows={3}
            />
          </div>
          <div className="space-y-2 col-span-1 md:col-span-2 border p-3 rounded-md flex items-center justify-between mt-2">
            <div>
              <Label>Ota-onalarga ko'rsatish</Label>
              <p className="text-sm text-muted-foreground">
                Natijalar portalda Guardianlarga ko'rinadi
              </p>
            </div>
            <Switch
              checked={form.publishToGuardians}
              onCheckedChange={(c) => setForm({ ...form, publishToGuardians: c })}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setModalOpen(false)}
          >
            Bekor qilish
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={!canCreateAssessment}
            title={!canCreateAssessment ? 'Bu kunda dars mavjud emas' : undefined}
            onClick={async () => {
              const payload = {
                ...form,
                maxScore: parseInt(form.maxScore, 10),
                weight: parseFloat(form.weight),
                heldAt: new Date(form.heldAt).toISOString(),
              };
              if (editing) await update(editing.id, payload);
              else await create(payload);
              setModalOpen(false);
            }}
          >
            {editing ? 'Saqlash' : 'Yaratish'}
          </Button>
        </div>
      </SlideOver>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'chirish"
        description={`"${deleting?.title}" ni o'chirishga ishonchingiz komilmi?`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          if (deleting) {
            await remove(deleting.id);
            setDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
