import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Utensils, CalendarPlus, Megaphone, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, UserPlus, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';

export default function MealBillingPage() {
  const queryClient = useQueryClient();
  const [weekSlideOpen, setWeekSlideOpen] = useState(false);
  const [announcementSlideOpen, setAnnouncementSlideOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<any>(null);

  // Lists
  const { data: weeksRes, isLoading: weeksLoading } = useQuery({
    queryKey: ['staff', 'billing', 'meal', 'weeks'],
    queryFn: async () => (await api.get('/staff/billing/meal/weeks')).data
  });
  const weeks = weeksRes?.data || [];

  const { data: livingTypesRes } = useQuery({
    queryKey: ['staff', 'billing', 'living-types'],
    queryFn: async () => (await api.get('/staff/billing/living-types')).data
  });
  const livingTypes = livingTypesRes || [];

  // Mutations
  const createWeekMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/staff/billing/meal/weeks', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'billing', 'meal', 'weeks'] });
      toast.success('Yangi hafta yaratildi');
      setWeekSlideOpen(false);
    }
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/staff/billing/meal/announcements', payload),
    onSuccess: () => {
      toast.success('To\'lov haqida xabar va invoyslar yuborildi');
      setAnnouncementSlideOpen(false);
    }
  });

  // Forms
  const [weekForm, setWeekForm] = useState({ weekStart: '', weekEnd: '' });
  const [annForm, setAnnForm] = useState({
    title: '',
    message: '',
    dueDate: '',
    prices: [] as { livingTypeId: string, priceAmount: number }[],
    generateInvoices: true,
  });

  const columns: Column<any>[] = [
    { key: 'weekStart', title: 'Hafta boshi', render: (i) => dayjs(i.weekStart).format('DD.MM.YYYY') },
    { key: 'weekEnd', title: 'Hafta oxiri', render: (i) => dayjs(i.weekEnd).format('DD.MM.YYYY') },
    { key: 'createdAt', title: 'Yaratilgan', render: (i) => dayjs(i.createdAt).format('DD.MM.YYYY HH:mm') },
    { 
      key: 'actions', 
      title: 'Amallar', 
      render: (i) => (
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-8 text-[11px]" 
          onClick={() => {
            setSelectedWeek(i);
            setAnnForm(prev => ({ ...prev, title: `${dayjs(i.weekStart).format('DD.MM')} - ${dayjs(i.weekEnd).format('DD.MM')} haftalik ovqat to'lovi` }));
            setAnnouncementSlideOpen(true);
          }}
        >
          <Megaphone className="h-3.5 w-3.5" />
          E'lon & Invoys
        </Button>
      ) 
    },
  ];

  const handlePriceChange = (ltId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setAnnForm(prev => {
      const existing = prev.prices.find(p => p.livingTypeId === ltId);
      if (existing) {
        return { ...prev, prices: prev.prices.map(p => p.livingTypeId === ltId ? { ...p, priceAmount: num } : p) };
      }
      return { ...prev, prices: [...prev.prices, { livingTypeId: ltId, priceAmount: num }] };
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Ovqat billing" 
        description="Haftalik ovqatlanish hisobi va invoyslar" 
        action={{ label: 'Hafta yaratish', icon: <Plus className="h-4 w-4" />, onClick: () => setWeekSlideOpen(true) }} 
      />

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={weeks} loading={weeksLoading} />
        </CardContent>
      </Card>

      {/* Week SlideOver */}
      <SlideOver open={weekSlideOpen} onOpenChange={setWeekSlideOpen} title="Yangi hafta yaratish" size="sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Hafta boshlanishi</Label>
            <Input type="date" value={weekForm.weekStart} onChange={e => setWeekForm({ ...weekForm, weekStart: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Hafta tugashi</Label>
            <Input type="date" value={weekForm.weekEnd} onChange={e => setWeekForm({ ...weekForm, weekEnd: e.target.value })} />
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={() => createWeekMutation.mutate(weekForm)} 
            disabled={createWeekMutation.isPending || !weekForm.weekStart || !weekForm.weekEnd}
          >
            {createWeekMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Haftani yaratish
          </Button>
        </div>
      </SlideOver>

      {/* Announcement SlideOver */}
      <SlideOver open={announcementSlideOpen} onOpenChange={setAnnouncementSlideOpen} title="To'lov e'loni va invoyslar" size="md">
        <div className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">{dayjs(selectedWeek?.weekStart).format('DD.MM.YYYY')} - {dayjs(selectedWeek?.weekEnd).format('DD.MM.YYYY')}</p>
              <p className="text-muted-foreground line-height-relaxed">
                Ushbu amal tanlangan hafta uchun barcha o'quvchilarga to'lov haqida xabar yuboradi va tizimda avtomatik ravishda invoyslar yaratadi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E'lon sarlavhasi</Label>
              <Input value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Masalan: 12-18 yanvar haftalik ovqat to'lovi" />
            </div>

            <div className="space-y-2">
              <Label>Qo'shimcha xabar (ixtiyoriy)</Label>
              <Textarea value={annForm.message} onChange={e => setAnnForm({ ...annForm, message: e.target.value })} placeholder="Ota-onalarga qo'shimcha ko'rsatmalar..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>To'lov muddati (Due Date)</Label>
                <Input type="date" value={annForm.dueDate} onChange={e => setAnnForm({ ...annForm, dueDate: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 pt-8">
                <Switch checked={annForm.generateInvoices} onCheckedChange={v => setAnnForm({ ...annForm, generateInvoices: v })} />
                <Label>Invoyslarni yaratish</Label>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Narxlar (Yashash turiga qarab)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {livingTypes.map((lt: any) => (
                <div key={lt.id} className="space-y-1.5 p-3 border rounded-lg bg-card">
                  <Label className="text-[11px] font-medium opacity-70">{lt.name}</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      placeholder="Bahosi" 
                      className="h-9" 
                      value={annForm.prices.find(p => p.livingTypeId === String(lt.id))?.priceAmount || ''}
                      onChange={e => handlePriceChange(String(lt.id), e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">so'm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAnnouncementSlideOpen(false)}>Bekor qilish</Button>
            <Button 
              className="w-full sm:w-auto gap-2" 
              onClick={() => createAnnouncementMutation.mutate({ ...annForm, mealWeekId: String(selectedWeek.id) })}
              disabled={createAnnouncementMutation.isPending || !annForm.title || annForm.prices.length === 0}
            >
              {createAnnouncementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Tasdiqlash va yuborish
            </Button>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
