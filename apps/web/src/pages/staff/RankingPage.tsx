import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Calendar, Users, Eye, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RankingPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('live');
  const [groupId, setGroupId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewingSnapshot, setViewingSnapshot] = useState<any>(null);

  // Fetch Groups for selector
  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups', 'list'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data,
    onSuccess: (data) => {
      if (data.data?.length > 0 && !groupId) {
        setGroupId(data.data[0].id);
      }
    }
  });

  // Fetch Live Ranking
  const { data: liveRes, isLoading: isLiveLoading, refetch: refetchLive } = useQuery({
    queryKey: ['staff', 'ranking', 'live', groupId, dateFrom, dateTo],
    queryFn: async () => (await api.get(`/staff/ranking/live?groupId=${groupId}&from=${dateFrom}&to=${dateTo}`)).data,
    enabled: !!groupId && activeTab === 'live',
  });

  // Fetch Snapshots List
  const { data: snapshotsRes, isLoading: isSnapshotsLoading } = useQuery({
    queryKey: ['staff', 'ranking', 'snapshots', groupId],
    queryFn: async () => (await api.get(`/staff/ranking/snapshots?groupId=${groupId}`)).data,
    enabled: !!groupId && activeTab === 'snapshots',
  });

  // Fetch Snapshot Rows (when viewing a specific snapshot)
  const { data: snapshotRowsRes, isLoading: isRowsLoading } = useQuery({
    queryKey: ['staff', 'ranking', 'snapshots', viewingSnapshot?.id, 'rows'],
    queryFn: async () => (await api.get(`/staff/ranking/snapshots/${viewingSnapshot.id}`)).data,
    enabled: !!viewingSnapshot,
  });

  // Create Snapshot Mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      return (await api.post('/staff/ranking/snapshots', {
        groupId,
        periodType: 'MONTH',
        periodStart: dateFrom,
        periodEnd: dateTo
      })).data;
    },
    onSuccess: () => {
      toast.success('Snapshot muvaffaqiyatli yaratildi');
      queryClient.invalidateQueries({ queryKey: ['staff', 'ranking', 'snapshots', groupId] });
    }
  });

  const liveData = liveRes?.data || [];
  const snapshotData = snapshotsRes?.data || [];
  const snapshotRows = snapshotRowsRes?.rows || [];

  const mainData = viewingSnapshot ? snapshotRows : liveData;
  const topData = mainData.slice(0, 10).map((r: any) => ({
    name: r.studentName,
    score: parseFloat(r.totalScore || 0)
  }));

  const rankingColumns: Column<any>[] = [
    { key: 'rank', title: '#', render: (item) => <span className="font-bold text-lg">{item.rank ?? '-'}</span> },
    { key: 'studentName', title: "O'quvchi", render: (i) => <span className="font-semibold">{i.studentName}</span> },
    { key: 'totalScore', title: 'Umumiy ball', render: (i) => <span className="font-mono font-bold text-primary">{i.totalScore ?? '0.00'}</span> },
    { key: 'riskLevel', title: 'Risk holati', render: (i) => <StatusBadge status={i.riskLevel || 'GREEN'} /> },
  ];

  const snapshotColumns: Column<any>[] = [
    { key: 'periodStart', title: 'Davr', render: (i) => (
      <div className="text-sm">
        <p className="font-medium">{new Date(i.periodStart).toLocaleDateString('uz')} - {new Date(i.periodEnd).toLocaleDateString('uz')}</p>
        <p className="text-muted-foreground text-xs">{i.periodType}</p>
      </div>
    )},
    { key: 'generatedAt', title: 'Yaratilgan sana', render: (i) => <span className="text-sm text-muted-foreground">{new Date(i.generatedAt).toLocaleString('uz')}</span> },
    { key: 'rowsCount', title: "O'quvchilar", render: (i) => <span className="font-bold">{i.rowsCount} ta</span> },
  ];

  const groups = groupsRes?.data || [];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader title="Akademik Reyting" description="Guruhlar bo'yicha o'quvchilar natijalari va snapshotlar" />
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Guruh</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dan</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Gacha</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>

          <Button variant="outline" size="icon" className="mt-5 h-9 w-9" onClick={() => refetchLive()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b mb-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Top 10 O'quvchilar
            </CardTitle>
            {activeTab === 'live' && (
              <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => createSnapshotMutation.mutate()} disabled={createSnapshotMutation.isPending}>
                <PlusCircle className="h-4 w-4" />
                Snapshot saqlash
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {mainData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                <Users className="h-10 w-10 mb-2 opacity-20" />
                Ma'lumot topilmadi
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topData} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} axisLine={false} tickLine={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--primary)/0.05)' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} 
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {topData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index < 3 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 border-b mb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Guruh statistikasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex justify-between items-center py-2 border-b border-dashed">
              <span className="text-sm text-muted-foreground">O'rtacha ball</span>
              <span className="font-bold">{(mainData.reduce((acc: number, cur: any) => acc + parseFloat(cur.totalScore || 0), 0) / (mainData.length || 1)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dashed">
              <span className="text-sm text-muted-foreground">Eng yuqori ball</span>
              <span className="font-bold text-success">{mainData[0]?.totalScore || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Eng past ball</span>
              <span className="font-bold text-destructive">{mainData[mainData.length - 1]?.totalScore || '0.00'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="live" className="w-full" onValueChange={(v) => { setActiveTab(v); setViewingSnapshot(null); }}>
        <TabsList className="grid w-full grid-cols-2 mb-6 max-w-md">
          <TabsTrigger value="live">Jonli reyting</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshotlar</TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          <Card>
            <CardContent className="p-0">
              <DataTable 
                columns={rankingColumns} 
                data={liveData} 
                loading={isLiveLoading} 
                emptyMessage="Ushbu davr uchun ma'lumot topilmadi"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snapshots">
          {viewingSnapshot ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg border">
                <div>
                  <h3 className="font-bold">{viewingSnapshot.groupName} - Snapshot natijalari</h3>
                  <p className="text-xs text-muted-foreground">
                    Davr: {new Date(viewingSnapshot.periodStart).toLocaleDateString('uz')} - {new Date(viewingSnapshot.periodEnd).toLocaleDateString('uz')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewingSnapshot(null)}>
                  Ro'yxatga qaytish
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <DataTable 
                    columns={rankingColumns} 
                    data={snapshotRows} 
                    loading={isRowsLoading}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <DataTable 
                  columns={snapshotColumns} 
                  data={snapshotData} 
                  loading={isSnapshotsLoading}
                  actions={(item) => (
                    <Button variant="ghost" size="sm" onClick={() => setViewingSnapshot(item)} className="gap-2">
                      <Eye className="h-4 w-4" />
                      Ko'rish
                    </Button>
                  )}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
