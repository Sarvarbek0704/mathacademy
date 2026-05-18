import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Primitive building blocks ────────────────────────────────────────────────

/** One stat card placeholder */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 flex items-center gap-4', className)}>
      <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-2.5 w-32" />
      </div>
    </div>
  );
}

/** Row of 4 stat card skeletons */
export function StatRowSkeleton({ cols = 4 }: { cols?: 2 | 3 | 4 }) {
  const colClass: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  };
  return (
    <div className={cn('grid gap-4', colClass[cols])}>
      {Array.from({ length: cols }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Table with N skeleton rows */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-8' : i === 1 ? 'flex-1' : 'w-20')} />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
          <Skeleton className="h-3 w-6" />
          <div className="flex-1 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Grid of card skeletons */
export function CardGridSkeleton({
  cards = 6,
  cols = 3,
}: {
  cards?: number;
  cols?: 2 | 3 | 4;
}) {
  const colClass: Record<number, string> = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };
  return (
    <div className={cn('grid gap-4', colClass[cols])}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chart card placeholder */
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="w-full rounded-lg" style={{ height }} />
    </div>
  );
}

/** Generic page header skeleton */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-9 w-32 rounded-lg" />
    </div>
  );
}

// ─── Full page skeletons (used as Suspense fallback + page loading) ───────────

/** Dashboard skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatRowSkeleton cols={4} />
      <StatRowSkeleton cols={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton height={200} />
        <ChartSkeleton height={200} />
      </div>
    </div>
  );
}

/** Table page skeleton (most staff pages) */
export function TablePageSkeleton({ showStats = false }: { showStats?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {showStats && <StatRowSkeleton cols={4} />}
      {/* Search bar */}
      <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
      <TableSkeleton />
    </div>
  );
}

/** Card grid page skeleton */
export function CardPageSkeleton({ showStats = false }: { showStats?: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {showStats && <StatRowSkeleton cols={4} />}
      <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
      <CardGridSkeleton />
    </div>
  );
}

/** Route-level Suspense fallback — minimal shimmer matching the layout shape */
export function RouteFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
