import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, History, MessageSquare, Users, User, Bell, CheckCircle2, XCircle, Clock, Search, ChevronRight, Layout, Phone, SendHorizontal, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCrud } from '@/hooks/useCrud';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('history');
  const [composerOpen, setComposerOpen] = useState(false);
  
  // History and Templates CRUD
  const { data: historyData, loading: historyLoading, total, page, totalPages, setPage, setSearch } = useCrud({ endpoint: '/staff/notifications' });
  const { data: templatesRes } = useQuery({
    queryKey: ['staff', 'notifications', 'templates'],
    queryFn: async () => (await api.get('/staff/notifications/templates')).data
  });
  const templates = templatesRes?.data || [];

  // Groups and Users for recipient selection
  const { data: groupsRes } = useQuery({
    queryKey: ['staff', 'groups'],
    queryFn: async () => (await api.get('/staff/groups?limit=100')).data
  });
  const groups = groupsRes?.data || [];

  const [composerForm, setComposerForm] = useState({
    targetType: 'GROUP', // INDIVIDUAL, GROUP, ALL
    targetId: '',
    channel: 'IN_APP',
    templateCode: '',
    title: '',
    body: '',
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: any) => {
      // If GROUP or ALL, we need to handle bulk send
      if (payload.targetType === 'GROUP') {
        const studentsRes = await api.get(`/staff/students?currentGroupId=${payload.targetId}&limit=500`);
        const students = studentsRes.data?.data || [];
        
        toast.info(`${students.length} ta o'quvchiga xabar yuborilmoqda...`);
        
        // Sequential send (better than parallel for rate limits if any, but slower)
        for (const s of students) {
          if (s.studentAccountId || s.student_account_id) {
            await api.post('/staff/notifications/send', {
              channel: payload.channel,
              templateCode: payload.templateCode || undefined,
              title: payload.templateCode ? undefined : payload.title,
              body: payload.templateCode ? undefined : payload.body,
              to: { studentAccountId: String(s.studentAccountId || s.student_account_id) }
            });
          }
        }
        return { count: students.length };
      } else {
        // Individual
        return api.post('/staff/notifications/send', {
          channel: payload.channel,
          templateCode: payload.templateCode || undefined,
          title: payload.templateCode ? undefined : payload.title,
          body: payload.templateCode ? undefined : payload.body,
          to: payload.targetType === 'INDIVIDUAL' ? { userId: payload.targetId } : undefined
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'notifications'] });
      toast.success('Xabarlar muvaffaqiyatli yuborildi');
      setComposerOpen(false);
    },
    onError: () => {
      toast.error('Xabar yuborishda xatolik yuz berdi');
    }
  });

  const historyColumns: Column<any>[] = [
    { key: 'createdAt', title: 'Vaqt', render: (i) => new Date(i.createdAt).toLocaleString('uz') },
    { key: 'recipient', title: 'Qabul qiluvchi', render: (i) => (
      <div className="flex flex-col">
        <span className="font-medium text-xs">{i.recipient?.name || 'Noma\'lum'}</span>
        <span className="text-[10px] text-muted-foreground uppercase">{i.recipient?.type}</span>
      </div>
    )},
    { key: 'channel', title: 'Kanal', render: (i) => (
      <Badge variant="outline" className="gap-1.5 py-0.5 text-[10px]">
        {i.channel === 'SMS' ? <Phone className="h-3 w-3" /> : i.channel === 'TELEGRAM_BOT' ? <SendHorizontal className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
        {i.channel}
      </Badge>
    )},
    { key: 'title', title: 'Mavzu', render: (i) => <span className="truncate max-w-[200px] block text-xs">{i.title}</span> },
    { key: 'status', title: 'Holat', render: (i) => (
      <Badge variant="outline" className={cn("gap-1 py-0.5", 
        i.status === 'SENT' ? 'text-success border-success/30 bg-success/5' : 
        i.status === 'FAILED' ? 'text-destructive border-destructive/30 bg-destructive/5' : 
        'text-warning border-warning/30 bg-warning/5'
      )}>
        {i.status === 'SENT' ? <CheckCircle2 className="h-3 w-3" /> : i.status === 'FAILED' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {i.status === 'SENT' ? 'Yuborildi' : i.status === 'FAILED' ? 'Xato' : 'Kutilmoqda'}
      </Badge>
    )},
  ];

  const handleTemplateSelect = (code: string) => {
    const tpl = templates.find((t: any) => t.code === code);
    if (tpl) {
      setComposerForm({ ...composerForm, templateCode: code, title: tpl.title, body: tpl.body });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Xabarnomalar markazi" 
        description="O'quvchilar va ota-onalarga xabarlar yuboring" 
        action={{ label: 'Xabar yuborish', icon: <Send className="h-4 w-4" />, onClick: () => setComposerOpen(true) }} 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:w-80">
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Tarix</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><Layout className="h-4 w-4" /> Shablonlar</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="p-0">
              <DataTable 
                columns={historyColumns} data={historyData} loading={historyLoading} searchable onSearch={setSearch}
                pagination={{ page, totalPages, total, onPageChange: setPage }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl: any) => (
              <Card key={tpl.id} className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline">{tpl.channel}</Badge>
                    <code className="text-[10px] bg-muted px-1 rounded">{tpl.code}</code>
                  </div>
                  <CardTitle className="text-sm mt-2">{tpl.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-3 italic">"{tpl.body}"</p>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed flex items-center justify-center py-10 hover:bg-muted/50 cursor-pointer">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Layout className="h-8 w-8 opacity-20" />
                <span className="text-xs font-medium">Yangi shablon yaratish</span>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Notification Composer */}
      <SlideOver open={composerOpen} onOpenChange={setComposerOpen} title="Yangi xabarnoma" size="md">
        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Qabul qiluvchilar</Label>
            <Tabs value={composerForm.targetType} onValueChange={(v) => setComposerForm({ ...composerForm, targetType: v, targetId: '' })}>
              <TabsList className="grid w-full grid-cols-2 h-9 p-1">
                <TabsTrigger value="GROUP" className="text-xs gap-2"><Users className="h-3.5 w-3.5" /> Guruhga</TabsTrigger>
                <TabsTrigger value="INDIVIDUAL" className="text-xs gap-2"><User className="h-3.5 w-3.5" /> Shaxsiy</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {composerForm.targetType === 'GROUP' ? (
              <Select value={composerForm.targetId} onValueChange={(v) => setComposerForm({ ...composerForm, targetId: v })}>
                <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={String(g.id)}>{g.name} ({g.grade}-sinf)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="Foydalanuvchi ID si..." value={composerForm.targetId} onChange={e => setComposerForm({ ...composerForm, targetId: e.target.value })} />
            )}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Kanal va Shablon</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kanal</Label>
                <Select value={composerForm.channel} onValueChange={(v) => setComposerForm({ ...composerForm, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN_APP">In-App (Portal)</SelectItem>
                    <SelectItem value="SMS">SMS xabar</SelectItem>
                    <SelectItem value="TELEGRAM_BOT">Telegram Bot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Shablon (ixtiyoriy)</Label>
                <Select value={composerForm.templateCode} onValueChange={handleTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="Tanlang..." /></SelectTrigger>
                  <SelectContent>
                    {templates.filter((t: any) => t.channel === composerForm.channel).map((t: any) => (
                      <SelectItem key={t.code} value={t.code}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Mazmun</Label>
            <div className="space-y-2">
              <Label>Mavzu / Sarlavha</Label>
              <Input 
                value={composerForm.title} 
                onChange={e => setComposerForm({ ...composerForm, title: e.target.value, templateCode: '' })} 
                placeholder="Xabar sarlavhasi" 
                disabled={!!composerForm.templateCode}
              />
            </div>
            <div className="space-y-2">
              <Label>Xabar matni</Label>
              <Textarea 
                value={composerForm.body} 
                onChange={e => setComposerForm({ ...composerForm, body: e.target.value, templateCode: '' })} 
                placeholder="Xabar matnini kiriting..." 
                rows={5}
                disabled={!!composerForm.templateCode}
              />
              <p className="text-[10px] text-muted-foreground">
                O'zgaruvchilar: <code className="bg-muted px-1 rounded">{"{{name}}"}</code>, <code className="bg-muted px-1 rounded">{"{{date}}"}</code> formatida foydalaning.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setComposerOpen(false)} disabled={sendMutation.isPending}>Bekor qilish</Button>
          <Button 
            className="w-full sm:w-auto gap-2" 
            onClick={() => sendMutation.mutate(composerForm)} 
            disabled={sendMutation.isPending || !composerForm.targetId || !composerForm.body}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Yuborish
          </Button>
        </div>
      </SlideOver>
    </div>
  );
}
