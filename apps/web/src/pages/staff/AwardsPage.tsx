import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Medal,
  Award,
  FileBadge,
  Users,
  Pencil,
  Trash2,
  Loader2,
  UserPlus,
  X,
  Plus,
} from 'lucide-react';
import dayjs from 'dayjs';

const AWARD_TYPES = [
  { value: 'GIFT', label: "Sovg'a", icon: Trophy, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200' },
  { value: 'STIPEND', label: 'Stipendiya', icon: Medal, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200' },
  { value: 'CERTIFICATE', label: 'Sertifikat', icon: FileBadge, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200' },
  { value: 'BADGE', label: 'Nishon', icon: Award, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30 border-purple-200' },
];

function AwardTypeChip({ type }: { type: string }) {
  const info = AWARD_TYPES.find((t) => t.value === type) || AWARD_TYPES[0];
  const Icon = info.icon;
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4" />
      <Badge variant="outline" className={`text-xs ${info.color}`}>{info.label}</Badge>
    </div>
  );
}

export default function AwardsPage() {
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [activeAward, setActiveAward] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    awardType: 'GIFT',
    title: '',
    description: '',
    valueAmount: '',
    issuedAt: dayjs().format('YYYY-MM-DD'),
  });

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [recipientNote, setRecipientNote] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Queries
  const { data: awardsRes, isLoading } = useQuery({
    queryKey: ['staff', 'awards', typeFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (typeFilter) params.set('awardType', typeFilter);
      if (search) params.set('q', search);
      return (await api.get(`/staff/awards?${params}`)).data;
    },
  });
  const awards = awardsRes?.data || [];
  const meta = awardsRes?.meta || {};

  const { data: statsRes } = useQuery({
    queryKey: ['staff', 'awards', 'statistics'],
    queryFn: async () => (await api.get('/staff/awards/statistics')).data,
  });
  const stats = statsRes?.data || statsRes || {};

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['staff', 'awards', 'detail', activeAward?.id],
    queryFn: async () => (await api.get(`/staff/awards/${activeAward.id}`)).data,
    enabled: !!activeAward?.id && recipientsOpen,
  });
  const awardDetail = detailRes?.data || detailRes || null;

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'awards-panel'],
    queryFn: async () => (await api.get('/staff/students?limit=200&status=ACTIVE')).data,
    enabled: recipientsOpen,
  });
  const students = studentsRes?.data || [];

  // Mutations
  const createMut = useMutation({
    mutationFn: (body: any) => api.post('/staff/awards', body),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success('Mukofot yaratildi');
      setFormOpen(false);
      const created = res.data?.data || res.data;
      if (created?.id) {
        setActiveAward(created);
        setRecipientsOpen(true);
      }
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => api.patch(`/staff/awards/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success('Yangilandi');
      setFormOpen(false);
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/staff/awards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      toast.success("O'chirildi");
      setDeleteOpen(false);
    },
  });

  const setRecipientsMut = useMutation({
    mutationFn: ({ id, body }: any) => api.post(`/staff/awards/${id}/recipients`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'awards', 'detail', activeAward?.id] });
      toast.success('Oluvchilar saqlandi');
      setSelectedStudentIds([]);
      setRecipientNote('');
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ awardType: 'GIFT', title: '', description: '', valueAmount: '', issuedAt: dayjs().format('YYYY-MM-DD') });
    setFormOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      awardType: item.awardType,
      title: item.title,
      description: item.description || '',
      valueAmount: item.valueAmount || '',
      issuedAt: item.issuedAt ? dayjs(item.issuedAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    });
    setFormOpen(true);
  };

  const openRecipients = (item: any) => {
    setActiveAward(item);
    setSelectedStudentIds([]);
    setRecipientNote('');
    setStudentSearch('');
    setRecipientsOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error('Nom kiriting'); return; }
    const body: any = {
      awardType: form.awardType,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      issuedAt: form.issuedAt ? new Date(form.issuedAt + 'T00:00:00').toISOString() : undefined,
    };
    if (form.awardType === 'STIPEND' && form.valueAmount) body.valueAmount = form.valueAmount;
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSaveRecipients = () => {
    if (selectedStudentIds.length === 0) { toast.error("Kamida 1 ta o'quvchi tanlang"); return; }
    setRecipientsMut.mutate({
      id: activeAward.id,
      body: { studentIds: selectedStudentIds, groupIds: [], note: recipientNote.trim() || undefined },
    });
  };

  const filteredStudents = students.filter((s: any) =>
    (s.fullName || s.full_name || '').toLowerCase().includes(studentSearch.toLowerCase()),
  );

  const existingIds = new Set(
    (awardDetail?.recipients || []).filter((r: any) => r.studentId).map((r: any) => String(r.studentId)),
  );

  const columns: Column<any>[] = [
    { key: 'type', title: 'Turi', render: (i) => <AwardTypeChip type={i.awardType} /> },
    { key: 'title', title: 'Nomi', render: (i) => <span className="font-semibold">{i.title}</span> },
    {
      key: 'recipients',
      title: 'Oluvchilar',
      render: (i) => (
        <Badge variant="secondary" className="gap-1 font-bold">
          <Users className="h-3 w-3" /> {i.recipientsCount ?? 0}
        </Badge>
      ),
    },
    {
      key: 'value',
      title: 'Summa',
      render: (i) => i.valueAmount
        ? <span className="font-bold text-emerald-600">{Number(i.valueAmount).toLocaleString()} so'm</span>
        : <span className="text-muted-foreground">—</span>,
    },
    { key: 'issuedAt', title: 'Sana', render: (i) => dayjs(i.issuedAt).format('DD.MM.YYYY') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mukofotlar"
        description="O'quvchilarga beriladigan mukofotlar, stipendiyalar va nishonlar"
        action={{ label: "Mukofot qo'shish", icon: <Plus className="h-4 w-4" />, onClick: openCreate }}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {AWARD_TYPES.map((t) => {
          const byTypeEntry = Array.isArray(stats.byType)
            ? stats.byType.find((b: any) => b.awardType === t.value)
            : stats.byType?.[t.value];
          const byType = typeof byTypeEntry === 'number' ? { count: byTypeEntry } : byTypeEntry;
          const Icon = t.icon;
          return (
            <Card
              key={t.value}
              className={`cursor-pointer transition-all hover:border-primary/40 ${typeFilter === t.value ? 'border-primary ring-1 ring-primary' : ''}`}
              onClick={() => { setTypeFilter(typeFilter === t.value ? '' : t.value); setPage(1); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.label}</p>
                  <p className="text-2xl font-bold">{byType?.count ?? 0}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Mukofot nomidan qidirish..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1"
        />
        {typeFilter && (
          <Button variant="outline" onClick={() => setTypeFilter('')} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            {AWARD_TYPES.find((t) => t.value === typeFilter)?.label}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={awards}
        loading={isLoading}
        pagination={{ page, totalPages: meta.totalPages || 1, total: meta.total || 0, onPageChange: setPage }}
        actions={(item) => (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openRecipients(item)}>
              <UserPlus className="h-3.5 w-3.5" /> Oluvchilar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create / Edit */}
      <SlideOver open={formOpen} onOpenChange={setFormOpen} title={editing ? 'Tahrirlash' : 'Yangi mukofot'} size="md">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Mukofot nomi</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Masalan: 1-o'rin sovg'asi" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Turi</Label>
              <Select value={form.awardType} onValueChange={(v) => setForm({ ...form, awardType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AWARD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Berilgan sana</Label>
              <Input type="date" value={form.issuedAt} onChange={(e) => setForm({ ...form, issuedAt: e.target.value })} />
            </div>
          </div>
          {form.awardType === 'STIPEND' && (
            <div className="space-y-2">
              <Label>Summa (so'm)</Label>
              <Input type="number" placeholder="500000" value={form.valueAmount} onChange={(e) => setForm({ ...form, valueAmount: e.target.value })} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Tavsif (ixtiyoriy)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mukofot haqida qo'shimcha ma'lumot..." rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Saqlash' : "Yaratish →"}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Recipients panel */}
      <SlideOver open={recipientsOpen} onOpenChange={setRecipientsOpen} title="Mukofot oluvchilar" size="lg">
        {activeAward && (
          <div className="flex flex-col gap-5">
            <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-3 border">
              <AwardTypeChip type={activeAward.awardType} />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{activeAward.title}</p>
                {activeAward.valueAmount && (
                  <p className="text-xs text-emerald-600">{Number(activeAward.valueAmount).toLocaleString()} so'm</p>
                )}
              </div>
            </div>

            {/* Current recipients */}
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Hozirgi oluvchilar
              </p>
              {detailLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin opacity-50" /></div>
              ) : (awardDetail?.recipients || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">Hali belgilanmagan</p>
              ) : (
                <div className="space-y-1.5">
                  {(awardDetail?.recipients || []).map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-md border bg-card text-sm">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {(r.studentName || r.groupName || '?')[0]}
                      </div>
                      <span className="font-medium flex-1">{r.studentName || r.groupName}</span>
                      {r.note && <span className="text-xs text-muted-foreground">({r.note})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new recipients */}
            <div className="border-t pt-4">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Yangi qo'shish</p>
              <Input
                placeholder="Ism bo'yicha qidirish..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Topilmadi</p>
                ) : filteredStudents.map((s: any) => {
                  const id = String(s.id);
                  const name = s.fullName || s.full_name;
                  const group = s.groupName || s.group_name || s.currentGroupName || '';
                  const isExisting = existingIds.has(id);
                  const isSelected = selectedStudentIds.includes(id);
                  return (
                    <label key={id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 text-sm ${isExisting ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" checked={isSelected} disabled={isExisting} onChange={() => !isExisting && toggleStudent(id)} className="rounded accent-primary" />
                      <span className="flex-1 font-medium">{name}</span>
                      {group && <span className="text-xs text-muted-foreground">{group}</span>}
                      {isExisting && <Badge variant="secondary" className="text-[9px] py-0 h-4">Mavjud</Badge>}
                    </label>
                  );
                })}
              </div>

              {selectedStudentIds.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge>{selectedStudentIds.length} tanlandi</Badge>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedStudentIds([])}>
                    <X className="h-3 w-3 inline" /> bekor
                  </button>
                </div>
              )}

              <div className="mt-3">
                <Input placeholder="Izoh (ixtiyoriy)..." value={recipientNote} onChange={(e) => setRecipientNote(e.target.value)} />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRecipientsOpen(false)}>Yopish</Button>
                <Button onClick={handleSaveRecipients} disabled={selectedStudentIds.length === 0 || setRecipientsMut.isPending}>
                  {setRecipientsMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserPlus className="mr-2 h-4 w-4" />
                  Saqlash ({selectedStudentIds.length})
                </Button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="O'chirish"
        description={`"${deleting?.title}" mukofotini o'chirishga ishonchingiz komilmi?`}
        confirmText="O'chirish"
        variant="destructive"
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  );
}
