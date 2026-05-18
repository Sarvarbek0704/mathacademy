import { useState, useMemo } from 'react';
import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Loader2,
  GraduationCap,
  TrendingUp,
  BookOpen,
  Award,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const TYPE_LABELS: Record<string, string> = {
  WEEKLY_TEST: 'Haftalik test',
  BLOCK_TEST: 'Blok test',
  WRITTEN: 'Yozma',
  CONTROL: 'Nazorat',
  MOCK: 'Sinov',
};

function gradeColor(pct: number) {
  if (pct >= 86) return 'text-success';
  if (pct >= 71) return 'text-blue-600';
  if (pct >= 56) return 'text-amber-600';
  return 'text-destructive';
}

function gradeLabel(pct: number) {
  if (pct >= 86) return "A'lo";
  if (pct >= 71) return 'Yaxshi';
  if (pct >= 56) return 'Qoniqarli';
  return 'Qoniqarsiz';
}

function BlockTestDetail({ comment }: { comment: string | null }) {
  const [open, setOpen] = useState(false);
  if (!comment) return null;
  let parsed: any;
  try { parsed = JSON.parse(comment); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !('main' in parsed)) return null;

  const main = safeNum(parsed.main);
  const secondary = safeNum(parsed.secondary);
  const m1 = safeNum(parsed.m1);
  const m2 = safeNum(parsed.m2);
  const m3 = safeNum(parsed.m3);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] text-primary flex items-center gap-1 hover:underline"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        DTM tafsilotlari
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-5 gap-1 text-center">
          {[
            { label: 'Asosiy', val: main, max: 30, pts: main * 3.1 },
            { label: "Qo'shimcha", val: secondary, max: 30, pts: secondary * 2.1 },
            { label: 'Maj.1', val: m1, max: 10, pts: m1 * 1.1 },
            { label: 'Maj.2', val: m2, max: 10, pts: m2 * 1.1 },
            { label: 'Maj.3', val: m3, max: 10, pts: m3 * 1.1 },
          ].map(({ label, val, max, pts }) => (
            <div key={label} className="bg-muted/50 rounded-md p-1.5">
              <p className="text-[9px] text-muted-foreground font-semibold uppercase truncate">{label}</p>
              <p className="text-sm font-black">{val}/{max}</p>
              <p className="text-[10px] text-primary font-bold">{Math.round(pts * 10) / 10} ball</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GuardianGrades() {
  const [typeFilter, setTypeFilter] = useState<string>('_all');
  const [subjectFilter, setSubjectFilter] = useState<string>('_all');

  const { data: gradesRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'grades'],
    queryFn: async () => (await api.get('/guardian/student/grades')).data,
  });

  const rawGrades: any[] = Array.isArray(gradesRes?.grades) ? gradesRes.grades : [];

  const grades = useMemo(() =>
    rawGrades.map((g) => {
      const score = safeNum(g.score);
      const maxScore = safeNum(g.maxScore) || 1;
      return { ...g, score, maxScore, pct: Math.round((score / maxScore) * 100) };
    }).sort((a, b) => {
      const at = a.heldAt ? new Date(a.heldAt).getTime() : 0;
      const bt = b.heldAt ? new Date(b.heldAt).getTime() : 0;
      return bt - at;
    }),
    [rawGrades],
  );

  const subjects = useMemo(() => Array.from(new Set(grades.map((g) => g.subject).filter(Boolean))), [grades]);
  const types = useMemo(() => Array.from(new Set(grades.map((g) => g.type).filter(Boolean))), [grades]);

  const filtered = useMemo(() => grades.filter((g) => {
    if (typeFilter !== '_all' && g.type !== typeFilter) return false;
    if (subjectFilter !== '_all' && g.subject !== subjectFilter) return false;
    return true;
  }), [grades, typeFilter, subjectFilter]);

  // Stats
  const avgPct = grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + g.pct, 0) / grades.length)
    : null;

  const bySubject = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    grades.forEach((g) => {
      const cur = map.get(g.subject) ?? { total: 0, count: 0 };
      map.set(g.subject, { total: cur.total + g.pct, count: cur.count + 1 });
    });
    return Array.from(map.entries())
      .map(([subject, s]) => ({ subject, avg: Math.round(s.total / s.count) }))
      .sort((a, b) => b.avg - a.avg);
  }, [grades]);

  const bestSubject = bySubject[0];

  // Trend chart (last 8 assessments by date)
  const trendData = useMemo(() =>
    [...grades].slice(0, 8).reverse().map((g) => ({
      name: g.heldAt ? new Date(g.heldAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' }) : '-',
      ball: g.pct,
    })),
    [grades],
  );

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Baholar"
        description="Test va imtihon natijalari"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <GraduationCap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Jami baholash</p>
              <p className="text-2xl font-black">{grades.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp className="h-5 w-5 text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">O'rtacha</p>
              <p className={cn('text-2xl font-black', avgPct !== null ? gradeColor(avgPct) : '')}>
                {avgPct !== null ? `${avgPct}%` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Fanlar soni</p>
              <p className="text-2xl font-black">{subjects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Award className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Eng yaxshi fan</p>
              <p className="text-sm font-black truncate">{bestSubject?.subject || '—'}</p>
              {bestSubject && (
                <p className={cn('text-xs font-bold', gradeColor(bestSubject.avg))}>{bestSubject.avg}%</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      {trendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">So'nggi natijalar tendensiyasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v) => [`${v}%`, 'Ball']} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="ball" stroke="hsl(var(--primary))" fill="url(#gradeGrad)" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject averages */}
      {bySubject.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">Fanlar bo'yicha o'rtacha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bySubject.map(({ subject, avg }) => (
              <div key={subject} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate">{subject}</span>
                  <span className={cn('font-bold shrink-0 ml-2', gradeColor(avg))}>{avg}%</span>
                </div>
                <Progress value={avg} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {grades.length > 0 && (
        <div className="flex gap-3 items-center flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Barcha turlar</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Barcha fanlar</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(typeFilter !== '_all' || subjectFilter !== '_all') && (
            <span className="text-xs text-muted-foreground">{filtered.length} ta natija</span>
          )}
        </div>
      )}

      {/* Grade cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-2xl text-muted-foreground">
          <GraduationCap className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-medium">Baholar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g: any, idx: number) => (
            <Card key={g.id ?? idx} className={cn('transition-all hover:shadow-sm', g.pct >= 86 ? 'border-l-4 border-l-success' : g.pct >= 56 ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-destructive')}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{g.subject}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {TYPE_LABELS[g.type] ?? g.type}
                      </Badge>
                      {g.isPublished === false && (
                        <Badge variant="secondary" className="text-[10px] h-4">Qoralama</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.title}</p>
                    {g.type === 'BLOCK_TEST' && (
                      <BlockTestDetail comment={g.teacherComment} />
                    )}
                    {g.teacherComment && g.type !== 'BLOCK_TEST' && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{g.teacherComment}"</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Sana</p>
                      <p className="text-xs font-semibold">
                        {g.heldAt ? new Date(g.heldAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }) : '—'}
                      </p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <p className={cn('text-2xl font-black', gradeColor(g.pct))}>{g.pct}%</p>
                      <p className="text-xs text-muted-foreground">{g.score} / {g.maxScore}</p>
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] h-4 mt-0.5', g.pct >= 86 ? 'bg-success/10 text-success' : g.pct >= 56 ? 'bg-amber-100 text-amber-700' : 'bg-destructive/10 text-destructive')}
                      >
                        {gradeLabel(g.pct)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
