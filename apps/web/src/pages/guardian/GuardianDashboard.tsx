import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/StatCard';
import {
  Trophy,
  UserCheck,
  Clock,
  User,
  Megaphone,
  AlertTriangle,
  Loader2,
  ClipboardList,
  Bell,
  CalendarDays,
  ShieldAlert,
  BookOpenCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const WEEK_DAYS_UZ: Record<string, string> = {
  Monday: 'Dushanba',
  Tuesday: 'Seshanba',
  Wednesday: 'Chorshanba',
  Thursday: 'Payshanba',
  Friday: 'Juma',
  Saturday: 'Shanba',
  Sunday: 'Yakshanba',
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const monthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const shiftMonth = (date: Date, delta: number): Date => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + delta);
  return d;
};

const formatCurrency = (amount: number): string =>
  `${new Intl.NumberFormat('uz-UZ').format(Math.round(amount))} so'm`;

const extractTime = (value: unknown): string => {
  const raw = String(value ?? '');
  const match = raw.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? '';
};

type DashboardLesson = {
  id: string;
  day: string;
  dayNumber: number;
  subject: string;
  teacher?: string;
  room?: string;
  startsAt?: string;
  endsAt?: string;
  periodNo?: number;
};

type TimetableLessonApi = {
  id?: string | number;
  periodNo?: number | string;
  subject?: string;
  teacher?: string;
  room?: string;
  startsAt?: string;
  endsAt?: string;
};

type TimetableDayApi = {
  day?: string;
  dayNumber?: number | string;
  lessons?: TimetableLessonApi[];
};

type GuardianProfileResponse = {
  student?: {
    fullName?: string;
  };
};

type GuardianRankingResponse = {
  hasData?: boolean;
  ranking?: {
    rank?: number;
    totalStudents?: number;
    percentile?: number;
  };
};

type GuardianAttendanceResponse = {
  summary?: {
    PRESENT?: number;
    ABSENT?: number;
    LATE?: number;
    total?: number;
  };
};

type GuardianGradeItem = {
  id?: string | number;
  subject?: string;
  title?: string;
  score?: number | string;
  maxScore?: number | string;
  heldAt?: string;
};

type GuardianGradesResponse = {
  grades?: GuardianGradeItem[];
};

type GuardianInvoiceItem = {
  remainingAmount?: number | string;
  pendingAmount?: number | string;
};

type GuardianInvoicesResponse = {
  invoices?: GuardianInvoiceItem[];
  totals?: {
    totalPending?: number | string;
  };
};

type GuardianTimetableResponse = {
  timetable?: {
    lessonsByDay?: TimetableDayApi[];
  };
};

type GuardianAnnouncementItem = {
  title?: string;
  body?: string;
  content?: string;
  publishedAt?: string;
};

type GuardianAnnouncementsResponse = {
  data?: GuardianAnnouncementItem[];
};

type GuardianNotificationItem = {
  status?: string;
};

type GuardianNotificationsResponse = {
  data?: GuardianNotificationItem[];
};

type GuardianEventItem = {
  id?: string | number;
  title?: string;
  type?: string;
  startsAt?: string;
};

type GuardianEventsResponse = {
  events?: {
    upcoming?: GuardianEventItem[];
  };
};

type GuardianDisciplineActionItem = {
  id?: string | number;
};

type GuardianViolationItem = {
  severity?: string;
};

type GuardianDisciplineResponse = {
  discipline?: {
    actions?: GuardianDisciplineActionItem[];
    violations?: GuardianViolationItem[];
  };
};

const pickNextLesson = (lessonsByDay: unknown): DashboardLesson | null => {
  const days = Array.isArray(lessonsByDay) ? (lessonsByDay as TimetableDayApi[]) : [];

  const flatLessons: DashboardLesson[] = days.flatMap((day) => {
    const dayLessons = Array.isArray(day?.lessons) ? day.lessons : [];
    return dayLessons.map((lesson) => ({
      id: String(lesson?.id ?? `${day?.dayNumber ?? 0}-${lesson?.periodNo ?? 0}`),
      day: String(day?.day ?? ''),
      dayNumber: toNumber(day?.dayNumber),
      subject: String(lesson?.subject ?? '-'),
      teacher: lesson?.teacher ? String(lesson.teacher) : undefined,
      room: lesson?.room ? String(lesson.room) : undefined,
      startsAt: extractTime(lesson?.startsAt),
      endsAt: extractTime(lesson?.endsAt),
      periodNo: toNumber(lesson?.periodNo),
    }));
  });

  if (!flatLessons.length) return null;

  const now = new Date();
  const currentDayNumber = ((now.getDay() + 6) % 7) + 1; // Monday=1
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const normalized = flatLessons
    .map((lesson) => {
      const [hh = '0', mm = '0'] = (lesson.startsAt || '00:00').split(':');
      const startMinutes = toNumber(hh) * 60 + toNumber(mm);
      const dayOffset = ((lesson.dayNumber || 1) - currentDayNumber + 7) % 7;

      return {
        lesson,
        dayOffset,
        startMinutes,
      };
    })
    .sort((a, b) => {
      if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
      if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
      return (a.lesson.periodNo || 0) - (b.lesson.periodNo || 0);
    });

  const upcomingToday = normalized.find(
    (item) => item.dayOffset === 0 && item.startMinutes >= currentMinutes,
  );

  return upcomingToday?.lesson ?? normalized[0]?.lesson ?? null;
};

