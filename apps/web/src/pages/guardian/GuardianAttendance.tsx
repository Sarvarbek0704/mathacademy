import { useState, useMemo } from 'react';
import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Loader2,
  Calendar,
  UserCheck,
  UserMinus,
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  PRESENT: { label: 'Kelgan', color: 'bg-success/10 text-success border-success/20', dot: 'bg-success' },
  ABSENT: { label: 'Kelmagan', color: 'bg-destructive/10 text-destructive border-destructive/20', dot: 'bg-destructive' },
  LATE: { label: 'Kechikkan', color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  EXCUSED: { label: 'Sababli', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
};

const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const DAYS_UZ = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function GuardianAttendance() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = toMonthKey(currentDate);

  const { data: attRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'attendance', month],
    queryFn: async () => (await api.get(`/guardian/student/attendance?month=${month}`)).data,
  });

  const records: any[] = Array.isArray(attRes?.records) ? attRes.records : [];
  const summary = attRes?.summary ?? {};

  const present = Number(summary.PRESENT ?? 0) || 0;
  const absent = Number(summary.ABSENT ?? 0) || 0;
  const late = Number(summary.LATE ?? 0) || 0;
  const excused = Number(summary.EXCUSED ?? 0) || 0;
  const total = Number(summary.total ?? 0) || present + absent + late + excused || records.length;
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  // Build a date → records map for calendar
  const recordsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    records.forEach((r) => {
      if (!r.date) return;
      const key = r.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return map;
  }, [records]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const mon = currentDate.getMonth();
    const firstDay = new Date(year, mon, 1);
    const lastDay = new Date(year, mon + 1, 0);
    // Monday=0
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: { date: Date | null; key: string | null }[] = [];
    for (let i = 0; i < startPad; i++) days.push({ date: null, key: null });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, mon, d);
      days.push({ date, key: toMonthKey(date) === month ? date.toISOString().slice(0, 10) : null });
    }
    return days;
  }, [currentDate, month]);

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    if (d > new Date()) return;
    setCurrentDate(d);
  };
  const isNextDisabled = toMonthKey(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)) > toMonthKey(new Date());

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header with navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Davomat"
          description="Farzandingizning darsga qatnashish holati"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-bold text-sm min-w-[130px] text-center">
            {MONTHS_UZ[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={nextMonth} disabled={isNextDisabled}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 flex items-start gap-3">
            <UserCheck className="h-5 w-5 text-success mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Kelgan</p>
              <p className="text-2xl font-black text-success">{present}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <UserMinus className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Kelmagan</p>
              <p className="text-2xl font-black text-destructive">{absent}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Kechikkan</p>
              <p className="text-2xl font-black text-amber-600">{late}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Davomat %</p>
              <p className={cn('text-2xl font-black', attendanceRate >= 80 ? 'text-success' : attendanceRate >= 60 ? 'text-amber-600' : 'text-destructive')}>
                {attendanceRate}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Oylik davomat</span>
              <span className="text-sm font-bold">{present}/{total} dars</span>
            </div>
            <Progress value={attendanceRate} className="h-3" />
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_META).map(([status, meta]) => {
                const count = status === 'PRESENT' ? present : status === 'ABSENT' ? absent : status === 'LATE' ? late : excused;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    <span className="text-xs text-muted-foreground">{meta.label}: <span className="font-bold">{count}</span></span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Oylik kalendar</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS_UZ.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.date || !cell.key) {
                return <div key={idx} />;
              }
              const dayKey = cell.date.toISOString().slice(0, 10);
              const dayRecords = recordsByDate.get(dayKey) ?? [];
              const primaryStatus = dayRecords[0]?.status;
              const meta = primaryStatus ? STATUS_META[primaryStatus] : null;
              const isToday = dayKey === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={idx}
                  className={cn(
                    'relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all',
                    meta
                      ? cn(meta.color, 'border font-bold')
                      : 'text-muted-foreground/50',
                    isToday && 'ring-2 ring-primary ring-offset-1',
                  )}
                  title={meta?.label}
                >
                  <span className="font-semibold">{cell.date.getDate()}</span>
                  {dayRecords.length > 1 && (
                    <div className="absolute bottom-0.5 flex gap-0.5">
                      {dayRecords.slice(0, 3).map((r, i) => (
                        <div key={i} className={cn('h-1 w-1 rounded-full', STATUS_META[r.status]?.dot ?? 'bg-muted-foreground')} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
            {Object.entries(STATUS_META).map(([, meta]) => (
              <div key={meta.label} className="flex items-center gap-1.5">
                <div className={cn('h-3 w-3 rounded', meta.dot)} />
                <span className="text-[11px] text-muted-foreground">{meta.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Records list */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground">
          <Calendar className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-medium">Bu oy uchun davomat ma'lumoti yo'q</p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Batafsil ro'yxat ({records.length} ta yozuv)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((r: any, idx: number) => {
              const meta = STATUS_META[r.status] ?? { label: r.status, color: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
              return (
                <div key={r.id ?? idx} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', meta.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {r.date ? new Date(r.date).toLocaleDateString('uz-UZ', { weekday: 'short', day: 'numeric', month: 'long' }) : '-'}
                      </span>
                      {r.group && <span className="text-xs text-muted-foreground">{r.group}</span>}
                    </div>
                    {r.note && <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.note}"</p>}
                  </div>
                  <Badge variant="outline" className={cn('text-[10px] h-5 border', meta.color)}>
                    {meta.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
