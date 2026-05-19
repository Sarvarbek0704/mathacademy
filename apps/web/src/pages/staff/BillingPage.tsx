import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SlideOver } from '@/components/shared/SlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  AlertCircle,
  TrendingUp,
  Receipt,
  Loader2,
  CheckCircle2,
  Clock,
  CreditCard,
  Utensils,
  BedDouble,
  GraduationCap,
  Search,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const STATUS_INFO: Record<string, { label: string; color: string; icon: any }> = {
  UNPAID: {
    label: "To'lanmagan",
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
  PARTIAL: {
    label: "Qisman to'langan",
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Clock,
  },
  PAID: {
    label: "To'langan",
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  WAIVED: {
    label: "Bekor qilingan",
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
    icon: Receipt,
  },
};

const INVOICE_TYPE_INFO: Record<string, { label: string; icon: any; color: string }> = {
  COURSE: { label: "O'quv", icon: GraduationCap, color: 'text-indigo-600' },
  MEAL: { label: 'Ovqat', icon: Utensils, color: 'text-orange-600' },
  DORM: { label: 'Yotoqxona', icon: BedDouble, color: 'text-blue-600' },
};

function formatMoney(amount: number | string) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('uz-UZ').format(n) + " so'm";
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [paySlideOpen, setPaySlideOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', note: '' });

  const limit = 15;

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['staff', 'billing', 'summary'],
    queryFn: async () => (await api.get('/staff/billing/summary')).data,
  });
  const summary = summaryRes?.data || summaryRes || {};
  const trend: any[] = summary.revenueTrend || summary.trend || [];

  const { data: invoicesRes, isLoading: invoicesLoading } = useQuery({
    queryKey: ['staff', 'billing', 'invoices', page, statusFilter, typeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (search) params.set('search', search);
      return (await api.get(`/staff/billing/invoices?${params}`)).data;
    },
  });
  const invoices: any[] = invoicesRes?.data || [];
  const totalPages = Math.ceil((invoicesRes?.total || 0) / limit);

  const recordPaymentMut = useMutation({
    mutationFn: async (payload: any) => (await api.post('/staff/billing/payments', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', 'billing'] });
      setPaySlideOpen(false);
      toast.success("To'lov muvaffaqiyatli qayd etildi");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Xatolik yuz berdi');
    },
  });

  const handleRecordPayment = () => {
    if (!payForm.amount || Number(payForm.amount) <= 0) {
      toast.error("To'lov miqdorini kiriting");
      return;
    }
    recordPaymentMut.mutate({
      invoiceId: selectedInvoice.id,
      paidAmount: Number(payForm.amount),
      method: payForm.method,
      note: payForm.note?.trim() || undefined,
    });
  };

  const statCards = [
    {
      title: "To'lanmagan",
      value: summary.unpaidCount ?? '—',
      sub: summary.unpaidTotal ? formatMoney(summary.unpaidTotal) : '',
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: "Qisman to'langan",
      value: summary.partialCount ?? '—',
      sub: summary.partialTotal ? formatMoney(summary.partialTotal) : '',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      title: "Bu oy daromad",
      value: summary.currentMonthRevenue ? formatMoney(summary.currentMonthRevenue) : '—',
      sub: "Jami to'langan",
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Jami hisob-faktura',
      value: summary.totalInvoices ?? invoicesRes?.total ?? '—',
      sub: 'Tizimda',
      icon: Receipt,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing boshqaruvi"
        description="Hisob-fakturalar, to'lovlar va moliyaviy ko'rsatkichlar"
      />

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/staff/invoices', label: "Hisob-fakturalar", icon: Receipt, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { to: '/staff/meal-billing', label: 'Ovqat billing', icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { to: '/staff/dorm-billing', label: 'Yotoqxona billing', icon: BedDouble, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        ].map((link) => (
          <Link key={link.to} to={link.to}>
            <Card className="hover:border-primary/50 transition-all cursor-pointer">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={cn('p-2 rounded-lg', link.bg)}>
                  <link.icon className={cn('h-5 w-5', link.color)} />
                </div>
                <span className="font-medium text-sm">{link.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Stat cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.title}>
              <CardContent className="p-5 flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl flex-shrink-0', s.bg)}>
                  <s.icon className={cn('h-5 w-5', s.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                  <p className="text-xl font-bold truncate">{s.value}</p>
                  {s.sub && <p className="text-[10px] text-muted-foreground truncate">{s.sub}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue trend chart */}
      {trend.length > 0 && (
        <Card>
          <CardHeader className="pb-0 px-5 pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Oylik daromad tendensiyasi</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="courseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dormGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <Tooltip formatter={(v: any) => formatMoney(v)} />
                <Legend />
                <Area type="monotone" dataKey="COURSE" name="O'quv" stroke="#6366f1" fill="url(#courseGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="MEAL" name="Ovqat" stroke="#f97316" fill="url(#mealGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="DORM" name="Yotoqxona" stroke="#3b82f6" fill="url(#dormGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Invoice list */}
      <Card>
        <CardHeader className="px-5 pt-4 pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Hisob-fakturalar
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Qidirish..."
                  className="pl-8 h-8 text-xs w-44"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select
                value={typeFilter || '_all'}
                onValueChange={(v) => { setTypeFilter(v === '_all' ? '' : v); setPage(1); }}
              >
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue placeholder="Turi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Barchasi</SelectItem>
                  {Object.entries(INVOICE_TYPE_INFO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter || '_all'}
                onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1); }}
              >
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="Holat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Barchasi</SelectItem>
                  {Object.entries(STATUS_INFO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {invoicesLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Receipt className="h-10 w-10 opacity-20" />
              <p className="text-sm">Hisob-fakturalar topilmadi</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs pl-5">O'quvchi</TableHead>
                    <TableHead className="text-xs">Turi</TableHead>
                    <TableHead className="text-xs">Miqdor</TableHead>
                    <TableHead className="text-xs">To'langan</TableHead>
                    <TableHead className="text-xs">Holat</TableHead>
                    <TableHead className="text-xs">Sana</TableHead>
                    <TableHead className="text-xs text-right pr-5">Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => {
                    const statusInfo = STATUS_INFO[inv.status] || STATUS_INFO.UNPAID;
                    const typeInfo = INVOICE_TYPE_INFO[inv.type] || INVOICE_TYPE_INFO.COURSE;
                    const TypeIcon = typeInfo.icon;
                    const remaining = Number(inv.amount) - Number(inv.paidAmount || 0);
                    return (
                      <TableRow key={inv.id} className="text-sm">
                        <TableCell className="font-medium pl-5 py-2.5">
                          <div>
                            <p className="text-sm">{inv.studentName || inv.student?.fullName || inv.student?.full_name}</p>
                            {inv.groupName && (
                              <p className="text-xs text-muted-foreground">{inv.groupName}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className={cn('flex items-center gap-1 text-xs', typeInfo.color)}>
                            <TypeIcon className="h-3.5 w-3.5" />
                            {typeInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs font-medium">
                          {formatMoney(inv.amount)}
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {Number(inv.paidAmount) > 0 ? formatMoney(inv.paidAmount) : '—'}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge
                            className={cn('text-[10px] font-semibold border-none h-5', statusInfo.color)}
                            variant="outline"
                          >
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5 text-xs text-muted-foreground">
                          {dayjs(inv.issuedAt || inv.createdAt).format('DD.MM.YYYY')}
                        </TableCell>
                        <TableCell className="py-2.5 text-right pr-5">
                          {inv.status !== 'PAID' && inv.status !== 'WAIVED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPayForm({
                                  amount: String(remaining),
                                  method: 'CASH',
                                  note: '',
                                });
                                setPaySlideOpen(true);
                              }}
                            >
                              <CreditCard className="h-3 w-3" />
                              To'lov
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Sahifa {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment SlideOver */}
      <SlideOver
        open={paySlideOpen}
        onOpenChange={setPaySlideOpen}
        title="To'lovni qayd etish"
        size="sm"
      >
        {selectedInvoice && (
          <div className="space-y-5">
            <div className="p-4 bg-muted/40 rounded-lg space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">O'quvchi</span>
                <span className="font-medium">
                  {selectedInvoice.studentName || selectedInvoice.student?.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jami</span>
                <span className="font-medium">{formatMoney(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To'langan</span>
                <span className="font-medium text-green-600">
                  {formatMoney(selectedInvoice.paidAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground font-medium">Qoldi</span>
                <span className="font-bold text-red-600">
                  {formatMoney(Number(selectedInvoice.amount) - Number(selectedInvoice.paidAmount || 0))}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>To'lov miqdori <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder="Miqdorni kiriting"
              />
            </div>

            <div className="space-y-2">
              <Label>To'lov usuli</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Naqd pul</SelectItem>
                  <SelectItem value="CARD">Karta</SelectItem>
                  <SelectItem value="TRANSFER">Bank o'tkazma</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Izoh</Label>
              <Input
                value={payForm.note}
                onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                placeholder="Ixtiyoriy izoh..."
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row justify-end pt-4 border-t">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPaySlideOpen(false)}>
                Bekor qilish
              </Button>
              <Button
                className="w-full sm:w-auto gap-2"
                onClick={handleRecordPayment}
                disabled={recordPaymentMut.isPending}
              >
                {recordPaymentMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                To'lovni saqlash
              </Button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
