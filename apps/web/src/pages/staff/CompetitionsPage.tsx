import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Trophy,
  Trash2,
  Edit2,
  Plus,
  Search,
  Loader2,
  Users,
  Target,
  Swords,
  Medal,
  X,
  Save,
  Timer,
  ListOrdered,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrud } from '@/hooks/useCrud';
import dayjs from 'dayjs';

const MODES = [
  { value: 'INDIVIDUAL', label: 'Yakkalik', icon: Target, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
  { value: 'TEAM', label: 'Jamoaviy', icon: Swords, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/20' },
  { value: 'GROUP', label: 'Guruh', icon: Users, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/20' },
  { value: 'DORM', label: 'Yotoqxona', icon: Medal, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
];

function rankMedal(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return <span className="font-mono text-sm text-muted-foreground">{rank}</span>;
}

export default function CompetitionsPage() {
  const queryClient = useQueryClient();
  const { data, loading, setSearch, create, remove, update } = useCrud({ endpoint: '/staff/competitions' });

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    name: '',
    mode: 'INDIVIDUAL',
    rules: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
  });

  // Entries local state (for detail panel)
  const [localEntries, setLocalEntries] = useState<any[]>([]);
  const [addStudentId, setAddStudentId] = useState('');
  const [addGroupId, setAddGroupId] = useState('');
  const [addTeamName, setAddTeamName] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Results local state
  const [localResults, setLocalResults] = useState<Record<string, { rank: string; score: string; prize: string }>>({});

  // Queries
  const { data: compDetailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['staff', 'competitions', 'detail', selectedComp?.id],
    queryFn: async () => (await api.get(`/staff/competitions/${selectedComp.id}`)).data,
    enabled: !!selectedComp?.id && detailOpen,
  });
  const compDetail = compDetailRes?.data || compDetailRes || null;

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'comp-panel'],
    queryFn: async () => (await api.get('/staff/students?limit=200&status=ACTIVE')).data,
    enabled: detailOpen,
  });
  const students = studentsRes?.data || [];

  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'comp-panel'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
    enabled: detailOpen && (selectedComp?.mode === 'GROUP'),
  });
  const groups = groupsRes?.data || [];

  // Sync detail entries into local state
  useEffect(() => {
    if (compDetail?.entries) {
      setLocalEntries(compDetail.entries);
      const res: Record<string, { rank: string; score: string; prize: string }> = {};
      (compDetail.results || []).forEach((r: any) => {
        res[r.entryId] = { rank: String(r.rank || ''), score: r.score || '', prize: r.prize || '' };
      });
      setLocalResults(res);
    }
  }, [compDetail]);

  // Mutations
  const setEntriesMut = useMutation({
    mutationFn: ({ id, entries }: any) => api.post(`/staff/competitions/${id}/entries`, { entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'competitions', 'detail', selectedComp?.id] });
      toast.success('Ishtirokchilar saqlandi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const setResultsMut = useMutation({
    mutationFn: ({ id, results }: any) => api.post(`/staff/competitions/${id}/results`, { results }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'competitions', 'detail', selectedComp?.id] });
      toast.success('Natijalar saqlandi');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  // Handlers
  const handleCreateOrUpdate = async () => {
    if (!form.name.trim() || form.name.trim().length < 3) {
      toast.error("Musobaqa nomi kamida 3 ta belgidan iborat bo'lishi kerak"); return;
    }
    const startsAt = dayjs(form.startDate).startOf('day');
    const endsAt = dayjs(form.endDate).endOf('day');
    if (!startsAt.isValid()) { toast.error('Boshlanish sanasi noto\'g\'ri'); return; }
    if (form.endDate && endsAt.isBefore(startsAt)) { toast.error('Tugash sanasi oldin bo\'lishi mumkin emas'); return; }

    const payload = {
      title: form.name.trim(),
      mode: form.mode,
      startsAt: startsAt.toISOString(),
      endsAt: form.endDate ? endsAt.toISOString() : undefined,
      rules: form.rules?.trim() || undefined,
    };

    if (isEditing) await update(selectedComp.id, payload);
    else await create(payload);
    setModalOpen(false);
  };

  const openDetail = (comp: any) => {
    setSelectedComp(comp);
    setLocalEntries([]);
    setLocalResults({});
    setAddStudentId('');
    setAddGroupId('');
    setAddTeamName('');
    setStudentSearch('');
    setDetailOpen(true);
  };

  const addEntry = () => {
    const mode = selectedComp?.mode || compDetail?.mode;
    if (mode === 'INDIVIDUAL') {
      if (!addStudentId) { toast.error("O'quvchi tanlang"); return; }
      const student = students.find((s: any) => String(s.id) === addStudentId);
      if (!student) return;
      const name = student.fullName || student.full_name;
      if (localEntries.find((e) => e.studentId === addStudentId)) { toast.error('Bu o\'quvchi allaqachon qo\'shilgan'); return; }
      setLocalEntries((prev) => [...prev, { id: null, entryType: 'STUDENT', studentId: addStudentId, nameDisplay: name, studentName: name }]);
      setAddStudentId('');
    } else if (mode === 'GROUP') {
      if (!addGroupId) { toast.error('Guruh tanlang'); return; }
      const group = groups.find((g: any) => String(g.id) === addGroupId);
      if (!group) return;
      if (localEntries.find((e) => e.groupId === addGroupId)) { toast.error('Bu guruh allaqachon qo\'shilgan'); return; }
      setLocalEntries((prev) => [...prev, { id: null, entryType: 'GROUP', groupId: addGroupId, nameDisplay: group.name, groupName: group.name }]);
      setAddGroupId('');
    } else {
      if (!addTeamName.trim()) { toast.error('Jamoa nomi kiriting'); return; }
      setLocalEntries((prev) => [...prev, { id: null, entryType: mode, nameDisplay: addTeamName.trim() }]);
      setAddTeamName('');
    }
  };

  const removeEntry = (idx: number) => {
    setLocalEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEntries = () => {
    const entries = localEntries.map((e) => ({
      entryType: e.entryType,
      studentId: e.studentId || undefined,
      groupId: e.groupId || undefined,
      nameDisplay: e.nameDisplay,
    }));
    setEntriesMut.mutate({ id: selectedComp.id, entries });
  };

  const saveResults = () => {
    const results = Object.entries(localResults)
      .filter(([, v]) => v.rank)
      .map(([entryId, v]) => ({
        entryId,
        rank: parseInt(v.rank),
        score: v.score || undefined,
        prize: v.prize || undefined,
      }));
    if (results.length === 0) { toast.error('Kamida 1 ta natija kiriting'); return; }
    setResultsMut.mutate({ id: selectedComp.id, results });
  };

  const filteredStudents = students.filter((s: any) =>
    (s.fullName || s.full_name || '').toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const compMode = selectedComp?.mode || compDetail?.mode || 'INDIVIDUAL';
  const modeInfo = MODES.find((m) => m.value === compMode) || MODES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Musobaqalar"
        description="Akademiya ichki va tashqi o'quv musobaqalarini boshqarish"
        action={{
          label: 'Musobaqa yaratish',
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({ name: '', mode: 'INDIVIDUAL', rules: '', startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(7, 'day').format('YYYY-MM-DD') });
            setIsEditing(false);
            setModalOpen(true);
          },
        }}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Musobaqalardan qidirish..." className="pl-10" onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <CardGridSkeleton cards={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((comp: any) => {
            const mInfo = MODES.find((m) => m.value === comp.mode) || MODES[0];
            const Icon = mInfo.icon;
            return (
              <Card key={comp.id} className="group hover:border-primary/50 transition-all overflow-hidden flex flex-col h-full">
                <CardHeader className="p-5 pb-2">
                  <div className="flex justify-between items-start">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', mInfo.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setSelectedComp(comp);
                        setForm({
                          name: comp.title || '',
                          mode: comp.mode || 'INDIVIDUAL',
                          rules: comp.rules || '',
                          startDate: comp.startsAt ? dayjs(comp.startsAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
                          endDate: comp.endsAt ? dayjs(comp.endsAt).format('YYYY-MM-DD') : dayjs().add(7, 'day').format('YYYY-MM-DD'),
                        });
                        setIsEditing(true);
                        setModalOpen(true);
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setSelectedComp(comp); setDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px] font-bold border-none h-5 px-2', mInfo.color)}>{mInfo.label}</Badge>
                    {(comp.entriesCount ?? 0) > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-2 gap-1">
                        <Users className="h-3 w-3" /> {comp.entriesCount} ishtirokchi
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base line-clamp-1">{comp.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1">
                  <div className="space-y-2 text-xs text-muted-foreground pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Timer className="h-3.5 w-3.5" />
                      {dayjs(comp.startsAt).format('DD MMM')}
                      {comp.endsAt && ` — ${dayjs(comp.endsAt).format('DD MMM, YYYY')}`}
                    </div>
                    {comp.rules && <p className="line-clamp-2 italic leading-relaxed">{comp.rules}</p>}
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t bg-muted/20">
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => openDetail(comp)}>
                    <ListOrdered className="h-4 w-4" /> Ishtirokchilar va natijalar
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit */}
      <SlideOver open={modalOpen} onOpenChange={setModalOpen} title={isEditing ? 'Tahrirlash' : 'Yangi musobaqa'} size="sm">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Musobaqa nomi</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masalan: Matematika olimpiadasi" />
          </div>
          <div className="space-y-2">
            <Label>Rejim</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanish</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tugash</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Qoidalar</Label>
            <Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Musobaqa shartlari..." rows={4} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleCreateOrUpdate}>Saqlash</Button>
          </div>
        </div>
      </SlideOver>

      {/* Detail panel */}
      <SlideOver open={detailOpen} onOpenChange={setDetailOpen} title={selectedComp?.title || 'Musobaqa'} size="xl">
        {detailLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
          </div>
        ) : (
          <Tabs defaultValue="entries" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="entries" className="gap-2">
                <Users className="h-4 w-4" /> Ishtirokchilar ({localEntries.length})
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-2">
                <Trophy className="h-4 w-4" /> Natijalar
              </TabsTrigger>
            </TabsList>

            {/* ENTRIES TAB */}
            <TabsContent value="entries" className="flex-1 space-y-4">
              {/* Add form */}
              <div className="bg-muted/20 rounded-lg p-4 border space-y-3">
                <p className="text-xs font-bold uppercase text-muted-foreground">Ishtirokchi qo'shish ({modeInfo.label} rejimi)</p>
                {compMode === 'INDIVIDUAL' && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="O'quvchi ismidan qidirish..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="mb-1"
                      />
                      <Select value={addStudentId} onValueChange={setAddStudentId}>
                        <SelectTrigger><SelectValue placeholder="O'quvchini tanlang" /></SelectTrigger>
                        <SelectContent>
                          {filteredStudents.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.fullName || s.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addEntry} className="mt-7"><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
                {compMode === 'GROUP' && (
                  <div className="flex gap-2">
                    <Select value={addGroupId} onValueChange={setAddGroupId} >
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Guruh tanlang" /></SelectTrigger>
                      <SelectContent>
                        {groups.map((g: any) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={addEntry}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
                {(compMode === 'TEAM' || compMode === 'DORM') && (
                  <div className="flex gap-2">
                    <Input
                      className="flex-1"
                      placeholder={compMode === 'TEAM' ? 'Jamoa nomi...' : 'Yotoqxona nomi...'}
                      value={addTeamName}
                      onChange={(e) => setAddTeamName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                    />
                    <Button onClick={addEntry}><Plus className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>

              {/* Entries list */}
              <div className="space-y-1.5">
                {localEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                    Hali ishtirokchilar qo'shilmagan
                  </p>
                ) : (
                  localEntries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-md border bg-card text-sm">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {idx + 1}
                      </div>
                      <span className="flex-1 font-medium">{entry.nameDisplay}</span>
                      <Badge variant="outline" className="text-[9px]">{entry.entryType}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeEntry(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t flex justify-end">
                <Button onClick={saveEntries} disabled={setEntriesMut.isPending} className="gap-2">
                  {setEntriesMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" /> Saqlash
                </Button>
              </div>
            </TabsContent>

            {/* RESULTS TAB */}
            <TabsContent value="results" className="flex-1 space-y-4">
              {localEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Trophy className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">Avval ishtirokchilar qo'shing</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
                <div className="min-w-[500px] px-1 space-y-2">
                    <div className="grid grid-cols-[auto_1fr_80px_100px_120px] gap-2 px-3 text-[10px] font-bold uppercase text-muted-foreground">
                      <span>#</span><span>Ishtirokchi</span><span>O'rin</span><span>Ball</span><span>Mukofot</span>
                    </div>
                    {localEntries.map((entry, idx) => {
                      const entryId = entry.id || '';
                      const res = localResults[entryId] || { rank: '', score: '', prize: '' };
                      return (
                        <div key={idx} className="grid grid-cols-[auto_1fr_80px_100px_120px] gap-2 items-center p-3 rounded-md border bg-card">
                          <div className="h-7 w-7 flex items-center justify-center text-base">
                            {res.rank ? rankMedal(parseInt(res.rank)) : <span className="text-muted-foreground text-sm">{idx + 1}</span>}
                          </div>
                          <span className="font-medium text-sm truncate">{entry.nameDisplay}</span>
                          <Input
                            type="number"
                            min="1"
                            placeholder="O'rin"
                            className="h-8 text-center text-sm"
                            value={res.rank}
                            onChange={(e) => setLocalResults((prev) => ({ ...prev, [entryId]: { ...prev[entryId] || { rank: '', score: '', prize: '' }, rank: e.target.value } }))}
                            disabled={!entryId}
                          />
                          <Input
                            type="number"
                            placeholder="Ball"
                            className="h-8 text-center text-sm"
                            value={res.score}
                            onChange={(e) => setLocalResults((prev) => ({ ...prev, [entryId]: { ...prev[entryId] || { rank: '', score: '', prize: '' }, score: e.target.value } }))}
                            disabled={!entryId}
                          />
                          <Input
                            placeholder="Mukofot"
                            className="h-8 text-sm"
                            value={res.prize}
                            onChange={(e) => setLocalResults((prev) => ({ ...prev, [entryId]: { ...prev[entryId] || { rank: '', score: '', prize: '' }, prize: e.target.value } }))}
                            disabled={!entryId}
                          />
                        </div>
                      );
                    })}
                </div>
                </div>
                  {localEntries.some((e) => !e.id) && (
                    <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded p-2">
                      Avval ishtirokchilarni saqlang, so'ng natijalarni kiriting
                    </p>
                  )}
                  <div className="pt-2 flex justify-end">
                    <Button onClick={saveResults} disabled={setResultsMut.isPending || localEntries.some((e) => !e.id)} className="gap-2">
                      {setResultsMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4" /> Natijalarni saqlash
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'chirish"
        description="Musobaqani o'chirishga ishonchingiz komilmi? Ishtirokchilar bo'lsa, avval ularni o'chiring."
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={async () => {
          try {
            await remove(selectedComp.id);
            setDeleteOpen(false);
          } catch {
            toast.error('Ishtirokchilar mavjud. Avval ularni o\'chiring.');
            setDeleteOpen(false);
          }
        }}
      />
    </div>
  );
}
