import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, BookOpen, User, MapPin, CalendarDays } from 'lucide-react';

const WEEK_DAYS_UZ: Record<string, string> = {
  'Monday': 'Dushanba',
  'Tuesday': 'Seshanba',
  'Wednesday': 'Chorshanba',
  'Thursday': 'Payshanba',
  'Friday': 'Juma',
  'Saturday': 'Shanba',
  'Sunday': 'Yakshanba',
};

export default function GuardianTimetable() {
  const { data: timetableRes, isLoading } = useQuery({
    queryKey: ['guardian', 'timetable'],
    queryFn: async () => (await api.get('/guardian/timetable')).data
  });

  const hasTimetable = timetableRes?.hasTimetable;
  const days = timetableRes?.timetable?.lessonsByDay || [];

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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {days.filter((d: any) => d.lessons.length > 0).map((day: any) => (
            <div key={day.dayNumber} className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20 shadow-sm">
                <span className="font-bold text-sm text-primary uppercase tracking-wider">
                  {WEEK_DAYS_UZ[day.day] || day.day}
                </span>
              </div>
              
              <div className="space-y-3">
                {day.lessons.map((lesson: any) => (
                  <Card key={lesson.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-lg transition-all transform hover:-translate-y-1 duration-300">
                    <CardContent className="p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold bg-primary/5 text-primary px-2 py-1 rounded-full flex items-center gap-1.5 border border-primary/10">
                          <Clock className="h-3 w-3" />
                          {lesson.startsAt} - {lesson.endsAt}
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
