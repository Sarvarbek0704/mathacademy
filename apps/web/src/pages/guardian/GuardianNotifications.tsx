import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, Loader2, Info, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function GuardianNotifications() {
  const queryClient = useQueryClient();
  const { data: notifyRes, isLoading } = useQuery({
    queryKey: ['guardian', 'notifications'],
    queryFn: async () => (await api.get('/guardian/notifications')).data
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => (await api.put(`/guardian/notifications/${id}/read`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guardian', 'notifications'] });
    },
    onError: () => {
      toast.error('Xabarni o\'qilgan deb belgilab bo\'lmadi');
    }
  });

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  const notifications = notifyRes?.data || [];
  const unreadCount = notifications.filter((n: any) => n.status !== 'READ').length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <PageHeader 
          title="Bildirishnomalar" 
          description="Akademiya va o'qituvchilardan kelgan xabarlar" 
        />
        {unreadCount > 0 && (
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold mb-2">
            {unreadCount} ta yangi
          </div>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
          <Info className="h-12 w-12 mb-4 opacity-20" />
          <p>Yangi xabarlar mavjud emas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: any) => {
            const isUnread = n.status !== 'READ';
            return (
              <Card 
                key={n.id} 
                className={`transition-all duration-300 ${isUnread ? "border-l-4 border-l-primary bg-primary/5 shadow-sm" : "opacity-80"}`}
                onClick={() => isUnread && markReadMutation.mutate(n.id)}
              >
                <CardContent className="flex items-start gap-4 p-4 cursor-pointer">
                  <div className={`p-2 rounded-full transition-colors ${isUnread ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>{n.title || 'Xabar'}</p>
                        {isUnread && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.createdAt).toLocaleDateString('uz', { 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    <p className={`text-sm text-balance leading-relaxed ${isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {n.body || ''}
                    </p>
                    {!isUnread && (
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                        <CheckCheck className="h-3 w-3" />
                        O'qildi
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
