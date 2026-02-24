import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/StatCard';
import { 
  Trophy, UserCheck, Clock, User, Megaphone, 
  AlertTriangle, Loader2, TrendingUp, ClipboardList, Receipt
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function GuardianDashboard() {
  const navigate = useNavigate();
  
  const { data: dashboardRes, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['guardian', 'dashboard'],
    queryFn: async () => (await api.get('/guardian/student')).data
  });

  const { data: timetableRes } = useQuery({
    queryKey: ['guardian', 'timetable'],
    queryFn: async () => (await api.get('/guardian/timetable')).data
  });

  const { data: announcementsRes } = useQuery({
    queryKey: ['guardian', 'announcements'],
    queryFn: async () => (await api.get('/guardian/announcements')).data
  });

  if (isLoadingDashboard) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const student = dashboardRes;
  const nextLesson = timetableRes?.timetable?.lessonsByDay?.[0]?.lessons?.[0];
  const latestAnnouncement = announcementsRes?.data?.[0];

  // Mock data for charts (can be replaced with real data if available in API)
  const gradeData = [
    { subject: 'Matematika', score: 90 },
    { subject: 'Fizika', score: 85 },
    { subject: 'Kimyo', score: 78 },
    { subject: 'Adabiyot', score: 92 },
    { subject: 'Tarix', score: 88 },
  ];

  const pieData = [
    { name: "A'lo", value: 40 },
    { name: 'Yaxshi', value: 30 },
    { name: 'Qoniqarli', value: 20 },
    { name: 'Qoniqarsiz', value: 10 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Xayrli kun!
          </h1>
          <p className="text-muted-foreground font-medium">
            {student?.fullName} ning o'quv faoliyati haqida umumiy ma'lumot
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Reyting" value={student?.ranking || "N/A"} icon={<Trophy className="h-5 w-5" />} color="primary" description="Guruhdagi o'rni" />
        <StatCard title="Davomat" value={student?.attendancePercentage ? `${student.attendancePercentage}%` : "98%"} icon={<UserCheck className="h-5 w-5" />} color="success" trend={{ value: 2.1, label: "o'tgan haftaga" }} />
        <StatCard title="O'rtacha ball" value={student?.averageGrade || "85.4"} icon={<ClipboardList className="h-5 w-5" />} color="info" />
        <StatCard title="To'lanmagan" value={student?.pendingInvoices || "0"} icon={<AlertTriangle className="h-5 w-5" />} color="warning" description="hisob-fakturalar" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Lesson Card */}
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-3 border-b border-primary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
              <Clock className="h-4 w-4" /> Navbatdagi dars
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {nextLesson ? (
              <div className="space-y-4">
                <div className="text-xl font-black text-foreground">{nextLesson.subject}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4 text-primary/70" /> {nextLesson.teacher}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs font-bold bg-background text-primary px-3 py-1.5 rounded-full border border-primary/20 shadow-sm flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {nextLesson.startsAt} - {nextLesson.endsAt}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                      {nextLesson.room}-xona
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground italic text-sm">Hozircha darslar yo'q</div>
            )}
            <Button variant="ghost" className="w-full mt-6 text-xs h-9 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => navigate('/guardian/timetable')}>
              To'liq jadvalni ko'rish
            </Button>
          </CardContent>
        </Card>

        {/* Latest Announcement */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary uppercase tracking-wider">
              <Megaphone className="h-4 w-4" /> So'nggi e'lon
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            {latestAnnouncement ? (
              <div className="space-y-3">
                <div className="text-lg font-bold text-foreground line-clamp-1">{latestAnnouncement.title}</div>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {latestAnnouncement.content}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(latestAnnouncement.publishedAt).toLocaleDateString('uz', { month: 'long', day: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span className="text-primary/80">Ma'muriyat</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground italic text-sm">E'lonlar mavjud emas</div>
            )}
            <Button variant="outline" className="w-full mt-6 text-xs h-9 border-dashed hover:border-solid transition-all" onClick={() => navigate('/guardian/announcements')}>
              Barcha yangiliklarni ko'rish
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Oylik fan o'zlashtirishi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.4)' }} 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  />
                  <Bar dataKey="score" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Baholar taqsimoti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={pieData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={70} 
                    outerRadius={100} 
                    paddingAngle={8} 
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
