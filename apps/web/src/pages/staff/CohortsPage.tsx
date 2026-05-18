import { useState, useRef } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useCrud } from '@/hooks/useCrud';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Layers,
  Trash2,
  Edit2,
  Plus,
  Search,
  Loader2,
  Calendar,
  GraduationCap,
  Users,
  BarChart3,
  ChevronRight,
  UserMinus,
  UserPlus,
  FileUp,
  File,
  Download,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  Award,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/+$/, '');

function resolveFileUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${API_BASE.replace('/api', '')}${url}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.[0]?.toUpperCase() || '?';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  GRADUATED: 'Bitiruvchi',
  INACTIVE: 'Faolsiz',
  EXPELLED: 'Chetlatilgan',
  TRANSFERRED: 'Ko\'chirilgan',
};

const OUTCOME_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  ADMITTED: { label: 'Qabul qilindi', color: 'text-green-600', icon: CheckCircle2 },
  REJECTED: { label: 'Rad etildi', color: 'text-red-500', icon: XCircle },
  WAITLISTED: { label: 'Kutmoqda', color: 'text-amber-500', icon: AlertTriangle },
  ENROLLED: { label: "O'qiyapti", color: 'text-blue-600', icon: Building2 },
  UNKNOWN: { label: 'Noma\'lum', color: 'text-muted-foreground', icon: AlertTriangle },
};

