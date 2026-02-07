import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCourseInvoiceDto,
  CreateDormAnnouncementDto,
  CreateDormMonthDto,
  CreateMealAnnouncementDto,
  CreateMealWeekDto,
  CreatePaymentDto,
  ListInvoicesQueryDto,
  ListLivingTypesQueryDto,
  ListPaymentsQueryDto,
} from './dto/billing.dto';

const bi = (v: string | number | bigint) => BigInt(v);

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isoWeekKey(date: Date): string {
  const tmp = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async listLivingTypes(tenantId: bigint, q: ListLivingTypesQueryDto) {
    const rows = await this.prisma.living_types.findMany({
      where: {
        tenant_id: tenantId,
        ...(q.active === undefined ? {} : { is_active: q.active }),
      },
      orderBy: [{ created_at: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        is_active: true,
      },
    });

    return rows.map((r) => ({
      id: String(r.id),
      code: r.code,
      name: r.name,
      description: r.description,
      isActive: r.is_active,
    }));
  }

  async seedDefaultLivingTypes(tenantId: bigint, force = false) {
    const defaults = [
      {
        code: 'DAY_ONLY',
        name: 'Home commuter (lunch only)',
        description: 'Student goes home daily, lunch only.',
      },
      {
        code: 'WEEKDAYS_ONLY',
        name: 'Weekday resident (Mon–Fri)',
        description: 'Lives in dorm Mon–Fri, weekends at home.',
      },
      {
        code: 'FULL_BOARD',
        name: 'Full resident (7 days)',
        description: 'Lives in dorm full week including weekends.',
      },
    ] as const;

    if (force) {
      // soft reset: deactivate others, then upsert defaults
      await this.prisma.living_types.updateMany({
        where: { tenant_id: tenantId },
        data: { is_active: false },
      });
    }

    const res = await this.prisma.living_types.createMany({
      data: defaults.map((d) => ({
        tenant_id: tenantId,
        code: d.code,
        name: d.name,
        description: d.description,
        is_active: true,
      })),
      skipDuplicates: true,
    });

    // ensure they are active
    await this.prisma.living_types.updateMany({
      where: { tenant_id: tenantId, code: { in: defaults.map((d) => d.code) } },
      data: { is_active: true },
    });

    return { inserted: res.count };
  }

  async createMealWeek(tenantId: bigint, dto: CreateMealWeekDto) {
    const start = new Date(dto.weekStart);
    const end = new Date(dto.weekEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestException('INVALID_DATE');
    if (start > end) throw new BadRequestException('weekStart > weekEnd');

    const key = isoWeekKey(start);

    const row = await this.prisma.meal_weeks.create({
      data: {
        tenant_id: tenantId,
        week_key: key,
        week_start: start,
        week_end: end,
      },
      select: { id: true, week_key: true, week_start: true, week_end: true },
    });

    return {
      id: String(row.id),
      weekKey: row.week_key,
      weekStart: toISODate(row.week_start),
      weekEnd: toISODate(row.week_end),
    };
  }

  async createDormMonth(tenantId: bigint, dto: CreateDormMonthDto) {
    const start = new Date(dto.monthStart);
    const end = new Date(dto.monthEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestException('INVALID_DATE');
    if (start > end) throw new BadRequestException('monthStart > monthEnd');

    const key = monthKey(start);

    const row = await this.prisma.dorm_billing_months.create({
      data: {
        tenant_id: tenantId,
        month_key: key,
        month_start: start,
        month_end: end,
      },
      select: { id: true, month_key: true, month_start: true, month_end: true },
    });

    return {
      id: String(row.id),
      monthKey: row.month_key,
      monthStart: toISODate(row.month_start),
      monthEnd: toISODate(row.month_end),
    };
  }

  private async getActiveStudentsWithLivingType(
    tx: Prisma.TransactionClient,
    tenantId: bigint,
  ) {
    return tx.students.findMany({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        living_type_id: { not: null },
      },
      select: { id: true, living_type_id: true },
      orderBy: [{ id: 'asc' }],
    });
  }

  async createMealAnnouncement(
    tenantId: bigint,
    staffUserId: bigint,
    dto: CreateMealAnnouncementDto,
  ) {
    if (!dto.prices?.length) throw new BadRequestException('prices required');

    const week = await this.prisma.meal_weeks.findFirst({
      where: { id: bi(dto.mealWeekId), tenant_id: tenantId },
      select: { id: true, week_start: true, week_end: true },
    });
    if (!week) throw new NotFoundException('MEAL_WEEK_NOT_FOUND');

    const priceMap = new Map<string, number>();
    for (const p of dto.prices) {
      if (p.priceAmount < 0)
        throw new BadRequestException('priceAmount must be >= 0');
      priceMap.set(p.livingTypeId, p.priceAmount);
    }

    const overrideMap = new Map<string, number>();
    for (const o of dto.overrides ?? []) {
      if (o.amount < 0)
        throw new BadRequestException('override amount must be >= 0');
      overrideMap.set(o.studentId, o.amount);
    }

    const isPublished = dto.isPublished ?? true;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const generateInvoices = dto.generateInvoices ?? true;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ann = await tx.meal_payment_announcements.create({
        data: {
          tenant_id: tenantId,
          meal_week_id: week.id,
          title: dto.title,
          message: dto.message ?? null,
          due_date: dueDate,
          is_published: isPublished,
          published_at: isPublished ? new Date() : null,
          created_by_user_id: staffUserId,
        },
        select: { id: true },
      });

      await tx.meal_announcement_prices.createMany({
        data: dto.prices.map((p) => ({
          meal_announcement_id: ann.id,
          living_type_id: bi(p.livingTypeId),
          price_amount: new Prisma.Decimal(p.priceAmount),
          currency: 'UZS',
        })),
        skipDuplicates: true,
      });

      const students = await this.getActiveStudentsWithLivingType(tx, tenantId);

      let chargesCreated = 0;
      let invoicesCreated = 0;

      for (const s of students) {
        const sid = String(s.id);
        const amountNum = overrideMap.has(sid)
          ? overrideMap.get(sid)!
          : priceMap.get(String(s.living_type_id!));
        if (amountNum === undefined) continue;

        const amount = new Prisma.Decimal(amountNum);

        let invoiceId: bigint | null = null;
        if (generateInvoices) {
          const inv = await tx.invoices.create({
            data: {
              tenant_id: tenantId,
              student_id: s.id,
              type: 'MEAL',
              period_start: week.week_start,
              period_end: week.week_end,
              amount,
              currency: 'UZS',
              status: 'PENDING',
              due_date: dueDate,
              created_by_user_id: staffUserId,
            },
            select: { id: true },
          });
          invoiceId = inv.id;
          invoicesCreated++;
        }

        await tx.meal_student_charges.create({
          data: {
            tenant_id: tenantId,
            meal_announcement_id: ann.id,
            student_id: s.id,
            living_type_id: s.living_type_id!,
            amount,
            currency: 'UZS',
            status: 'PENDING',
            invoice_id: invoiceId,
          },
        });

        chargesCreated++;
      }

      return {
        id: String(ann.id),
        chargesCreated,
        invoicesCreated,
      };
    });
  }

  async createDormAnnouncement(
    tenantId: bigint,
    staffUserId: bigint,
    dto: CreateDormAnnouncementDto,
  ) {
    if (!dto.prices?.length) throw new BadRequestException('prices required');

    const month = await this.prisma.dorm_billing_months.findFirst({
      where: { id: bi(dto.dormMonthId), tenant_id: tenantId },
      select: { id: true, month_start: true, month_end: true },
    });
    if (!month) throw new NotFoundException('DORM_MONTH_NOT_FOUND');

    const priceMap = new Map<string, number>();
    for (const p of dto.prices) {
      if (p.priceAmount < 0)
        throw new BadRequestException('priceAmount must be >= 0');
      priceMap.set(p.livingTypeId, p.priceAmount);
    }

    const overrideMap = new Map<string, number>();
    for (const o of dto.overrides ?? []) {
      if (o.amount < 0)
        throw new BadRequestException('override amount must be >= 0');
      overrideMap.set(o.studentId, o.amount);
    }

    const isPublished = dto.isPublished ?? true;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const generateInvoices = dto.generateInvoices ?? true;

    return this.prisma.$transaction(async (tx) => {
      const ann = await tx.dorm_payment_announcements.create({
        data: {
          tenant_id: tenantId,
          dorm_month_id: month.id,
          title: dto.title,
          message: dto.message ?? null,
          due_date: dueDate,
          is_published: isPublished,
          published_at: isPublished ? new Date() : null,
          created_by_user_id: staffUserId,
        },
        select: { id: true },
      });

      await tx.dorm_announcement_prices.createMany({
        data: dto.prices.map((p) => ({
          dorm_announcement_id: ann.id,
          living_type_id: bi(p.livingTypeId),
          price_amount: new Prisma.Decimal(p.priceAmount),
          currency: 'UZS',
        })),
        skipDuplicates: true,
      });

      const students = await this.getActiveStudentsWithLivingType(tx, tenantId);

      let chargesCreated = 0;
      let invoicesCreated = 0;

      for (const s of students) {
        const sid = String(s.id);
        const amountNum = overrideMap.has(sid)
          ? overrideMap.get(sid)!
          : priceMap.get(String(s.living_type_id!));
        if (amountNum === undefined) continue;

        const amount = new Prisma.Decimal(amountNum);

        let invoiceId: bigint | null = null;
        if (generateInvoices) {
          const inv = await tx.invoices.create({
            data: {
              tenant_id: tenantId,
              student_id: s.id,
              type: 'DORM',
              period_start: month.month_start,
              period_end: month.month_end,
              amount,
              currency: 'UZS',
              status: 'PENDING',
              due_date: dueDate,
              created_by_user_id: staffUserId,
            },
            select: { id: true },
          });
          invoiceId = inv.id;
          invoicesCreated++;
        }

        await tx.dorm_student_charges.create({
          data: {
            tenant_id: tenantId,
            dorm_announcement_id: ann.id,
            student_id: s.id,
            living_type_id: s.living_type_id!,
            amount,
            currency: 'UZS',
            status: 'PENDING',
            invoice_id: invoiceId,
          },
        });

        chargesCreated++;
      }

      return {
        id: String(ann.id),
        chargesCreated,
        invoicesCreated,
      };
    });
  }

  async listInvoices(tenantId: bigint, q: ListInvoicesQueryDto) {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
    const offset = Math.max(q.offset ?? 0, 0);

    const rows = await this.prisma.invoices.findMany({
      where: {
        tenant_id: tenantId,
        ...(q.studentId ? { student_id: bi(q.studentId) } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.from ? { period_start: { gte: new Date(q.from) } } : {}),
        ...(q.to ? { period_end: { lte: new Date(q.to) } } : {}),
      },
      include: {
        students: { select: { full_name: true } },
      },
      orderBy: [{ created_at: 'desc' }],
      take: limit,
      skip: offset,
    });

    return rows.map((r) => ({
      id: String(r.id),
      studentId: String(r.student_id),
      studentName: r.students.full_name,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      periodStart: r.period_start ? toISODate(r.period_start) : null,
      periodEnd: r.period_end ? toISODate(r.period_end) : null,
      dueDate: r.due_date ? toISODate(r.due_date) : null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async createCourseInvoice(
    tenantId: bigint,
    staffUserId: bigint,
    dto: CreateCourseInvoiceDto,
  ) {
    if (dto.amount < 0) throw new BadRequestException('amount must be >= 0');

    const student = await this.prisma.students.findFirst({
      where: { id: bi(dto.studentId), tenant_id: tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

    const inv = await this.prisma.invoices.create({
      data: {
        tenant_id: tenantId,
        student_id: student.id,
        type: dto.type ?? 'COURSE',
        period_start: dto.periodStart ? new Date(dto.periodStart) : null,
        period_end: dto.periodEnd ? new Date(dto.periodEnd) : null,
        amount: new Prisma.Decimal(dto.amount),
        currency: 'UZS',
        status: 'PENDING',
        due_date: dto.dueDate ? new Date(dto.dueDate) : null,
        created_by_user_id: staffUserId,
      },
      select: { id: true },
    });

    return { id: String(inv.id) };
  }

  async createPayment(
    tenantId: bigint,
    staffUserId: bigint,
    dto: CreatePaymentDto,
  ) {
    if (dto.paidAmount < 0)
      throw new BadRequestException('paidAmount must be >= 0');

    const invoiceId = bi(dto.invoiceId);

    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoices.findFirst({
        where: { id: invoiceId, tenant_id: tenantId },
        select: { id: true, amount: true, status: true },
      });
      if (!inv) throw new NotFoundException('INVOICE_NOT_FOUND');

      await tx.payments.create({
        data: {
          tenant_id: tenantId,
          invoice_id: inv.id,
          source: dto.source ?? 'MANUAL',
          paid_amount: new Prisma.Decimal(dto.paidAmount),
          method: dto.method ?? 'CASH',
          reference: dto.reference ?? null,
          created_by_user_id: staffUserId,
          received_by_user_id: staffUserId,
        },
        select: { id: true },
      });

      const agg = await tx.payments.aggregate({
        where: { tenant_id: tenantId, invoice_id: inv.id },
        _sum: { paid_amount: true },
      });

      const totalPaid = agg._sum.paid_amount ?? new Prisma.Decimal(0);
      const paid = (totalPaid as any).greaterThanOrEqualTo
        ? (totalPaid as any).greaterThanOrEqualTo(inv.amount)
        : totalPaid.toNumber() >= inv.amount.toNumber();

      const nextStatus = paid ? 'PAID' : 'PENDING';

      if (nextStatus !== inv.status) {
        await tx.invoices.update({
          where: { id: inv.id },
          data: { status: nextStatus },
        });

        if (nextStatus === 'PAID') {
          await tx.meal_student_charges.updateMany({
            where: { tenant_id: tenantId, invoice_id: inv.id },
            data: { status: 'PAID' },
          });
          await tx.dorm_student_charges.updateMany({
            where: { tenant_id: tenantId, invoice_id: inv.id },
            data: { status: 'PAID' },
          });
        }
      }

      return {
        ok: true,
        invoiceId: String(inv.id),
        totalPaid,
        invoiceStatus: nextStatus,
      };
    });
  }

  async listPayments(tenantId: bigint, q: ListPaymentsQueryDto) {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
    const offset = Math.max(q.offset ?? 0, 0);

    const rows = await this.prisma.payments.findMany({
      where: {
        tenant_id: tenantId,
        ...(q.invoiceId ? { invoice_id: bi(q.invoiceId) } : {}),
        ...(q.studentId ? { invoices: { student_id: bi(q.studentId) } } : {}),
      },
      include: {
        invoices: { select: { student_id: true, type: true } },
      },
      orderBy: [{ paid_at: 'desc' }],
      take: limit,
      skip: offset,
    });

    return rows.map((p) => ({
      id: String(p.id),
      invoiceId: String(p.invoice_id),
      studentId: String(p.invoices.student_id),
      invoiceType: p.invoices.type,
      source: p.source,
      method: p.method,
      paidAmount: p.paid_amount,
      paidAt: p.paid_at.toISOString(),
      reference: p.reference,
    }));
  }

  async guardianInvoices(tenantId: bigint, studentAccountId: bigint) {
    const acc = await this.prisma.student_accounts.findFirst({
      where: { id: studentAccountId, tenant_id: tenantId },
      select: { student_id: true },
    });
    if (!acc) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

    const rows = await this.prisma.invoices.findMany({
      where: { tenant_id: tenantId, student_id: acc.student_id },
      orderBy: [{ created_at: 'desc' }],
    });

    return rows.map((r) => ({
      id: String(r.id),
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      periodStart: r.period_start ? toISODate(r.period_start) : null,
      periodEnd: r.period_end ? toISODate(r.period_end) : null,
      dueDate: r.due_date ? toISODate(r.due_date) : null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async guardianPayments(tenantId: bigint, studentAccountId: bigint) {
    const acc = await this.prisma.student_accounts.findFirst({
      where: { id: studentAccountId, tenant_id: tenantId },
      select: { student_id: true },
    });
    if (!acc) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

    const rows = await this.prisma.payments.findMany({
      where: { tenant_id: tenantId, invoices: { student_id: acc.student_id } },
      include: { invoices: { select: { id: true, type: true } } },
      orderBy: [{ paid_at: 'desc' }],
    });

    return rows.map((p) => ({
      id: String(p.id),
      invoiceId: String(p.invoices.id),
      invoiceType: p.invoices.type,
      paidAmount: p.paid_amount,
      method: p.method,
      source: p.source,
      paidAt: p.paid_at.toISOString(),
      reference: p.reference,
    }));
  }
}
