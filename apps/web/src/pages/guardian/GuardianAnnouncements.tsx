import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Calendar, Megaphone, Info, Clock, User } from 'lucide-react';

export default function GuardianAnnouncements() {
  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ['guardian', 'announcements'],
    queryFn: async () => (await api.get('/guardian/announcements')).data
  });

  const announcements = announcementsRes?.data || [];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader 
        title="E'lonlar" 
        description="Akademiya ma'muriyatidan rasmiy xabarlar va yangiliklar" 
      />

      {isLoading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl bg-muted/20">
          <Megaphone className="h-12 w-12 mb-4 opacity-20" />
          <p>Hozircha hech qanday e'lon yo'q</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {announcements.map((ann: any) => (
            <Card key={ann.id} className="group hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {ann.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(ann.publishedAt || ann.createdAt).toLocaleDateString('uz', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        Ma'muriyat
                      </div>
                    </div>
                  </div>
                  {ann.type && (
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                      {ann.type}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {ann.content}
                </div>
              </CardContent>
              {ann.expiresAt && (
                <CardFooter className="pt-0 pb-4 text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
                  <Info className="h-3 w-3" />
                  Muddati: {new Date(ann.expiresAt).toLocaleDateString('uz')} gacha
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
