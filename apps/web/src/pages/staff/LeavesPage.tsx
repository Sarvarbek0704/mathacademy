import { useState } from 'react';
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
  CheckCircle2,
  XCircle,
  Clock,
  UserCircle2,
  FileText,
  MoreVertical,
  Trash2,
  Info,
  Plus,
  Loader2,
  CalendarDays,
  Check,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function LeavesPage() {
  const queryClient = useQueryClient();
  const { data, loading, total, page, totalPages, setSearch, setPage, create } = useCrud({
    endpoint: '/staff/leaves',
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | 'CLOSE' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Form state for creation
  const [form, setForm] = useState({
    studentId: '',
    reason: '',
    startAt: '',
    endAt: '',
    requestedBy: 'STUDENT_VERBAL',
    notes: '',
  });

  const { data: studentsRes } = useQuery({
    queryKey: ['staff', 'students', 'for_leaves'],
    queryFn: async () => (await api.get('/staff/students?limit=200')).data,
  });
  const studentsList = studentsRes?.data || [];

  // Decision Mutations
  const decisionMutation = useMutation({
    mutationFn: async ({ id, type, notes }: { id: string; type: string; notes?: string }) => {
      const endpoint = `/staff/leaves/${id}/${type.toLowerCase()}`;
      return api.post(endpoint, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'leaves'] });
      toast.success('Amal muvaffaqiyatli bajarildi');
      setDecisionOpen(false);
      setDecisionNotes('');
      setSelectedLeave(null);
    },
    onError: () => toast.error('Xatolik yuz berdi'),
  });

  const requestedByLabels: Record<string, string> = {
    STUDENT_VERBAL: "O'quvchi og'zaki",
    GUARDIAN_CALL: "Ota-ona qo'ng'irog'i",
    OTHER: 'Boshqa',
  };

  const columns: Column<any>[] = [
    {
      key: 'student',
      title: "O'quvchi",
      render: (i) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {i.studentName || i.student?.fullName || i.student?.full_name || '-'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {i.groupName || i.student?.group?.name || 'Guruhsiz'}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      title: 'Sabab',
      render: (i) => (
        <div className="flex flex-col">
          <span className="max-w-xs truncate block text-xs">{i.reason}</span>
          <span className="text-[10px] text-muted-foreground">{requestedByLabels[i.requestedBy] || i.requestedBy}</span>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Holat',
      render: (i) => <StatusBadge status={i.status || 'PENDING'} />,
    },
    {
      key: 'dates',
      title: 'Muddat',
      render: (i) => (
        <div className="flex flex-col text-[11px]">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" />{' '}
            {dayjs(i.startAt || i.start_at).format('DD.MM.YY HH:mm')}
          </span>
          <span className="flex items-center gap-1 opacity-60">
            <Check className="h-3 w-3" /> {dayjs(i.endAt || i.end_at).format('DD.MM.YY HH:mm')}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      title: 'Amallar',
      render: (i) => (
        <div className="flex gap-1">
          {i.status === 'PENDING' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                title="Tasdiqlash"
                onClick={() => {
                  setSelectedLeave(i);
                  setDecisionType('APPROVE');
                  setDecisionOpen(true);
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                title="Rad etish"
                onClick={() => {
                  setSelectedLeave(i);
                  setDecisionType('REJECT');
                  setDecisionOpen(true);
                }}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {i.status === 'APPROVED' && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-[10px]"
              onClick={() => {
                setSelectedLeave(i);
                setDecisionType('CLOSE');
                setDecisionOpen(true);
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Qaytdi
            </Button>
          )}
        </div>
      ),
    },
  ];

  const handleCreate = async () => {
    const payload = {
      ...form,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
    };
    await create(payload);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ta'til boshqaruvi"
        description="O'quvchilarning chiqib-kelishi va ta'til so'rovlarini boshqarish"
        action={{
          label: "Yangi so'rov",
          icon: <Plus className="h-4 w-4" />,
          onClick: () => {
            setForm({
              studentId: '',
              reason: '',
              startAt: dayjs().format('YYYY-MM-DDTHH:mm'),
              endAt: dayjs().add(1, 'day').format('YYYY-MM-DDTHH:mm'),
              requestedBy: 'STUDENT_VERBAL',
              notes: '',
            });
            setModalOpen(true);
          },
        }}
      />

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data}
            loading={loading}
            searchable
            onSearch={setSearch}
            pagination={{ page, totalPages, total, onPageChange: setPage }}
          />
        </CardContent>
      </Card>

      {/* Decision SlideOver */}
      <SlideOver
        open={decisionOpen}
        onOpenChange={setDecisionOpen}
        title={
          decisionType === 'APPROVE'
            ? "So'rovni tasdiqlash"
            : decisionType === 'REJECT'
              ? "So'rovni rad etish"
              : "So'rovni yopish (Keldi)"
        }
        size="sm"
      >
        <div className="space-y-6">
          {selectedLeave && (
            <div className="bg-muted/50 p-4 rounded-xl border space-y-3">
              <div className="flex items-center gap-3">
                <UserCircle2 className="h-10 w-10 text-primary opacity-60" />
                <div>
                  <p className="font-semibold text-sm">
                    {selectedLeave.studentName || selectedLeave.student?.fullName || selectedLeave.student?.full_name}
                  </p>
                  <StatusBadge status={selectedLeave.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Ketish</p>
                  <p className="text-xs font-medium">
                    {dayjs(selectedLeave.startAt || selectedLeave.start_at).format(
                      'DD.MM.YYYY HH:mm',
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase">Kelish</p>
                  <p className="text-xs font-medium">
                    {dayjs(selectedLeave.endAt || selectedLeave.end_at).format('DD.MM.YYYY HH:mm')}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase">Sabab</p>
                <p className="text-xs">{selectedLeave.reason}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Qaror haqida izoh (ixtiyoriy)</Label>
            <Textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder="Sabab yoki qo'shimcha ko'rsatmalar..."
              className="min-h-[120px]"
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setDecisionOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button
              className={cn(
                'w-full sm:w-auto gap-2',
                decisionType === 'APPROVE'
                  ? 'bg-green-600 hover:bg-green-700'
                  : decisionType === 'REJECT'
                    ? 'bg-destructive hover:bg-destructive/90'
                    : '',
              )}
              disabled={decisionMutation.isPending}
              onClick={() =>
                decisionMutation.mutate({
                  id: selectedLeave.id,
                  type: decisionType!,
                  notes: decisionNotes,
                })
              }
            >
              {decisionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {decisionType === 'APPROVE'
                ? 'Tasdiqlash'
                : decisionType === 'REJECT'
                  ? 'Rad etish'
                  : 'Tugatish/Yopish'}
            </Button>
          </div>
        </div>
      </SlideOver>

      {/* Creation SlideOver */}
      <SlideOver
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Yangi ta'til so'rovi"
        size="sm"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>O'quvchi</Label>
            <Select
              value={form.studentId}
              onValueChange={(v) => setForm({ ...form, studentId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="O'quvchini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {studentsList.map((s: any) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.fullName || s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Boshlanishi</Label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tugashi</Label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kim orqali</Label>
            <Select
              value={form.requestedBy}
              onValueChange={(v) => setForm({ ...form, requestedBy: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(requestedByLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sabab</Label>
            <Textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ketish sababi..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Qo'shimcha izoh</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Ixtiyoriy..."
              rows={2}
            />
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(false)}
            >
              Bekor qilish
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleCreate}>
              Sorovni yaratish
            </Button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
