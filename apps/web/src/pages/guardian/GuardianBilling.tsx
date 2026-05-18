import { useState } from 'react';
import { TablePageSkeleton } from '@/components/shared/PageSkeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronUp,
  BookOpen,
  UtensilsCrossed,
  Building2,
  Receipt,
  Banknote,
  Smartphone,
  ArrowLeftRight,
  Wallet,
  PartyPopper,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (amount: number) =>
  `${new Intl.NumberFormat('uz-UZ').format(Math.round(amount))} so'm`;

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  COURSE: {
    label: "O'quv to'lovi",
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
  MEAL: {
    label: 'Ovqatlanish',
    icon: <UtensilsCrossed className="h-4 w-4" />,
    color: 'text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  },
  DORM: {
    label: 'Yotoqxona',
    icon: <Building2 className="h-4 w-4" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  },
};

const STATUS_META: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  PAID: { label: "To'langan", variant: 'success' },
  PARTIAL: { label: 'Qisman', variant: 'warning' },
  PENDING: { label: "To'lanmagan", variant: 'destructive' },
  OVERDUE: { label: "Muddati o'tgan", variant: 'destructive' },
  CANCELLED: { label: 'Bekor qilingan', variant: 'secondary' },
};

const PAYMENT_METHODS = [
  { value: 'CARD', label: 'Karta', icon: <CreditCard className="h-5 w-5" />, desc: 'Plastik karta orqali' },
  { value: 'CASH', label: 'Naqd', icon: <Banknote className="h-5 w-5" />, desc: "Kassaga kelib to'lash" },
  { value: 'TRANSFER', label: "O'tkazma", icon: <ArrowLeftRight className="h-5 w-5" />, desc: 'Bank o\'tkazmasi' },
  { value: 'OTHER', label: 'Boshqa', icon: <Smartphone className="h-5 w-5" />, desc: 'Payme / Click' },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

// ─── Payment Dialog ───────────────────────────────────────────────────────────
function PaymentDialog({
  invoice,
  open,
  onClose,
  onSuccess,
}: {
  invoice: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const pending = safeNum(invoice?.remainingAmount ?? invoice?.pendingAmount);
  const [amount, setAmount] = useState(String(Math.round(pending)));
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<any>(null);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post(`/guardian/billing/invoices/${invoice.id}/pay`, {
        paidAmount: parseFloat(amount),
        method,
      })).data,
    onSuccess: (data) => {
      setResult(data);
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ['guardian', 'billing', 'invoices'] });
      toast.success("To'lov muvaffaqiyatli amalga oshirildi");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      if (msg === 'INVOICE_ALREADY_PAID') toast.error('Bu hisob allaqachon to\'langan');
      else if (msg === 'INVOICE_CANCELLED') toast.error('Bu hisob bekor qilingan');
      else toast.error("To'lovda xatolik yuz berdi. Qayta urinib ko'ring");
    },
  });

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= pending * 1.01;

  function handleClose() {
    setDone(false);
    setResult(null);
    setAmount(String(Math.round(pending)));
    setMethod('CARD');
    onClose();
    if (done) onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          // ── Success screen ────────────────────────────────────────────────
          <div className="flex flex-col items-center text-center py-6 gap-4">
            <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
              <PartyPopper className="h-8 w-8 text-success" />
            </div>
            <div>
              <h2 className="text-xl font-black">To'lov qabul qilindi!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {fmt(safeNum(result?.paidAmount))} muvaffaqiyatli to'landi
              </p>
            </div>
            {result?.invoiceStatus === 'PAID' ? (
              <Badge variant="success" className="gap-1.5 px-4 py-1.5 text-sm">
                <CheckCircle2 className="h-4 w-4" /> Hisob to'liq yopildi
              </Badge>
            ) : (
              <div className="text-sm text-muted-foreground">
                Qolgan qoldiq:{' '}
                <span className="font-bold text-destructive">
                  {fmt(pending - parsedAmount)}
                </span>
              </div>
            )}
            <Button className="w-full mt-2" onClick={handleClose}>
              Yopish
            </Button>
          </div>
        ) : (
          // ── Payment form ──────────────────────────────────────────────────
          <>
            <DialogHeader>
              <DialogTitle>Hisob-fakturani to'lash</DialogTitle>
              <DialogDescription>
                #{invoice?.invoiceNumber || invoice?.id} •{' '}
                {TYPE_META[invoice?.type]?.label ?? invoice?.type}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Pending amount info */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/8 border border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold">Qoldiq summa</span>
                </div>
                <span className="font-black text-destructive">{fmt(pending)}</span>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <Label>To'lov miqdori (so'm)</Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    max={pending}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-9 font-bold text-lg"
                    placeholder="0"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[pending, pending / 2, pending / 4].filter(v => v > 0).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setAmount(String(Math.round(v)))}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors font-semibold"
                    >
                      {v === pending ? "To'liq" : fmt(v)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Method selector */}
              <div className="space-y-1.5">
                <Label>To'lov usuli</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={cn(
                        'flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all',
                        method === m.value
                          ? 'border-primary bg-primary/8 text-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40',
                      )}
                    >
                      <div className={cn('shrink-0', method === m.value ? 'text-primary' : 'text-muted-foreground')}>
                        {m.icon}
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-none">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Confirm button */}
              <Button
                className="w-full h-11 text-base font-bold gap-2"
                disabled={!isValid || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {mutation.isPending
                  ? "Amalga oshirilmoqda..."
                  : `${fmt(parsedAmount)} to'lash`}
              </Button>

              {method === 'CASH' && (
                <p className="text-xs text-center text-muted-foreground">
                  Naqd to'lov uchun akademiya kassasiga keling. Bu so'rov xabarlar jurnalida qayd etiladi.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Card ─────────────────────────────────────────────────────────────
function InvoiceCard({ invoice, onPay }: { invoice: any; onPay: (inv: any) => void }) {
  const [expanded, setExpanded] = useState(false);

  const amount = safeNum(invoice.amount);
  const paid = safeNum(invoice.paidAmount ?? (amount - safeNum(invoice.pendingAmount ?? invoice.remainingAmount)));
  const pending = safeNum(invoice.remainingAmount ?? invoice.pendingAmount ?? 0);
  const paidPct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;

  const typeMeta = TYPE_META[invoice.type] ?? {
    label: invoice.type || 'Boshqa',
    icon: <Receipt className="h-4 w-4" />,
    color: 'text-gray-600 bg-gray-50 border-gray-200',
  };
  const statusMeta = STATUS_META[invoice.status] ?? { label: invoice.status, variant: 'secondary' as const };

  const payments: any[] = Array.isArray(invoice.payments) ? invoice.payments : [];
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && pending > 0;
  const canPay = pending > 0 && invoice.status !== 'CANCELLED';

  return (
    <Card className={cn('transition-all', isOverdue && 'border-destructive/50')}>
      <CardContent className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0', typeMeta.color)}>
            {typeMeta.icon}
            {typeMeta.label}
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <span className="font-mono text-xs text-muted-foreground">#{invoice.invoiceNumber || invoice.id}</span>
            <Badge variant={statusMeta.variant} className="text-[10px] h-5">{statusMeta.label}</Badge>
            {isOverdue && (
              <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                <Clock className="h-3 w-3" /> Muddati o'tgan
              </Badge>
            )}
          </div>
          {canPay && (
            <Button
              size="sm"
              className="h-8 px-3 gap-1.5 text-xs font-bold shrink-0"
              onClick={() => onPay(invoice)}
            >
              <CreditCard className="h-3.5 w-3.5" />
              To'lash
            </Button>
          )}
          {invoice.status === 'PAID' && (
            <div className="flex items-center gap-1 text-success text-xs font-bold">
              <CheckCircle2 className="h-4 w-4" /> To'liq to'langan
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>To'langan: <span className="font-bold text-foreground">{fmt(paid)}</span></span>
            <span>Jami: <span className="font-bold text-foreground">{fmt(amount)}</span></span>
          </div>
          <Progress value={paidPct} className={cn('h-2', paidPct === 100 ? '[&>div]:bg-success' : pending > 0 ? '[&>div]:bg-primary' : '')} />
          {pending > 0 && (
            <p className="text-xs text-destructive font-semibold">Qoldiq: {fmt(pending)}</p>
          )}
        </div>

        {/* Footer: due date + expand payments */}
        <div className="flex items-center justify-between pt-1">
          {dueDate ? (
            <p className={cn('text-xs', isOverdue ? 'text-destructive font-bold' : 'text-muted-foreground')}>
              Muddat: {dueDate.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          ) : <span />}

          {payments.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {payments.length} ta to'lov
            </button>
          )}
        </div>

        {/* Payment history */}
        {expanded && payments.length > 0 && (
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">To'lovlar tarixi</p>
            {payments.map((p: any, idx: number) => (
              <div key={p.id ?? idx} className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-bold">{fmt(safeNum(p.paidAmount ?? p.paid_amount ?? p.amount))}</span>
                  <span className="text-muted-foreground">{p.method || 'Naqd'}</span>
                  {p.source === 'ONLINE' && (
                    <Badge variant="secondary" className="text-[9px] h-4">Onlayn</Badge>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {p.paidAt || p.paid_at || p.createdAt
                    ? new Date(p.paidAt || p.paid_at || p.createdAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GuardianBilling() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [payingInvoice, setPayingInvoice] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: billRes, isLoading } = useQuery({
    queryKey: ['guardian', 'billing', 'invoices'],
    queryFn: async () => (await api.get('/guardian/billing/invoices')).data,
  });

  if (isLoading) {
    return (
      <TablePageSkeleton />
    );
  }

  const invoices: any[] = Array.isArray(billRes?.invoices) ? billRes.invoices : [];
  const summary = billRes?.summary ?? {};

  const totalInvoiced = safeNum(summary.totalAmount ?? summary.totalInvoiced);
  const totalPaid = safeNum(summary.totalPaid);
  const totalPending = safeNum(summary.totalRemaining ?? summary.totalPending);
  const overallPct = totalInvoiced > 0 ? Math.min(100, Math.round((totalPaid / totalInvoiced) * 100)) : 0;

  const filtered = typeFilter ? invoices.filter((i) => i.type === typeFilter) : invoices;
  const pendingCount = invoices.filter((i) => safeNum(i.remainingAmount ?? i.pendingAmount) > 0).length;
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const types = Array.from(new Set(invoices.map((i) => i.type).filter(Boolean)));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader title="To'lovlar" description="Hisob-fakturalar va to'lov tarixi" />

      {/* Summary card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Umumiy holat</p>
              <p className="text-3xl font-black mt-1">{fmt(totalPaid)}</p>
              <p className="text-sm text-muted-foreground">{fmt(totalInvoiced)} dan to'landi</p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-black text-success">{paidCount}</p>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">To'langan</p>
              </div>
              <div>
                <p className="text-2xl font-black text-destructive">{pendingCount}</p>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">Qoldiq bor</p>
              </div>
              <div>
                <p className="text-2xl font-black">{invoices.length}</p>
                <p className="text-[11px] text-muted-foreground font-semibold uppercase">Jami hisob</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>To'lov foizi</span>
              <span className="font-bold">{overallPct}%</span>
            </div>
            <Progress value={overallPct} className="h-3" />
          </div>
          {totalPending > 0 && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm font-semibold text-destructive">Umumiy qoldiq: {fmt(totalPending)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Type filter chips */}
      {types.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-all', !typeFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40')}
          >
            Barchasi ({invoices.length})
          </button>
          {types.map((type) => {
            const meta = TYPE_META[type];
            const count = invoices.filter((i) => i.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5', typeFilter === type ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/40')}
              >
                {meta?.icon} {meta?.label ?? type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl">
          <CreditCard className="h-12 w-12 mb-4 opacity-20" />
          <p className="font-medium">Hisob-fakturalar mavjud emas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((invoice: any) => (
            <InvoiceCard key={invoice.id} invoice={invoice} onPay={setPayingInvoice} />
          ))}
        </div>
      )}

      {/* Payment dialog */}
      {payingInvoice && (
        <PaymentDialog
          invoice={payingInvoice}
          open={!!payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['guardian', 'billing', 'invoices'] })}
        />
      )}
    </div>
  );
}
