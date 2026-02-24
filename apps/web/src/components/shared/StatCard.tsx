import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: { value: number; label: string };
  color?: 'primary' | 'accent' | 'warning' | 'destructive' | 'info' | 'success';
  onClick?: () => void;
}

const colorMap = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
};

export function StatCard({ title, value, icon, description, trend, color = 'primary', onClick }: StatCardProps) {
  return (
    <Card 
      className={cn(
        "stat-card animate-fade-in transition-all duration-200", 
        onClick && "cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            {trend && (
              <p className={cn("text-xs font-medium", trend.value >= 0 ? "text-success" : "text-destructive")}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", colorMap[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
