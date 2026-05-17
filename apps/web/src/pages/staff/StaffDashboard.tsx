import { useNavigate } from 'react-router-dom';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GraduationCap, Users, UserCheck, AlertTriangle, DollarSign,
  Trophy, TrendingUp, Clock, BookOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

const COLORS = ['hsl(160,60%,40%)', 'hsl(210,90%,52%)', 'hsl(38,92%,50%)', 'hsl(280,60%,50%)', 'hsl(0,72%,51%)'];

export default function StaffDashboard() {
  const navigate = useNavigate();

  const { data: currentAy } = useQuery({
    queryKey: ['academic-years', 'current'],
    queryFn: async () => {
      const res = await api.get('/staff/academic-years/current');
      return res.data?.data;
    }
  });

  const { data: studentStats, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['staff', 'students', 'statistics'],
    queryFn: async () => {
      const res = await api.get('/staff/students/statistics/summary');
      return res.data;
    }
  });

  const { data: riskStats } = useQuery({
    queryKey: ['staff', 'risk', 'summary'],
    queryFn: async () => {
      const res = await api.get('/staff/risk');
      return res.data;
    }
  });

  const { data: billingStats } = useQuery({
    queryKey: ['staff', 'billing', 'summary'],
    queryFn: async () => {
      const res = await api.get('/staff/billing/summary');
      return res.data;
    }
  });

  const { data: attendanceStats } = useQuery({
    queryKey: ['staff', 'attendance', 'stats'],
    queryFn: async () => {
      const res = await api.get('/staff/attendance/stats');
      return res.data;
    }
  });

  const { data: staffStats } = useQuery({
    queryKey: ['staff', 'users', 'count'],
    queryFn: async () => {
      const res = await api.get('/staff/users/summary/count');
      return res.data;
    }
  });

  const { data: disciplineSummary } = useQuery({
    queryKey: ['staff', 'discipline', 'summary'],
    queryFn: async () => {
      const res = await api.get('/staff/discipline/summary');
      return res.data;
    }
  });

  const { data: eventSummary } = useQuery({
    queryKey: ['staff', 'events', 'summary'],
    queryFn: async () => {
      const res = await api.get('/staff/events/summary');
      return res.data;
    }
  });

  const { data: performanceSummary } = useQuery({
    queryKey: ['staff', 'assessments', 'summary'],
    queryFn: async () => {
      const res = await api.get('/staff/assessments/summary');
      return res.data;
    }
  });
  
  const { data: registrationTrend } = useQuery({
    queryKey: ['staff', 'students', 'registrations'],
    queryFn: async () => {
      const res = await api.get('/staff/students/summary/registrations');
      return res.data;
    }
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ['staff', 'billing', 'pending-payments'],
    queryFn: async () => {
      const res = await api.get('/staff/billing/summary/pending-payments');
      return res.data;
    }
  });

  const { data: teacherWorkload } = useQuery({
    queryKey: ['staff', 'users', 'workload'],
    queryFn: async () => {
      const res = await api.get('/staff/users/summary/workload');
      return res.data;
    }
  });

  const { data: upcomingEvents } = useQuery({
    queryKey: ['staff', 'events', 'upcoming'],
    queryFn: async () => {
      const res = await api.get('/staff/events/summary/upcoming');
      return res.data;
    }
  });

  const { data: upcomingAssessments } = useQuery({
    queryKey: ['staff', 'assessments', 'upcoming'],
    queryFn: async () => {
      const res = await api.get('/staff/assessments/summary/upcoming');
      return res.data;
    }
  });

  // Calculate dynamic data
  const gradeDistribution = studentStats?.byAdmissionGrade?.map((g: any) => ({
    name: `${g.grade}-sinf`,
    value: g.count
  })) || [];

  const performanceDistribution = performanceSummary?.gradeDistribution || [];

  const trackDistribution = studentStats?.byTrack?.map((t: any) => ({
    name: t.trackName,
    value: t.count
  })) || [];

  const totalStudents = studentStats?.byStatus?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0;
  const activeStudents = studentStats?.byStatus?.find((s: any) => s.status === 'ACTIVE')?.count || 0;

  const riskData = [
    { name: 'Yashil', value: riskStats?.summary?.low || 0, color: 'hsl(152,60%,40%)' },
    { name: 'Sariq', value: riskStats?.summary?.medium || 0, color: 'hsl(38,92%,50%)' },
    { name: 'Qizil', value: riskStats?.summary?.high || 0, color: 'hsl(0,72%,51%)' },
  ];

  const attendanceChartData = attendanceStats?.weekly || [];
  const revenueTrendData = billingStats?.revenueTrend || [];

  if (isLoadingStudents) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Akademiya umumiy ko'rinishi 
            {currentAy ? ` (${currentAy.name})` : ' (Mavjud akademik yil belgilanmagan)'}
          </p>
        </div>
      </div>

      {/* Stats - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Jami o'quvchilar" 
          value={totalStudents.toString()} 
          icon={<GraduationCap className="h-5 w-5" />}
          color="primary" 
          description={`${activeStudents} faol stausda`}
          onClick={() => navigate('/staff/students')}
        />
        <StatCard 
          title="Guruhlar soni" 
          value={studentStats?.groupCount || "0"} 
          icon={<Users className="h-5 w-5" />}
          color="info" 
          description="Jami faol guruhlar"
          onClick={() => navigate('/staff/groups')}
        />
        <StatCard 
          title="Bugungi davomat" 
          value={attendanceStats?.today?.total ? `${((attendanceStats.today.present / attendanceStats.today.total) * 100).toFixed(0)}%` : '0%'} 
          icon={<UserCheck className="h-5 w-5" />}
          color="success"
          description={`${attendanceStats?.today?.present || 0} nafar kelgan`}
          onClick={() => navigate('/staff/attendance')}
        />
        <StatCard 
          title="Risk zonasida" 
          value={String(riskStats?.summary?.high || 0)} 
          icon={<AlertTriangle className="h-5 w-5" />}
          color="destructive" 
          description="Qizil zonadagi o'quvchilar"
          onClick={() => navigate('/staff/students?status=high-risk')}
        />
      </div>

      {/* Stats - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Xodimlar" 
          value={String(staffStats?.count || 0)} 
          icon={<Users className="h-5 w-5" />}
          color="info" 
          description="Tizimdagi faol xodimlar"
          onClick={() => navigate('/staff/users')}
        />
        <StatCard 
          title="Faol tadbirlar" 
          value={String(eventSummary?.activeCount || 0)} 
          icon={<Trophy className="h-5 w-5" />}
          color="accent" 
          description="Haftalik tadbirlar soni"
          onClick={() => navigate('/staff/events')}
        />
        <StatCard 
          title="O'rtacha ball" 
          value={String(performanceSummary?.averageScore || 0)} 
          icon={<TrendingUp className="h-5 w-5" />}
          color="success" 
          description="Barcha imtihonlar bo'yicha"
          onClick={() => navigate('/staff/assessments')}
        />
        <StatCard 
          title="Qoidabuzarliklar" 
          value={String(disciplineSummary?.violationCount || 0)} 
          icon={<Clock className="h-5 w-5" />}
          color="destructive" 
          description="Oxirgi 30 kun ichida"
          onClick={() => navigate('/staff/violations')}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Haftalik davomat (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                <Legend />
                <Bar dataKey="present" name="Kelgan" fill="hsl(152,60%,40%)" radius={[4,4,0,0]} />
                <Bar dataKey="absent" name="Kelmagan" fill="hsl(0,72%,51%)" radius={[4,4,0,0]} />
                <Bar dataKey="late" name="Kechikkan" fill="hsl(38,92%,50%)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">O'zlashtirish ko'rsatkichi (Baholar)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie 
                  data={performanceDistribution} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  innerRadius={55}
                  dataKey="value" 
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} 
                  fontSize={12}
                >
                  {performanceDistribution.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">O'quvchi vs Davomat Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="total" name="Jami o'quvchi" stroke="hsl(210,90%,52%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="present" name="Kelganlar" stroke="hsl(152,60%,40%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Oxirgi qoidabuzarliklar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">O'quvchi</th>
                    <th className="text-left py-2 font-medium">Qoida</th>
                    <th className="text-left py-2 font-medium">Daraja</th>
                    <th className="text-left py-2 font-medium">Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {disciplineSummary?.lastViolations?.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2">{v.studentName}</td>
                      <td className="py-2">{v.ruleCode}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          v.severity === 'HIGH' ? 'bg-red-100 text-red-700' :
                          v.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {v.severity}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(v.detectedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {(!disciplineSummary?.lastViolations || disciplineSummary.lastViolations.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">Ma'lumotlar mavjud emas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">O'quvchilar qabuli trendi (30 kun)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={registrationTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(str) => str.split('-').slice(1).join('/')} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="count" name="Yangi o'quvchilar" stroke="hsl(210,90%,52%)" fill="hsl(210,90%,52%)" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">O'qituvchilar yuklamasi (Darslar soni)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teacherWorkload || []} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                <Bar dataKey="lessons" name="Darslar" fill="hsl(280,60%,50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Payments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Kutilayotgan to'lovlar</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingPayments?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{p.studentName}</p>
                    <p className="text-xs text-muted-foreground">{p.type === 'COURSE' ? 'Kurs' : p.type === 'MEAL' ? 'Ovqat' : 'Yotoqxona'} • {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'Muddat belgilanmagan'}</p>
                  </div>
                  <div className="text-sm font-semibold">
                    {p.amount.toLocaleString()} so'm
                  </div>
                </div>
              ))}
              {(!pendingPayments || pendingPayments.length === 0) && (
                <p className="text-sm text-center text-muted-foreground py-4">Qarzdorliklar mavjud emas</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Yaqinlashib kelayotgan tadbir va imtihonlar</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Combine and sort upcoming items */}
              {[
                ...(upcomingEvents || []).map((e: any) => ({ ...e, type: 'EVENT' })),
                ...(upcomingAssessments || []).map((a: any) => ({ ...a, type: 'ASSESSMENT' }))
              ]
                .sort((a, b) => new Date(a.startAt || a.heldAt).getTime() - new Date(b.startAt || b.heldAt).getTime())
                .slice(0, 5)
                .map((item: any) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 border-b pb-2 last:border-0 last:pb-0">
                    <div className={`p-2 rounded-lg ${item.type === 'EVENT' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
                      {item.type === 'EVENT' ? <Trophy className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.type === 'EVENT' ? item.location || 'Akademiya' : `${item.groupName} • ${item.subjectName}`}
                        {' • '}
                        {new Date(item.startAt || item.heldAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              {(!(upcomingEvents?.length || upcomingAssessments?.length)) && (
                <p className="text-sm text-center text-muted-foreground py-4">Yaqin orada tadbirlar yo'q</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Moliyaviy trend (ming so'm)</CardTitle>
          <p className="text-sm text-muted-foreground">So'nggi 6 oylik tushumlar tahlili</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="kurs" name="Kurs to'lovi" stackId="1" stroke="hsl(220,65%,28%)" fill="hsl(220,65%,28%)" fillOpacity={0.6} />
              <Area type="monotone" dataKey="ovqat" name="Ovqat" stackId="1" stroke="hsl(160,60%,40%)" fill="hsl(160,60%,40%)" fillOpacity={0.6} />
              <Area type="monotone" dataKey="yotoq" name="Yotoqxona" stackId="1" stroke="hsl(38,92%,50%)" fill="hsl(38,92%,50%)" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