const RISK_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function CohortsPage() {
  const qc = useQueryClient();
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/cohorts' });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all');
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ label: '', graduationYear: new Date().getFullYear() });

  // Rich detail data
  const { data: detailData, isLoading: loadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['cohort-detail', selectedCohort?.id],
    queryFn: async () => (await api.get(`/staff/cohorts/${selectedCohort.id}/detail`)).data,
    enabled: !!selectedCohort && detailOpen,
  });

  // Results data — lazy: only fetch when tab is active
  const { data: resultsData, isLoading: loadingResults } = useQuery({
    queryKey: ['cohort-results', selectedCohort?.id],
    queryFn: async () => (await api.get(`/staff/cohorts/${selectedCohort.id}/results`)).data,
    enabled: !!selectedCohort && detailOpen && activeTab === 'results',
  });

  // Files — lazy
  const { data: filesData, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ['cohort-files', selectedCohort?.id],
    queryFn: async () =>
      (await api.get(`/staff/files?ownerType=COHORT&ownerId=${selectedCohort.id}&limit=100`)).data,
    enabled: !!selectedCohort && detailOpen && activeTab === 'files',
  });

  // All students for assignment dropdown
  const { data: allStudentsRes } = useQuery({
    queryKey: ['students-for-cohort-assign'],
    queryFn: async () => (await api.get('/staff/students?limit=500&status=ACTIVE')).data,
    enabled: detailOpen && activeTab === 'students',
  });
  const allStudents: any[] = allStudentsRes?.data || [];

  const cohortStudentIds = new Set((detailData?.students || []).map((s: any) => s.id));
  const unassignedStudents = allStudents.filter((s) => !cohortStudentIds.has(String(s.id)));

  const openDetail = (cohort: any) => {
    setSelectedCohort(cohort);
    setActiveTab('overview');
    setStudentSearch('');
    setStudentStatusFilter('all');
    setAssignStudentId('');
    setDetailOpen(true);
  };

  const handleAssignStudent = async () => {
    if (!assignStudentId || !selectedCohort) return;
    setAssigning(true);
    try {
      await api.post(`/staff/students/${assignStudentId}/cohort`, { cohortLabel: selectedCohort.label });
      toast.success("O'quvchi kohortaga qo'shildi");
      setAssignStudentId('');
      refetchDetail();
      qc.invalidateQueries({ queryKey: ['cohort-results', selectedCohort.id] });
    } catch {
      toast.error("Qo'shishda xato");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!selectedCohort) return;
    setRemovingStudentId(studentId);
    try {
      await api.delete(`/staff/cohorts/${selectedCohort.id}/students/${studentId}`);
      toast.success(`${studentName} kohortadan chiqarildi`);
      refetchDetail();
      qc.invalidateQueries({ queryKey: ['cohort-results', selectedCohort.id] });
    } catch {
      toast.error('Chiqarishda xato');
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCohort) return;
    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('ownerType', 'COHORT');
      fd.append('ownerId', String(selectedCohort.id));
      fd.append('purpose', 'COHORT_FILE');
      fd.append('fileName', file.name);
      await api.post('/staff/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Fayl yuklandi');
      refetchFiles();
    } catch {
      // handled by interceptor
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await api.delete(`/staff/files/${fileId}`);
      toast.success('Fayl o\'chirildi');
      refetchFiles();
    } catch {
      // handled
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!form.label.trim()) { toast.error('Kohorta nomi kiritilishi shart'); return; }
    if (!form.graduationYear || form.graduationYear < 2000 || form.graduationYear > 2100) {
      toast.error('Bitiruv yili 2000–2100 orasida bo\'lishi kerak'); return;
    }
    const payload = { label: form.label.trim(), graduationYear: parseInt(String(form.graduationYear), 10) };
    try {
      if (isEditing) await update(selectedCohort.id, payload);
      else await create(payload);
      setModalOpen(false);
    } catch {}
  };

  // Filtered students for display
  const filteredStudents = (detailData?.students || []).filter((s: any) => {
    const matchSearch = !studentSearch ||
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.groupName || '').toLowerCase().includes(studentSearch.toLowerCase());
    const matchStatus = studentStatusFilter === 'all' || s.status === studentStatusFilter;
    return matchSearch && matchStatus;
  });

  const files: any[] = filesData?.data || [];
  const assessments: any[] = resultsData?.assessments || [];
  const resultStudents: any[] = resultsData?.students || [];
  const subjectStats: any[] = resultsData?.subjectStats || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kohortalar"
        description="Bitiruvchilar oqimi — guruhlar, natijalar va arxiv"
        action={{
          label: "Kohorta qo'shish",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ label: '', graduationYear: new Date().getFullYear() });
            setIsEditing(false);
            setModalOpen(true);
          },
        }}
      />

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Kohortalardan qidirish..." className="pl-10" onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton cards={6} />
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">Hali kohortalar qo'shilmagan</p>
          <Button variant="outline" size="sm" className="mt-4 gap-2"
            onClick={() => { setForm({ label: '', graduationYear: new Date().getFullYear() }); setIsEditing(false); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> Kohorta qo'shish
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((cohort: any) => (
            <Card
              key={cohort.id}
              className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col shadow-sm border-l-4 border-l-blue-500 cursor-pointer"
              onClick={() => openDetail(cohort)}
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      setSelectedCohort(cohort);
                      setForm({ label: cohort.label, graduationYear: cohort.graduationYear || new Date().getFullYear() });
                      setIsEditing(true);
                      setModalOpen(true);
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedCohort(cohort); setDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="mt-3 text-lg font-bold">{cohort.label}</CardTitle>
                <div className="flex items-center gap-1.5 text-sm text-blue-600 font-medium mt-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {cohort.graduationYear}-yil bitiruvchilari
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-3 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-xl font-bold">{cohort.studentsCount ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">O'quvchi</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <p className="text-xl font-bold">{cohort.graduationYear}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-0.5">Bitiruv yili</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-5 py-3 border-t bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  Bitiruvchilar oqimi
                </div>
                <div className="text-[11px] text-primary flex items-center gap-1 font-medium">
                  Batafsil <ChevronRight className="h-3 w-3" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Detail SlideOver */}
      <SlideOver
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selectedCohort ? `${selectedCohort.label}` : 'Kohorta'}
        description={selectedCohort ? `${selectedCohort.graduationYear}-yil bitiruvchilari` : ''}
        size="xl"
      >
        {loadingDetail ? (
          <CardGridSkeleton cards={6} />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 mb-6">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Umumiy
              </TabsTrigger>
              <TabsTrigger value="students" className="gap-1.5 text-xs">
                <Users className="h-3.5 w-3.5" /> O'quvchilar
                {detailData && <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{detailData.stats.total}</span>}
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5" /> Natijalar
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5 text-xs">
                <File className="h-3.5 w-3.5" /> Fayllar
              </TabsTrigger>
            </TabsList>

            {/* ─── OVERVIEW ─── */}
            <TabsContent value="overview" className="space-y-5 mt-0">
              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-4 text-center">
                  <p className="text-3xl font-black">{detailData?.stats.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Jami o'quvchi</p>
                </div>
                <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-4 text-center">
                  <p className="text-3xl font-black text-blue-600">{selectedCohort?.graduationYear}</p>
                  <p className="text-xs text-muted-foreground mt-1">Bitiruv yili</p>
                </div>
              </div>

              {/* Status breakdown */}
              {detailData?.stats.byStatus && Object.keys(detailData.stats.byStatus).length > 0 && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" /> Status bo'yicha
                  </p>
                  <div className="space-y-2">
                    {Object.entries(detailData.stats.byStatus as Record<string, number>).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 shrink-0">{STATUS_LABELS[status] || status}</span>
                        <Progress value={detailData.stats.total > 0 ? (count / detailData.stats.total) * 100 : 0} className="flex-1 h-2" />
                        <span className="text-xs font-bold w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Groups breakdown */}
              {detailData?.stats.byGroup && detailData.stats.byGroup.length > 0 && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" /> Guruhlar bo'yicha
                  </p>
                  <div className="space-y-2">
                    {detailData.stats.byGroup.map((g: any) => (
                      <div key={g.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {g.grade}
                          </div>
                          <span className="text-sm font-medium">{g.name}</span>
                        </div>
                        <Badge variant="secondary">{g.count} ta</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outcome summary */}
              {detailData?.students?.some((s: any) => s.outcome) && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" /> Qabul natijalari
                  </p>
                  {(() => {
                    const outcomeCount: Record<string, number> = {};
                    for (const s of detailData.students) {
                      if (s.outcome) {
                        const k = s.outcome.status;
                        outcomeCount[k] = (outcomeCount[k] || 0) + 1;
                      }
                    }
                    return (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(outcomeCount).map(([status, count]) => {
                          const info = OUTCOME_LABELS[status] || OUTCOME_LABELS.UNKNOWN;
                          const Icon = info.icon;
                          return (
                            <div key={status} className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-1.5 text-sm">
                              <Icon className={cn('h-4 w-4', info.color)} />
                              <span className="font-medium">{count}</span>
                              <span className="text-muted-foreground text-xs">{info.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setActiveTab('students')}>
                  <UserPlus className="h-4 w-4" /> O'quvchi boshqaruvi
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setActiveTab('results')}>
                  <TrendingUp className="h-4 w-4" /> Natijalar
                </Button>
              </div>
            </TabsContent>

            {/* ─── STUDENTS ─── */}
            <TabsContent value="students" className="space-y-4 mt-0">
              {/* Add student */}
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> O'quvchi qo'shish
                </p>
                <div className="flex gap-2">
                  <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="O'quvchini tanlang..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedStudents.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                          {allStudents.length === 0 ? 'Yuklanmoqda...' : 'Barcha faol o\'quvchilar kohortada'}
                        </div>
                      ) : (
                        unassignedStudents.map((s: any) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.fullName || s.full_name}
                            {s.group?.name && <span className="text-muted-foreground"> — {s.group.name}</span>}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="gap-1.5" disabled={!assignStudentId || assigning} onClick={handleAssignStudent}>
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Qo'shish
                  </Button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ism yoki guruh bo'yicha..."
                    className="pl-9 h-9"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>
                <Select value={studentStatusFilter} onValueChange={setStudentStatusFilter}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha statuslar</SelectItem>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student list */}
              {loadingDetail ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  {detailData?.stats.total === 0 ? "Hali o'quvchilar qo'shilmagan" : 'Qidiruv bo\'yicha topilmadi'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredStudents.map((s: any) => {
                    const outcome = s.outcome ? OUTCOME_LABELS[s.outcome.status] || OUTCOME_LABELS.UNKNOWN : null;
                    return (
                      <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors group">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {getInitials(s.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{s.fullName}</p>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{s.groupName || 'Guruhsiz'}</span>
                            {s.riskLevel && (
                              <span className={cn('text-[10px] font-bold rounded px-1.5 py-0.5', RISK_COLORS[s.riskLevel] || RISK_COLORS.LOW)}>
                                Risk: {s.riskLevel}
                              </span>
                            )}
                            {outcome && (
                              <div className={cn('flex items-center gap-1 text-[10px] font-medium', outcome.color)}>
                                <outcome.icon className="h-3 w-3" />
                                {outcome.label}
                                {s.outcome?.institutionName && <span className="text-muted-foreground">— {s.outcome.institutionName}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={s.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] h-5">
                            {STATUS_LABELS[s.status] || s.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                            title="Kohortadan chiqarish"
                            disabled={removingStudentId === s.id}
                            onClick={() => handleRemoveStudent(s.id, s.fullName)}
                          >
                            {removingStudentId === s.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <UserMinus className="h-3.5 w-3.5" />
                            }
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── RESULTS ─── */}
            <TabsContent value="results" className="space-y-5 mt-0">
              {loadingResults ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
              ) : !resultsData ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Natijalar yuklanmoqda...</div>
              ) : assessments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  Hali testlar va baholashlar mavjud emas
                </div>
              ) : (
                <>
                  {/* Subject stats */}
                  {subjectStats.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Fanlar bo'yicha o'rtacha</p>
                      <div className="grid grid-cols-1 gap-2">
                        {subjectStats.map((s: any) => (
                          <div key={s.subjectId} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium truncate">{s.subjectName}</span>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-xs text-muted-foreground">{s.assessmentCount} ta test</span>
                                  <span className={cn(
                                    'text-sm font-bold',
                                    s.avgPercentage >= 70 ? 'text-green-600' : s.avgPercentage >= 50 ? 'text-amber-500' : 'text-red-500'
                                  )}>
                                    {s.avgPercentage}%
                                  </span>
                                </div>
                              </div>
                              <Progress
                                value={s.avgPercentage}
                                className={cn('h-2', s.avgPercentage >= 70 ? '[&>div]:bg-green-500' : s.avgPercentage >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500')}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top students */}
                  {resultStudents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">O'quvchilar reytingi</p>
                      <div className="space-y-1.5">
                        {resultStudents.map((s: any, idx: number) => (
                          <div key={s.id} className={cn(
                            'flex items-center gap-3 rounded-xl p-3 border',
                            idx === 0 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
                            idx === 1 ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700' :
                            idx === 2 ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' :
                            'bg-card'
                          )}>
                            <span className={cn(
                              'text-sm font-black w-6 text-center',
                              idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-muted-foreground'
                            )}>
                              {idx + 1}
                            </span>
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {getInitials(s.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{s.fullName}</p>
                              <p className="text-[11px] text-muted-foreground">{s.groupName || '—'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn(
                                'text-sm font-bold',
                                s.percentage >= 70 ? 'text-green-600' : s.percentage >= 50 ? 'text-amber-500' : 'text-red-500'
                              )}>
                                {s.percentage}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {s.totalScored}/{s.totalMax} ball
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Score matrix */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Ball jadvali</p>
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="sticky left-0 bg-muted/30 z-10 min-w-[150px]">O'quvchi</TableHead>
                            {assessments.map((a: any) => (
                              <TableHead key={a.id} className="text-center min-w-[80px] text-[11px]">
                                <div className="font-semibold truncate max-w-[80px]" title={a.title}>{a.title}</div>
                                <div className="text-[10px] text-muted-foreground font-normal">{a.subjectName}</div>
                                <div className="text-[10px] text-muted-foreground font-normal">max: {a.maxScore}</div>
                              </TableHead>
                            ))}
                            <TableHead className="text-center min-w-[70px] text-xs">Jami %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {resultStudents.map((s: any) => (
                            <TableRow key={s.id} className="hover:bg-muted/20">
                              <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm py-2">
                                <div className="truncate max-w-[150px]" title={s.fullName}>{s.fullName}</div>
                                <div className="text-[10px] text-muted-foreground">{s.groupName || '—'}</div>
                              </TableCell>
                              {assessments.map((a: any) => {
                                const score = s.scores[a.id];
                                const pct = score != null ? (score / a.maxScore) * 100 : null;
                                return (
                                  <TableCell key={a.id} className="text-center py-2">
                                    {score != null ? (
                                      <span className={cn(
                                        'text-sm font-bold',
                                        pct! >= 70 ? 'text-green-600' : pct! >= 50 ? 'text-amber-500' : 'text-red-500'
                                      )}>
                                        {score}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground/40 text-xs">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center py-2">
                                <span className={cn(
                                  'text-sm font-bold',
                                  s.percentage >= 70 ? 'text-green-600' : s.percentage >= 50 ? 'text-amber-500' : 'text-red-500'
                                )}>
                                  {s.percentage}%
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── FILES ─── */}
            <TabsContent value="files" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Kohorta uchun hujjatlar, rasmlar va boshqa fayllar
                </p>
                <Button size="sm" className="gap-2" disabled={uploadingFile} onClick={() => fileInputRef.current?.click()}>
                  {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  Fayl yuklash
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>

              {loadingFiles ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" /></div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
                  <File className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">Fayllar yo'q</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Yuqoridagi tugma orqali fayl yuklang</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
                    <FileUp className="h-4 w-4" /> Fayl yuklash
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((f: any) => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-colors group">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <File className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.fileName || f.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {f.sizeBytes ? formatBytes(Number(f.sizeBytes || f.size_bytes)) : ''}
                          {' '}• {f.createdAt ? new Date(f.createdAt || f.created_at).toLocaleDateString('uz') : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={resolveFileUrl(f.url)} target="_blank" rel="noreferrer" download>
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteFile(String(f.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SlideOver>

      {/* Create / Edit SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={isEditing ? 'Kohortani tahrirlash' : "Yangi kohorta qo'shish"}
        size="sm"
      >
        <div className="space-y-6 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cohort-label">Kohorta nomi *</Label>
            <Input
              id="cohort-label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Masalan: Generation Alpha, 2025-Bitiruvchilar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cohort-year">Bitiruv yili *</Label>
            <Input
              id="cohort-year"
              type="number"
              min="2000"
              max="2100"
              value={form.graduationYear}
              onChange={(e) => setForm({ ...form, graduationYear: parseInt(e.target.value, 10) || new Date().getFullYear() })}
            />
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
        title="Kohortani o'chirish"
        description={`"${selectedCohort?.label}" kohortasini o'chirishga ishonchingiz komilmi? Faqat o'quvchisi yo'q kohortalarni o'chirish mumkin.`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          await remove(selectedCohort.id);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
