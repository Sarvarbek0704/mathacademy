import { useState, useMemo } from 'react';
import { CardGridSkeleton } from '@/components/shared/PageSkeleton';
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
  Trash2,
  Edit2,
  Plus,
  Search,
  FileBadge,
  GraduationCap,
  Loader2,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Building2,
  Briefcase,
  Clock,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CERT_TYPES = ['IELTS', 'SAT', 'TOEFL', 'CEFR', 'GMAT', 'GRE', 'OTHER'];

const OUTCOME_TYPES: Record<string, { label: string; color: string; icon: any }> = {
  UNIVERSITY_ADMIT: {
    label: 'Universitetga qabul',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: GraduationCap,
  },
  TRANSFER: {
    label: "Ko'chirildi",
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: ArrowRight,
  },
  EMPLOYMENT: {
    label: 'Ishga joylashdi',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Briefcase,
  },
  GAP_YEAR: {
    label: "Ta'til yili",
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Clock,
  },
  UNKNOWN: {
    label: "Noma'lum",
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    icon: HelpCircle,
  },
};

function OutcomeTypeBadge({ type }: { type: string }) {
  const info = OUTCOME_TYPES[type] || OUTCOME_TYPES.UNKNOWN;
  const Icon = info.icon;
  return (
    <Badge className={cn('gap-1 border-none text-xs font-semibold', info.color)} variant="outline">
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}

function detectCertType(value?: string) {
  const upper = String(value || '').toUpperCase();
  return CERT_TYPES.find((t) => upper.includes(t)) || 'OTHER';
}

export default function CertificatesPage() {
  const queryClient = useQueryClient();
  const { data: certs, loading, setSearch, create, remove, update } = useCrud({
    endpoint: '/staff/certificates',
  });

  const [tab, setTab] = useState<'certs' | 'outcomes'>('certs');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');

  const [form, setForm] = useState({
    type: 'IELTS',
    name: '',
    score: '',
    studentId: '',
    issuer: '',
    date: dayjs().format('YYYY-MM-DD'),
    notes: '',
  });

  const [outcomeForm, setOutcomeForm] = useState({
    studentId: '',
    outcomeType: 'UNIVERSITY_ADMIT',
    institution: '',
    notes: '',
  });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'for_certs'],
    queryFn: async () => (await api.get('/staff/students?limit=200')).data,
  });
  const allStudents: any[] = studentsRes?.data || [];

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'for-certs'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
  });
  const groups: any[] = groupsRes?.data || [];

  const { data: outcomesRes, isLoading: outcomesLoading } = useQuery({
    queryKey: ['staff', 'outcomes'],
    queryFn: async () => (await api.get('/staff/outcomes?limit=200')).data,
    enabled: tab === 'outcomes',
  });
  const outcomes: any[] = outcomesRes?.data || [];

  const { data: statsRes } = useQuery({
    queryKey: ['staff', 'certificates', 'statistics'],
    queryFn: async () => (await api.get('/staff/certificates/statistics')).data,
  });

  const saveOutcomeMut = useMutation({
    mutationFn: async (payload: any) => (await api.post('/staff/outcomes', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'outcomes'] });
      setOutcomeModalOpen(false);
      toast.success('Natija saqlandi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const deleteOutcomeMut = useMutation({
    mutationFn: async (studentId: string) =>
      (await api.delete(`/staff/outcomes/student/${studentId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'outcomes'] });
      toast.success("Natija o'chirildi");
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const filteredStudents = useMemo(() => {
    if (!groupFilter) return allStudents;
    return allStudents.filter((s: any) => String(s.groupId || s.group?.id) === groupFilter);
  }, [allStudents, groupFilter]);

  const handleCreateOrUpdate = async () => {
    if (!form.studentId) {
      toast.error("O'quvchini tanlang");
      return;
    }
    const title = form.name.trim() || `${form.type} Certificate`;
    if (title.length < 3) {
      toast.error('Sertifikat nomi kamida 3 ta belgidan iborat');
      return;
    }
    const issuedAt = dayjs(form.date);
    if (!issuedAt.isValid()) {
      toast.error("Sana noto'g'ri");
      return;
    }
    const payload: any = {
      studentId: form.studentId,
      title,
      score: form.score?.trim() || undefined,
      issuedAt: issuedAt.toISOString(),
    };
    if (form.issuer?.trim()) payload.issuer = form.issuer.trim();
    if (form.notes?.trim()) payload.notes = form.notes.trim();

    if (isEditing) {
      await update(selectedCert.id, payload);
    } else {
      await create(payload);
    }
    setModalOpen(false);
  };

  const handleSaveOutcome = () => {
    if (!outcomeForm.studentId) {
      toast.error("O'quvchini tanlang");
      return;
    }
    saveOutcomeMut.mutate({
      studentId: outcomeForm.studentId,
      outcomeType: outcomeForm.outcomeType,
      institution: outcomeForm.institution?.trim() || undefined,
      notes: outcomeForm.notes?.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sertifikatlar va Natijalar"
        description="O'quvchilarning IELTS, SAT va boshqa sertifikatlari hamda akademik natijalari"
        action={
          tab === 'certs'
            ? {
                label: "Sertifikat qo'shish",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => {
                  setForm({
                    type: 'IELTS',
                    name: '',
                    score: '',
                    studentId: '',
                    issuer: '',
                    date: dayjs().format('YYYY-MM-DD'),
                    notes: '',
                  });
                  setIsEditing(false);
                  setModalOpen(true);
                },
              }
            : {
                label: "Natija qo'shish",
                icon: <Plus className="h-4 w-4" />,
                onClick: () => {
                  setOutcomeForm({
                    studentId: '',
                    outcomeType: 'UNIVERSITY_ADMIT',
                    institution: '',
                    notes: '',
                  });
                  setOutcomeModalOpen(true);
                },
              }
        }
      />

      {/* Stats row */}
      {statsRes && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Jami sertifikatlar', value: statsRes.totalCertificates ?? certs.length, icon: FileBadge, color: 'text-indigo-600' },
            { label: 'IELTS', value: statsRes.byType?.IELTS ?? 0, icon: CheckCircle2, color: 'text-blue-600' },
            { label: 'SAT', value: statsRes.byType?.SAT ?? 0, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Natijalar', value: statsRes.totalOutcomes ?? outcomes.length, icon: TrendingUp, color: 'text-purple-600' },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg bg-muted', s.color)}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Qidirish..."
              className="pl-10 h-10"
              onChange={(e) => tab === 'certs' && setSearch(e.target.value)}
            />
          </div>
          <TabsList className="h-10">
            <TabsTrigger value="certs" className="text-xs px-4">
              <FileBadge className="h-3.5 w-3.5 mr-1.5" />
              Sertifikatlar
              <Badge variant="secondary" className="ml-2 h-4 text-[10px] px-1">{certs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="text-xs px-4">
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Natijalar
              {outcomes.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-4 text-[10px] px-1">{outcomes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Certificates Tab */}
        <TabsContent value="certs" className="mt-6">
          {loading ? (
            <CardGridSkeleton cards={6} />
          ) : certs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <FileBadge className="h-12 w-12 opacity-20" />
              <p className="text-sm">Sertifikatlar topilmadi</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {certs.map((cert: any) => {
                const certTitle = cert.title || cert.name;
                const certType = cert.type || detectCertType(certTitle);
                const certDate = cert.issuedAt || cert.date;
                const certStudentName =
                  cert.studentName || cert.student?.fullName || cert.student?.full_name;
                return (
                  <Card
                    key={cert.id}
                    className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full"
                  >
                    <CardHeader className="p-5 pb-2">
                      <div className="flex justify-between items-start">
                        <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                          <FileBadge className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedCert(cert);
                              setForm({
                                type: cert.type || detectCertType(cert.title || cert.name),
                                name: cert.title || cert.name || '',
                                score: cert.score || '',
                                studentId: String(cert.studentId || cert.student?.id || ''),
                                issuer: cert.issuer || '',
                                date: dayjs(cert.issuedAt || cert.date).isValid()
                                  ? dayjs(cert.issuedAt || cert.date).format('YYYY-MM-DD')
                                  : dayjs().format('YYYY-MM-DD'),
                                notes: cert.notes || '',
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
                            onClick={() => { setSelectedCert(cert); setDeleteOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border-indigo-200"
                        >
                          {certType}
                        </Badge>
                        {cert.score && (
                          <span className="text-sm font-semibold text-primary">{cert.score}</span>
                        )}
                      </div>
                      <CardTitle className="mt-2 text-base line-clamp-1">{certTitle}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3 flex-1">
                      <div className="space-y-1.5 pt-2 border-t">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <GraduationCap className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium text-foreground">{certStudentName}</span>
                        </div>
                        {cert.issuer && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            {cert.issuer}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {dayjs(certDate).format('DD.MM.YYYY')}
                        </div>
                      </div>
                      {cert.notes && (
                        <p className="text-xs text-muted-foreground italic line-clamp-2">{cert.notes}</p>
                      )}
                    </CardContent>
                    <CardFooter className="p-4 border-t bg-muted/20 mt-auto">
                      <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Tasdiqlangan sertifikat
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Outcomes Tab */}
        <TabsContent value="outcomes" className="mt-6">
          {outcomesLoading ? (
            <CardGridSkeleton cards={6} />
          ) : outcomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <TrendingUp className="h-12 w-12 opacity-20" />
              <p className="text-sm">Natijalar topilmadi</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOutcomeForm({ studentId: '', outcomeType: 'UNIVERSITY_ADMIT', institution: '', notes: '' });
                  setOutcomeModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Natija qo'shish
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outcomes.map((outcome: any) => {
                const typeInfo = OUTCOME_TYPES[outcome.outcomeType] || OUTCOME_TYPES.UNKNOWN;
                const Icon = typeInfo.icon;
                return (
                  <Card
                    key={outcome.id || outcome.studentId}
                    className="group hover:border-primary/50 transition-all overflow-hidden"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn('p-2 rounded-lg flex-shrink-0', typeInfo.color.split(' ').slice(0, 1).join(' '))}>
                            <Icon className={cn('h-5 w-5', typeInfo.color.split(' ').slice(1).join(' '))} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {outcome.studentName || outcome.student?.fullName || outcome.student?.full_name}
                            </p>
                            <OutcomeTypeBadge type={outcome.outcomeType} />
                            {outcome.institution && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {outcome.institution}
                              </p>
                            )}
                            {outcome.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                                {outcome.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 flex-shrink-0"
                          onClick={() =>
                            deleteOutcomeMut.mutate(
                              String(outcome.studentId || outcome.student?.id)
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Certificate Form SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={isEditing ? 'Sertifikatni tahrirlash' : 'Yangi sertifikat'}
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Guruh bo'yicha filtr</Label>
            <Select
              value={groupFilter || '_all'}
              onValueChange={(v) => setGroupFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Barcha guruhlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Barcha guruhlar</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>O'quvchi <span className="text-destructive">*</span></Label>
            <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="O'quvchini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.fullName || s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sertifikat turi</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CERT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ball / Natija</Label>
              <Input
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                placeholder="7.5 yoki 1520"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sertifikat nomi</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="IELTS Academic Test"
            />
          </div>

          <div className="space-y-2">
            <Label>Beruvchi tashkilot</Label>
            <Input
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              placeholder="British Council, College Board..."
            />
          </div>

          <div className="space-y-2">
            <Label>Sana</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Izoh</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Qo'shimcha ma'lumot..."
              rows={2}
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-6 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreateOrUpdate}>
              Saqlash
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Outcome Form SlideOver */}
      <SlideOver
        open={outcomeModalOpen}
        onOpenChange={setOutcomeModalOpen}
        title="O'quvchi natijasini belgilash"
        size="sm"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Guruh bo'yicha filtr</Label>
            <Select
              value={groupFilter || '_all'}
              onValueChange={(v) => setGroupFilter(v === '_all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Barcha guruhlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Barcha guruhlar</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>O'quvchi <span className="text-destructive">*</span></Label>
            <Select
              value={outcomeForm.studentId}
              onValueChange={(v) => setOutcomeForm({ ...outcomeForm, studentId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="O'quvchini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.fullName || s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Natija turi <span className="text-destructive">*</span></Label>
            <Select
              value={outcomeForm.outcomeType}
              onValueChange={(v) => setOutcomeForm({ ...outcomeForm, outcomeType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OUTCOME_TYPES).map(([val, info]) => (
                  <SelectItem key={val} value={val}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Muassasa / Tashkilot</Label>
            <Input
              value={outcomeForm.institution}
              onChange={(e) => setOutcomeForm({ ...outcomeForm, institution: e.target.value })}
              placeholder="MIT, Google, INHA..."
            />
          </div>

          <div className="space-y-2">
            <Label>Izoh</Label>
            <Textarea
              value={outcomeForm.notes}
              onChange={(e) => setOutcomeForm({ ...outcomeForm, notes: e.target.value })}
              placeholder="Qo'shimcha ma'lumot..."
              rows={3}
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-6 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOutcomeModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={handleSaveOutcome}
              disabled={saveOutcomeMut.isPending}
            >
              {saveOutcomeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Saqlash
            </Button>
          </div>
        </div>
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'chirish"
        description="Sertifikatni o'chirishga ishonchingiz komilmi?"
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          await remove(selectedCert.id);
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
