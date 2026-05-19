import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, BookOpen, User, MapPin, CalendarDays } from 'lucide-react';

const WEEK_DAYS_UZ: Record<string, string> = {
  Monday: 'Dushanba',
  Tuesday: 'Seshanba',
  Wednesday: 'Chorshanba',
  Thursday: 'Payshanba',
  Friday: 'Juma',
  Saturday: 'Shanba',
  Sunday: 'Yakshanba',
};

const WEEK_DAYS_EN_BY_NUM: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const extractTime = (value: unknown): string => {
  const raw = String(value ?? '');
  const match = raw.match(/(\d{2}:\d{2})/);
  return match?.[1] ?? '';
};

export default function GuardianTimetable() {
  const { data: timetableRes, isLoading } = useQuery({
    queryKey: ['guardian', 'timetable'],
    queryFn: async () => (await api.get('/guardian/timetable')).data,
  });

  const hasTimetable = Boolean(timetableRes?.hasTimetable);

  const days = (() => {
    const lessonsByDay = timetableRes?.timetable?.lessonsByDay;
    if (Array.isArray(lessonsByDay)) {
      return lessonsByDay.map((day: any) => ({
        day: String(day?.day ?? ''),
        dayNumber: Number(day?.dayNumber ?? 0),
        lessons: Array.isArray(day?.lessons)
          ? day.lessons.map((lesson: any) => ({
              id: String(
                lesson?.id ??
                  `${day?.dayNumber ?? 0}-${lesson?.periodNo ?? lesson?.period_no ?? 0}`,
              ),
              subject: String(lesson?.subject ?? '-'),
              teacher: lesson?.teacher ? String(lesson.teacher) : null,
              room: lesson?.room ? String(lesson.room) : null,
              startsAt: extractTime(lesson?.startsAt),
              endsAt: extractTime(lesson?.endsAt),
              periodNo: Number(lesson?.periodNo ?? lesson?.period_no ?? 0),
            }))
          : [],
      }));
    }

    const lessons = timetableRes?.timetable?.lessons;
    if (!Array.isArray(lessons)) return [];

    const grouped = new Map<number, any[]>();
    lessons.forEach((lesson: any) => {
      const dayNumber = Number(lesson?.dayOfWeek ?? lesson?.dayNumber ?? 0);
      if (!dayNumber || dayNumber < 1 || dayNumber > 7) return;

      const list = grouped.get(dayNumber) ?? [];
      list.push({
        id: String(
          lesson?.id ?? `${dayNumber}-${lesson?.periodNo ?? lesson?.period_no ?? list.length + 1}`,
        ),
        subject: String(lesson?.subject ?? '-'),
        teacher: lesson?.teacher ? String(lesson.teacher) : null,
        room: lesson?.room ? String(lesson.room) : null,
        startsAt: extractTime(lesson?.startsAt),
        endsAt: extractTime(lesson?.endsAt),
        periodNo: Number(lesson?.periodNo ?? lesson?.period_no ?? 0),
      });
      grouped.set(dayNumber, list);
    });

    return Object.entries(WEEK_DAYS_EN_BY_NUM).map(([dayNumber, day]) => {
      const num = Number(dayNumber);
      const lessonsForDay = (grouped.get(num) ?? []).sort(
        (a, b) => (a.periodNo || 0) - (b.periodNo || 0),
      );

      return {
        day,
        dayNumber: num,
        lessons: lessonsForDay,
      };
    });
  })();

  const daysWithLessons = days.filter(
    (d: any) => Array.isArray(d?.lessons) && d.lessons.length > 0,
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Dars jadvali"
        description="Farzandingizning haftalik o'quv mashg'ulotlari jadvali"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : !hasTimetable ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/10">
          <CalendarDays className="h-16 w-16 mb-4 opacity-10" />
          <p className="text-lg font-medium">Bu guruh uchun dars jadvali hali belgilanmagan</p>
          <p className="text-sm opacity-70">Ma'lumot uchun maktab ma'muriyatiga murojaat qiling</p>
        </div>
      ) : daysWithLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/10">
          <CalendarDays className="h-16 w-16 mb-4 opacity-10" />
          <p className="text-lg font-medium">Jadval ma'lumoti topilmadi</p>
          <p className="text-sm opacity-70">Ma'lumot formatini tekshirib qayta urinib ko'ring</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {daysWithLessons.map((day: any) => (
            <div key={day.dayNumber} className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 shadow-sm">
                <span className="font-bold text-sm text-primary uppercase tracking-wider">
                  {WEEK_DAYS_UZ[day.day] || day.day}
                </span>
              </div>

              <div className="space-y-3">
                {day.lessons.map((lesson: any) => (
                  <Card
                    key={lesson.id}
                    className="overflow-hidden border-l-4 border-l-primary hover:shadow-lg transition-all transform hover:-translate-y-1 duration-300"
                  >
                    <CardContent className="p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold bg-primary/5 text-primary px-2 py-1 rounded-full flex items-center gap-1.5 border border-primary/10">
                          <Clock className="h-3 w-3" />
                          {lesson.startsAt ? `${lesson.startsAt} – ${lesson.endsAt}` : `${lesson.periodNo}-dars`}
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {lesson.periodNo}-para
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-bold text-sm leading-tight line-clamp-2 text-foreground/90">
                          {lesson.subject}
                        </h4>
                        <div className="space-y-1">
                          {lesson.teacher && (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <User className="h-3 w-3 text-primary/60" />
                              <span className="truncate">{lesson.teacher}</span>
                            </div>
                          )}
                          {lesson.room && (
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary/60" />
                              <span>{lesson.room}-xona</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
