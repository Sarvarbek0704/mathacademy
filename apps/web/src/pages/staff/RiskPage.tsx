import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/shared/StatCard';
import { 
  AlertTriangle, ShieldAlert, ShieldCheck, Filter, 
  Users, TrendingUp, AlertCircle, PlusCircle, Save, Loader2 
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function RiskPage() {
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [scoreValue, setScoreValue] = useState<string>('50');
  const [note, setNote] = useState<string>('');

  // Fetch groups
  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'list'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
    onSuccess: (data) => {
      if (data.data?.length > 0 && !groupId) {
        setGroupId(data.data[0].id);
      }
    }
  });

  // Fetch latest risk by group
  const { data: riskRes, isLoading } = useQuery({
    queryKey: ['staff', 'risk', 'group', groupId],
    queryFn: async () => (await api.get(`/staff/risk/latest/group/${groupId}`)).data,
    enabled: !!groupId,
  });

  // Manual Risk Score Mutation
  const riskMutation = useMutation({
    mutationFn: async (payload: any) => (await api.post('/staff/risk/scores', payload)).data,
    onSuccess: () => {
      toast.success('Risk koʻrsatkichi muvaffaqiyatli saqlandi');
      queryClient.invalidateQueries({ queryKey: ['staff', 'risk', 'group', groupId] });
      setModalOpen(false);
      setSelectedStudent('');
      setNote('');
    }
  });

  const students = riskRes?.data || [];
  const totalStudents = students.length || 1;
  const greenCount = students.filter((s: any) => s.level === 'GREEN').length;
  const yellowCount = students.filter((s: any) => s.level === 'YELLOW').length;
  const redCount = students.filter((s: any) => s.level === 'RED').length;

  const getPercent = (count: number) => Math.round((count / totalStudents) * 100);

  const columns: Column<any>[] = [
    { key: 'studentName', title: "O'quvchi", render: (i) => (
      <div className="flex flex-col">
        <span className="font-semibold">{i.studentName}</span>
        <span className="text-[10px] text-muted-foreground uppercase">ID: {i.studentId}</span>
      </div>
    )},
    { key: 'score', title: 'Risk Score', render: (i) => (
      <div className="flex items-center gap-2">
        <span className={`font-mono font-bold ${i.score > 66 ? 'text-destructive' : i.score > 33 ? 'text-warning' : 'text-success'}`}>
          {i.score ?? 'N/A'}
        </span>
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
          <div 
            className={`h-full ${i.score > 66 ? 'bg-destructive' : i.score > 33 ? 'bg-warning' : 'bg-success'}`}
            style={{ width: `${i.score || 0}%` }}
          />
        </div>
      </div>
    )},
    { key: 'level', title: 'Holat', render: (i) => <StatusBadge status={i.level || 'GREEN'} /> },
    { key: 'calculatedAt', title: 'Sana', render: (i) => i.calculatedAt ? new Date(i.calculatedAt).toLocaleDateString('uz') : '-' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    riskMutation.mutate({
      studentId: selectedStudent,
      score: parseInt(scoreValue, 10),
      note
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Xavf monitoringi (Risk Analysis)" description="O'quvchilarning akademik va intizomiy xavf darajalari" />
        
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Guruhni tanlang
            </Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[200px] h-10 border-primary/20 bg-primary/5">
                <SelectValue placeholder="Guruhlar..." />
              </SelectTrigger>
              <SelectContent>
                {(groupsRes?.data || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setModalOpen(true)} className="gap-2 h-10">
            <PlusCircle className="h-4 w-4" />
            Baholash
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard 
          title="Yashil zona" 
          value={`${getPercent(greenCount)}%`} 
          icon={<ShieldCheck className="h-6 w-6" />} 
          color="success" 
          description={`${greenCount} ta o'quvchi xavfsiz holatda`} 
        />
        <StatCard 
          title="Sariq zona" 
          value={`${getPercent(yellowCount)}%`} 
          icon={<AlertTriangle className="h-6 w-6" />} 
          color="warning" 
          description={`${yellowCount} ta o'quvchi monitoringda`} 
        />
        <StatCard 
          title="Qizil zona" 
          value={`${getPercent(redCount)}%`} 
          icon={<ShieldAlert className="h-6 w-6" />} 
          color="destructive" 
          description={`${redCount} ta o'quvchi yuqori xavf ostida`} 
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Guruh reytingi va risk ko'rsatkichlari
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            Jami: {students.length} ta o'quvchi
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable 
            columns={columns} 
            data={students} 
            loading={isLoading}
            emptyMessage="Guruh tanlanmagan yoki ma'lumot mavjud emas"
            actions={(item) => (
              <Button variant="ghost" size="sm" onClick={() => {
                setSelectedStudent(item.studentId);
                setModalOpen(true);
              }}>
                <AlertCircle className="h-4 w-4" />
              </Button>
            )}
          />
        </CardContent>
      </Card>

      <SlideOver 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
        title="Risk darajasini belgilash" 
        description="O'quvchi uchun qo'lda risk ballini kiriting yoki o'zgartiring"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>O'quvchini tanlang</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Talabani tanlang..." />
              </SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.studentId} value={s.studentId}>{s.studentName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Risk Ko'rsatkichi (0-100)</Label>
              <span className={`font-bold px-2 py-0.5 rounded ${
                parseInt(scoreValue) > 66 ? 'bg-destructive/10 text-destructive' :
                parseInt(scoreValue) > 33 ? 'bg-warning/10 text-warning' :
                'bg-success/10 text-success'
              }`}>
                {scoreValue}
              </span>
            </div>
            <Input 
              type="range" 
              min="0" 
              max="100" 
              step="1" 
              value={scoreValue} 
              onChange={e => setScoreValue(e.target.value)}
              className="accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold px-1">
              <span>Xavfsiz</span>
              <span>O'rta</span>
              <span>Xavfli</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Izoh (Signal)</Label>
            <Textarea 
              placeholder="Nima sababdan bu daraja tanlandi? (masalan: ko'p dars qoldirgani uchun)" 
              value={note}
              onChange={e => setNote(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" className="w-full gap-2" disabled={riskMutation.isPending || !selectedStudent}>
              {riskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Saqlash
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setModalOpen(false)}>
              Bekor qilish
            </Button>
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
