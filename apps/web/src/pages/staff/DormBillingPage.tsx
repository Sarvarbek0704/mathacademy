import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BedDouble, Megaphone, CheckCircle2, Loader2, Plus, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import dayjs from 'dayjs';

export default function DormBillingPage() {
  const queryClient = useQueryClient();
  const [monthSlideOpen, setMonthSlideOpen] = useState(false);
  const [announcementSlideOpen, setAnnouncementSlideOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<any>(null);

  // Lists
  const { data: monthsRes, isLoading: monthsLoading } = useQuery({
    queryKey: ['staff', 'billing', 'dorm', 'months'],
    queryFn: async () => (await api.get('/staff/billing/dorm/months')).data
  });
  const months = monthsRes?.data || [];

  const { data: livingTypesRes } = useQuery({
    queryKey: ['staff', 'billing', 'living-types'],
    queryFn: async () => (await api.get('/staff/billing/living-types')).data
  });
  const livingTypes = livingTypesRes || [];

  // Mutations
  const createMonthMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/staff/billing/dorm/months', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'billing', 'dorm', 'months'] });
      toast.success('Yangi billing oyi yaratildi');
      setMonthSlideOpen(false);
    }
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (payload: any) => api.post('/staff/billing/dorm/announcements', payload),
    onSuccess: () => {
      toast.success('Yotoqxona to\'lovi haqida xabar va invoyslar yuborildi');
      setAnnouncementSlideOpen(false);
    }
  });

  // Forms
  const [monthForm, setMonthForm] = useState({ monthStart: '', monthEnd: '' });
  const [annForm, setAnnForm] = useState({
    title: '',
    message: '',
    dueDate: '',
    prices: [] as { livingTypeId: string, priceAmount: number }[],
    generateInvoices: true,
  });

  const columns: Column<any>[] = [
    { key: 'monthStart', title: 'Oy boshi', render: (i) => dayjs(i.monthStart).format('DD.MM.YYYY') },
    { key: 'monthEnd', title: 'Oy oxiri', render: (i) => dayjs(i.monthEnd).format('DD.MM.YYYY') },
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
            setSelectedMonth(i);
            setAnnForm(prev => ({ ...prev, title: `${dayjs(i.monthStart).format('MMMM YYYY')} oyi uchun yotoqxona to'lovi` }));
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
        title="Yotoqxona billing" 
        description="Oylik yotoqxona hisobi va invoyslar" 
        action={{ label: 'Oyni yaratish', icon: <Plus className="h-4 w-4" />, onClick: () => setMonthSlideOpen(true) }} 
      />

      <Card>
        <CardContent className="p-0">
          <DataTable columns={columns} data={months} loading={monthsLoading} />
        </CardContent>
      </Card>

      {/* Month SlideOver */}
      <SlideOver open={monthSlideOpen} onOpenChange={setMonthSlideOpen} title="Yangi oy yaratish" size="sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Oy boshlanishi</Label>
            <Input type="date" value={monthForm.monthStart} onChange={e => setMonthForm({ ...monthForm, monthStart: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Oy tugashi</Label>
            <Input type="date" value={monthForm.monthEnd} onChange={e => setMonthForm({ ...monthForm, monthEnd: e.target.value })} />
          </div>
          <Button 
            className="w-full mt-4" 
            onClick={() => createMonthMutation.mutate(monthForm)} 
            disabled={createMonthMutation.isPending || !monthForm.monthStart || !monthForm.monthEnd}
          >
            {createMonthMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Oyini yaratish
          </Button>
        </div>
      </SlideOver>

      {/* Announcement SlideOver */}
      <SlideOver open={announcementSlideOpen} onOpenChange={setAnnouncementSlideOpen} title="To'lov e'loni va invoyslar" size="md">
        <div className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold">{dayjs(selectedMonth?.monthStart).format('MMMM YYYY')}</p>
              <p className="text-muted-foreground line-height-relaxed">
                Ushbu amal tanlangan oy uchun yotoqxonada turuvchi o'quvchilarga to'lov haqida xabar yuboradi va tizimda avtomatik ravishda invoyslar yaratadi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E'lon sarlavhasi</Label>
              <Input value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })} placeholder="Masalan: Fevral oyi uchun yotoqxona to'lovi" />
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
              {livingTypes.filter((lt: any) => lt.name.toLowerCase().includes('yotoqxona') || lt.name.toLowerCase().includes('dorm')).map((lt: any) => (
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
              {livingTypes.length === 0 && <p className="text-[10px] text-muted-foreground italic">Yashash turlari topilmadi</p>}
            </div>
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 mt-8 sm:flex-row pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAnnouncementSlideOpen(false)}>Bekor qilish</Button>
            <Button 
              className="w-full sm:w-auto gap-2" 
              onClick={() => createAnnouncementMutation.mutate({ ...annForm, dormMonthId: String(selectedMonth.id) })}
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
