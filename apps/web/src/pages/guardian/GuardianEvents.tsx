import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Loader2,
  CalendarDays,
  MapPin,
  Trophy,
  Film,
  Users,
  Briefcase,
  Sparkles,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  TOURNAMENT: { label: 'Musobaqa', icon: <Trophy className="h-4 w-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  MOVIE_TIME: { label: 'Kino kechasi', icon: <Film className="h-4 w-4" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  MEETING: { label: "Yig'ilish", icon: <Users className="h-4 w-4" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  SEMINAR: { label: 'Seminar', icon: <Briefcase className="h-4 w-4" />, color: 'text-green-600 bg-green-50 border-green-200' },
  OTHER: { label: 'Boshqa', icon: <Sparkles className="h-4 w-4" />, color: 'text-gray-600 bg-gray-50 border-gray-200' },
};

function EventCard({ event, isPast }: { event: any; isPast: boolean }) {
  const type = event.type ?? 'OTHER';
  const meta = TYPE_META[type] ?? TYPE_META.OTHER;
  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;

  return (
    <Card className={cn('transition-all hover:shadow-md', isPast && 'opacity-70')}>
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          {/* Date column */}
          <div className="shrink-0 text-center w-14">
            {startsAt ? (
              <div className={cn('rounded-xl border p-2 text-center', isPast ? 'bg-muted text-muted-foreground border-border' : 'bg-primary/10 border-primary/20 text-primary')}>
                <p className="text-[10px] font-bold uppercase">
                  {startsAt.toLocaleDateString('uz-UZ', { month: 'short' })}
                </p>
                <p className="text-2xl font-black leading-none">{startsAt.getDate()}</p>
                <p className="text-[10px] text-muted-foreground">
                  {startsAt.toLocaleDateString('uz-UZ', { weekday: 'short' })}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border bg-muted p-2">
                <CalendarDays className="h-6 w-6 text-muted-foreground mx-auto" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-base leading-tight">{event.title}</h3>
              <div className={cn('flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold shrink-0', meta.color)}>
                {meta.icon}
                {meta.label}
              </div>
            </div>

            {event.description && (
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                {event.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2.5">
              {startsAt && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {startsAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  {endsAt && ` – ${endsAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`}
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.location}
                </div>
              )}
              {isPast && (
                <Badge variant="secondary" className="text-[10px] h-4">O'tib ketgan</Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuardianEvents() {
  const { data: eventRes, isLoading } = useQuery({
    queryKey: ['guardian', 'student', 'events'],
    queryFn: async () => (await api.get('/guardian/events')).data,
  });

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  const rawEvents = eventRes?.events;
  const now = new Date();

  const allEvents: any[] = (
    Array.isArray(rawEvents)
      ? rawEvents
      : [
          ...(Array.isArray(rawEvents?.upcoming) ? rawEvents.upcoming : []),
          ...(Array.isArray(rawEvents?.past) ? rawEvents.past : []),
        ]
  ).map((item: any) => ({
    id: String(item?.id ?? `${item?.title ?? 'ev'}-${item?.startsAt ?? ''}`),
    title: String(item?.title ?? '-'),
    type: String(item?.eventType ?? item?.type ?? 'OTHER'),
    startsAt: item?.startsAt ?? item?.date ?? null,
    endsAt: item?.endsAt ?? null,
    location: item?.campusName ?? item?.campus ?? item?.location ?? null,
    description: item?.description ?? null,
  }));

  const upcoming = allEvents
    .filter((e) => !e.startsAt || new Date(e.startsAt) >= now)
    .sort((a, b) => new Date(a.startsAt || 0).getTime() - new Date(b.startsAt || 0).getTime());

  const past = allEvents
    .filter((e) => e.startsAt && new Date(e.startsAt) < now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        title="Tadbirlar"
        description="Akademiya va kampus doirasidagi tadbirlar"
      />

      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-2xl text-muted-foreground">
          <CalendarDays className="h-16 w-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Tadbirlar yo'q</p>
          <p className="text-sm opacity-70">Yaqin orada tadbirlar rejalashtirilmagan</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Kelayotgan tadbirlar</h2>
                <Badge className="bg-primary/10 text-primary border-primary/20">{upcoming.length}</Badge>
              </div>
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} isPast={false} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-muted-foreground">O'tgan tadbirlar</h2>
                <Badge variant="secondary">{past.length}</Badge>
              </div>
              {past.slice(0, 5).map((event) => (
                <EventCard key={event.id} event={event} isPast={true} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