export default function GuardianDashboard() {
  const navigate = useNavigate();

  const now = new Date();
  const currentMonth = monthKey(now);
  const previousMonth = monthKey(shiftMonth(now, -1));

  const { data: profileRes, isLoading: isLoadingProfile } = useQuery<GuardianProfileResponse>({
    queryKey: ['guardian', 'student', 'profile'],
    queryFn: async () => (await api.get('/guardian/student')).data,
  });

  const { data: rankingRes } = useQuery<GuardianRankingResponse>({
    queryKey: ['guardian', 'student', 'ranking'],
    queryFn: async () => (await api.get('/guardian/student/ranking')).data,
  });

  const { data: attendanceRes } = useQuery<GuardianAttendanceResponse>({
    queryKey: ['guardian', 'student', 'attendance', currentMonth],
    queryFn: async () => (await api.get(`/guardian/student/attendance?month=${currentMonth}`)).data,
  });

  const { data: prevAttendanceRes } = useQuery<GuardianAttendanceResponse>({
    queryKey: ['guardian', 'student', 'attendance', previousMonth],
    queryFn: async () =>
      (await api.get(`/guardian/student/attendance?month=${previousMonth}`)).data,
  });

  const { data: gradesRes } = useQuery<GuardianGradesResponse>({
    queryKey: ['guardian', 'student', 'grades'],
    queryFn: async () => (await api.get('/guardian/student/grades')).data,
  });

  const { data: invoicesRes } = useQuery<GuardianInvoicesResponse>({
    queryKey: ['guardian', 'student', 'invoices'],
    queryFn: async () => (await api.get('/guardian/student/invoices')).data,
  });

  const { data: timetableRes } = useQuery<GuardianTimetableResponse>({
    queryKey: ['guardian', 'student', 'timetable'],
    queryFn: async () => (await api.get('/guardian/student/timetable')).data,
  });

  const { data: announcementsRes } = useQuery<GuardianAnnouncementsResponse>({
    queryKey: ['guardian', 'announcements', 'dashboard'],
    queryFn: async () => (await api.get('/guardian/announcements?limit=5')).data,
  });

  const { data: notificationsRes } = useQuery<GuardianNotificationsResponse>({
    queryKey: ['guardian', 'notifications', 'dashboard'],
    queryFn: async () => (await api.get('/guardian/notifications?limit=50')).data,
  });

  const { data: eventsRes } = useQuery<GuardianEventsResponse>({
    queryKey: ['guardian', 'student', 'events'],
    queryFn: async () => (await api.get('/guardian/student/events')).data,
  });

  const { data: disciplineRes } = useQuery<GuardianDisciplineResponse>({
    queryKey: ['guardian', 'student', 'discipline'],
    queryFn: async () => (await api.get('/guardian/student/discipline')).data,
  });

  if (isLoadingProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const student = profileRes?.student;

  const grades = Array.isArray(gradesRes?.grades) ? gradesRes.grades : [];
  const normalizedGrades = grades.map((grade) => {
    const score = toNumber(grade?.score);
    const maxScore = toNumber(grade?.maxScore);
    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

    return {
      ...grade,
      score,
      maxScore,
      percentage,
      subject: String(grade?.subject ?? 'Noma’lum'),
      title: String(grade?.title ?? '-'),
      heldAt: grade?.heldAt ? String(grade.heldAt) : null,
    };
  });

  const averageGrade =
    normalizedGrades.length > 0
      ? normalizedGrades.reduce((sum, grade) => sum + grade.percentage, 0) / normalizedGrades.length
      : null;

  const uniqueSubjectCount = new Set(normalizedGrades.map((grade) => grade.subject)).size;

  const gradeData = (() => {
    const grouped = new Map<string, { totalPercentage: number; count: number }>();

    normalizedGrades.forEach((grade) => {
      const current = grouped.get(grade.subject) ?? { totalPercentage: 0, count: 0 };
      grouped.set(grade.subject, {
        totalPercentage: current.totalPercentage + grade.percentage,
        count: current.count + 1,
      });
    });

    return Array.from(grouped.entries())
      .map(([subject, stat]) => ({
        subject,
        score: Math.round(stat.totalPercentage / Math.max(stat.count, 1)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  })();

  const pieData = (() => {
    const distribution = [
      { name: "A'lo", value: 0 },
      { name: 'Yaxshi', value: 0 },
      { name: 'Qoniqarli', value: 0 },
      { name: 'Qoniqarsiz', value: 0 },
    ];

    normalizedGrades.forEach((grade) => {
      if (grade.percentage >= 86) distribution[0].value += 1;
      else if (grade.percentage >= 71) distribution[1].value += 1;
      else if (grade.percentage >= 56) distribution[2].value += 1;
      else distribution[3].value += 1;
    });

    return distribution;
  })();

  const recentGrades = [...normalizedGrades]
    .sort((a, b) => {
      const aTime = a.heldAt ? new Date(a.heldAt).getTime() : 0;
      const bTime = b.heldAt ? new Date(b.heldAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const attendanceSummary = attendanceRes?.summary ?? {};
  const prevAttendanceSummary = prevAttendanceRes?.summary ?? {};

  const present = toNumber(attendanceSummary.PRESENT);
  const absent = toNumber(attendanceSummary.ABSENT);
  const late = toNumber(attendanceSummary.LATE);
  const attendanceTotal = toNumber(attendanceSummary.total) || present + absent + late;
  const attendanceRate = attendanceTotal > 0 ? Math.round((present / attendanceTotal) * 100) : null;

  const prevPresent = toNumber(prevAttendanceSummary.PRESENT);
  const prevAbsent = toNumber(prevAttendanceSummary.ABSENT);
  const prevLate = toNumber(prevAttendanceSummary.LATE);
  const prevTotal =
    toNumber(prevAttendanceSummary.total) || (prevPresent + prevAbsent + prevLate) || prevPresent;
  const prevAttendanceRate = prevTotal > 0 ? Math.round((prevPresent / prevTotal) * 100) : null;
  const attendanceTrend =
    attendanceRate !== null && prevAttendanceRate !== null
      ? Number((attendanceRate - prevAttendanceRate).toFixed(1))
      : null;

  const ranking = rankingRes?.ranking;
  const hasRankingData = Boolean(rankingRes?.hasData && ranking);

  const invoices = Array.isArray(invoicesRes?.invoices) ? invoicesRes.invoices : [];
  const invoiceTotals = invoicesRes?.totals ?? {};
  const totalPending = toNumber(invoiceTotals.totalPending);
  const pendingInvoices = invoices.filter(
    (invoice) => toNumber(invoice?.remainingAmount ?? invoice?.pendingAmount) > 0,
  );

  const announcements = Array.isArray(announcementsRes?.data) ? announcementsRes.data : [];
  const latestAnnouncement = announcements[0] ?? null;

  const notifications = Array.isArray(notificationsRes?.data) ? notificationsRes.data : [];
  const unreadNotifications = notifications.filter(
    (notification) => String(notification?.status ?? '').toUpperCase() !== 'READ',
  );

  const upcomingEvents = Array.isArray(eventsRes?.events?.upcoming)
    ? eventsRes.events.upcoming
    : [];
  const nextEvent = upcomingEvents[0] ?? null;

  const disciplineActions = Array.isArray(disciplineRes?.discipline?.actions)
    ? disciplineRes.discipline.actions
    : [];
  const highSeverityViolations = (
    Array.isArray(disciplineRes?.discipline?.violations) ? disciplineRes.discipline.violations : []
  ).filter((item) => ['HIGH', 'CRITICAL'].includes(String(item?.severity || '').toUpperCase()));

  const nextLesson = pickNextLesson(timetableRes?.timetable?.lessonsByDay);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Xayrli kun!
          </h1>
          <p className="text-muted-foreground font-medium">
            {student?.fullName || "O'quvchi"} ning o'quv faoliyati haqida umumiy ma'lumot
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-semibold">
            {unreadNotifications.length} ta yangi xabar
          </Badge>
          <Badge variant="outline" className="font-semibold">
            {pendingInvoices.length} ta to'lanmagan hisob
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Reyting"
          value={hasRankingData ? `${ranking.rank}/${ranking.totalStudents}` : '—'}
          icon={<Trophy className="h-5 w-5" />}
          color="primary"
          description={
            hasRankingData
              ? `Percentil: ${toNumber(ranking.percentile)}%`
              : "Reyting ma'lumoti yo'q"
          }
        />
        <StatCard
          title="Davomat"
          value={attendanceRate !== null ? `${attendanceRate}%` : '—'}
          icon={<UserCheck className="h-5 w-5" />}
          color="success"
          trend={
            attendanceTrend !== null
              ? { value: attendanceTrend, label: "o'tgan oyga nisbatan" }
              : undefined
          }
          description={attendanceTotal > 0 ? `${present}/${attendanceTotal} dars` : 'Maʼlumot yoʻq'}
        />
        <StatCard
          title="O'rtacha ball"
          value={averageGrade !== null ? `${Math.round(averageGrade)}%` : '—'}
          icon={<ClipboardList className="h-5 w-5" />}
          color="info"
          description={
            normalizedGrades.length > 0 ? `${normalizedGrades.length} ta baho` : 'Baholar hali yoʻq'
          }
        />
        <StatCard
          title="To'lanmagan"
          value={formatCurrency(totalPending)}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="warning"
          description={`${pendingInvoices.length} ta hisob-faktura`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">
                O'qilmagan xabarlar
              </p>
              <p className="text-2xl font-bold mt-1">{unreadNotifications.length}</p>
            </div>
            <Bell className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Yaqin tadbir</p>
              <p className="text-sm font-bold mt-1 line-clamp-1">
                {nextEvent?.title || 'Mavjud emas'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {nextEvent?.startsAt
                  ? new Date(nextEvent.startsAt).toLocaleDateString('uz-UZ', {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '-'}
              </p>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">
                Intizom holati
              </p>
              <p className="text-2xl font-bold mt-1">{disciplineActions.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Og'ir holatlar: {highSeverityViolations.length}
              </p>
            </div>
            <ShieldAlert className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase">Faol fanlar</p>
              <p className="text-2xl font-bold mt-1">{uniqueSubjectCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {normalizedGrades.length} ta baholash
              </p>
            </div>
            <BookOpenCheck className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
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
                    <CalendarDays className="h-4 w-4 text-primary/70" />{' '}
                    {WEEK_DAYS_UZ[nextLesson.day] || nextLesson.day}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4 text-primary/70" />{' '}
                    {nextLesson.teacher || 'O‘qituvchi belgilanmagan'}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs font-bold bg-background text-primary px-3 py-1.5 rounded-full border border-primary/20 shadow-sm flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {nextLesson.startsAt || '--:--'} - {nextLesson.endsAt || '--:--'}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
                      {nextLesson.room ? `${nextLesson.room}-xona` : 'Xona belgilanmagan'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground italic text-sm">
                Hozircha darslar yo'q
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full mt-6 text-xs h-9 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => navigate('/guardian/timetable')}
            >
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
                <div className="text-lg font-bold text-foreground line-clamp-1">
                  {latestAnnouncement.title}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {latestAnnouncement.body || latestAnnouncement.content || 'Tavsif mavjud emas'}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {latestAnnouncement.publishedAt
                      ? new Date(latestAnnouncement.publishedAt).toLocaleDateString('uz-UZ', {
                          month: 'long',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                  <span>•</span>
                  <span className="text-primary/80">Ma'muriyat</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground italic text-sm">
                E'lonlar mavjud emas
              </div>
            )}
            <Button
              variant="outline"
              className="w-full mt-6 text-xs h-9 border-dashed hover:border-solid transition-all"
              onClick={() => navigate('/guardian/announcements')}
            >
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
            {gradeData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Diagramma uchun baholar hali mavjud emas
              </div>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="subject"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value) => [`${value}%`, "O'rtacha natija"]}
                    />
                    <Bar dataKey="score" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Baholar taqsimoti</CardTitle>
          </CardHeader>
          <CardContent>
            {normalizedGrades.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Diagramma uchun baholar hali mavjud emas
              </div>
            ) : (
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
                    <Tooltip formatter={(value) => [`${value} ta`, 'Baholar soni']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {entry.name}: {entry.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">
              So'nggi baholar
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentGrades.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Baholar hali mavjud emas
              </div>
            ) : (
              <div className="space-y-2">
                {recentGrades.map((grade) => (
                  <div
                    key={String(grade.id)}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{grade.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{grade.title}</p>
                    </div>
                    <p className="text-sm font-bold whitespace-nowrap">
                      {grade.score}/{grade.maxScore}
                    </p>
                    <Badge variant="secondary" className="font-semibold">
                      {Math.round(grade.percentage)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-primary">
              Yaqin tadbirlar
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Rejalashtirilgan tadbirlar yo'q
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 5).map((event) => (
                  <div
                    key={String(event.id ?? event.title)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{String(event.title ?? '-')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {String(event.type ?? 'Tadbir')}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {event.startsAt
                        ? new Date(event.startsAt).toLocaleDateString('uz-UZ', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => navigate('/guardian/events')}
            >
              Barcha tadbirlarni ko'rish
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
