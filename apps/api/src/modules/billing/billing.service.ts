// apps/api/src/modules/billing/billing.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
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
  SeedDefaultsDto,
} from './dto/billing.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function isoWeekKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class BillingService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== LIVING TYPES ====================

  async listLivingTypes(tenantId: string, q: ListLivingTypesQueryDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

    const where: Prisma.living_typesWhereInput = {
      tenant_id,
    };

    if (q.active !== undefined) {
      where.is_active = q.active;
    }

    const items = await this.prisma.living_types.findMany({
      where,
      orderBy: [{ created_at: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        is_active: true,
        created_at: true,
        _count: {
          select: {
            students: true,
            meal_student_charges: true,
            dorm_student_charges: true,
          },
        },
      },
    });

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        code: item.code,
        name: item.name,
        description: item.description,
        isActive: item.is_active,
        createdAt: item.created_at,
        stats: {
          students: item._count.students,
          mealCharges: item._count.meal_student_charges,
          dormCharges: item._count.dorm_student_charges,
        },
      })),
    };
  }

  async seedDefaultLivingTypes(tenantId: string, dto: SeedDefaultsDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

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

    return await this.prisma.$transaction(async (tx) => {
      if (dto.force) {
        await tx.living_types.updateMany({
          where: { tenant_id },
          data: { is_active: false },
        });
      }

      let created = 0;
      let updated = 0;

      for (const def of defaults) {
        const existing = await tx.living_types.findFirst({
          where: { tenant_id, code: def.code },
        });

        if (existing) {
          await tx.living_types.update({
            where: { id: existing.id },
            data: {
              name: def.name,
              description: def.description,
              is_active: true,
            },
          });
          updated++;
        } else {
          await tx.living_types.create({
            data: {
              tenant_id,
              code: def.code,
              name: def.name,
              description: def.description,
              is_active: true,
            },
          });
          created++;
        }
      }

      return {
        ok: true,
        created,
        updated,
        total: defaults.length,
      };
    });
  }

  // ==================== MEAL BILLING ====================

  async createMealWeek(tenantId: string, dto: CreateMealWeekDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

    const week_start = new Date(dto.weekStart);
    const week_end = new Date(dto.weekEnd);

    if (isNaN(week_start.getTime()) || isNaN(week_end.getTime())) {
      throw new BadRequestException('INVALID_DATE');
    }

    if (week_start > week_end) {
      throw new BadRequestException('WEEK_START_MUST_BE_BEFORE_WEEK_END');
    }

    const week_key = isoWeekKey(week_start);

    // Check if week already exists
    const existing = await this.prisma.meal_weeks.findUnique({
      where: {
        tenant_id_week_key: {
          tenant_id,
          week_key,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('MEAL_WEEK_ALREADY_EXISTS');
    }

    const week = await this.prisma.meal_weeks.create({
      data: {
        tenant_id,
        week_key,
        week_start,
        week_end,
      },
      select: {
        id: true,
        week_key: true,
        week_start: true,
        week_end: true,
        created_at: true,
      },
    });

    return {
      id: week.id.toString(),
      weekKey: week.week_key,
      weekStart: toISODate(week.week_start),
      weekEnd: toISODate(week.week_end),
      createdAt: week.created_at,
    };
  }

  async listMealWeeks(tenantId: string, limit = 20, offset = 0) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

    const [total, items] = await this.prisma.$transaction([
      this.prisma.meal_weeks.count({
        where: { tenant_id },
      }),
      this.prisma.meal_weeks.findMany({
        where: { tenant_id },
        orderBy: [{ week_start: 'desc' }],
        take: Math.min(limit, 200),
        skip: offset,
        include: {
          _count: {
            select: {
              meal_payment_announcements: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        weekKey: item.week_key,
        weekStart: toISODate(item.week_start),
        weekEnd: toISODate(item.week_end),
        createdAt: item.created_at,
        announcementsCount: item._count.meal_payment_announcements,
      })),
      meta: {
        total,
        limit,
        offset,
      },
    };
  }

  async createMealAnnouncement(
    tenantId: string,
    staffUserId: string,
    dto: CreateMealAnnouncementDto,
    ipAddress?: string,
  ) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const staff_user_id = toBigInt(staffUserId, 'staffUserId');
    const meal_week_id = toBigInt(dto.mealWeekId, 'mealWeekId');

    if (!dto.prices?.length) {
      throw new BadRequestException('PRICES_REQUIRED');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Check meal week
      const week = await tx.meal_weeks.findFirst({
        where: {
          id: meal_week_id,
          tenant_id,
        },
        select: {
          id: true,
          week_key: true,
          week_start: true,
          week_end: true,
        },
      });

      if (!week) {
        throw new NotFoundException('MEAL_WEEK_NOT_FOUND');
      }

      // 2. Validate living types
      const livingTypeIds = dto.prices.map((p) =>
        toBigInt(p.livingTypeId, 'livingTypeId'),
      );

      const livingTypes = await tx.living_types.findMany({
        where: {
          tenant_id,
          id: { in: livingTypeIds },
          is_active: true,
        },
        select: { id: true },
      });

      if (livingTypes.length !== livingTypeIds.length) {
        throw new BadRequestException('INVALID_LIVING_TYPE');
      }

      // 3. Create announcement
      const isPublished = dto.isPublished ?? false;
      const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      const generateInvoices = dto.generateInvoices ?? true;

      const announcement = await tx.meal_payment_announcements.create({
        data: {
          tenant_id,
          meal_week_id: week.id,
          title: dto.title.trim(),
          message: dto.message?.trim() || null,
          due_date: dueDate,
          is_published: isPublished,
          published_at: isPublished ? new Date() : null,
          created_by_user_id: staff_user_id,
        },
        select: {
          id: true,
          title: true,
          is_published: true,
        },
      });

      // 4. Create prices
      await tx.meal_announcement_prices.createMany({
        data: dto.prices.map((p) => ({
          meal_announcement_id: announcement.id,
          living_type_id: toBigInt(p.livingTypeId, 'livingTypeId'),
          price_amount: new Prisma.Decimal(p.priceAmount),
          currency: 'UZS',
        })),
      });

      // 5. Get active students with living type
      const students = await tx.students.findMany({
        where: {
          tenant_id,
          status: 'ACTIVE',
          living_type_id: { not: null },
        },
        select: {
          id: true,
          living_type_id: true,
        },
      });

      // 6. Create override map
      const overrideMap = new Map<string, number>();
      for (const o of dto.overrides ?? []) {
        if (o.amount < 0) {
          throw new BadRequestException('OVERRIDE_AMOUNT_MUST_BE_POSITIVE');
        }
        overrideMap.set(o.studentId, o.amount);
      }

      // 7. Create price map
      const priceMap = new Map<string, Prisma.Decimal>();
      for (const p of dto.prices) {
        priceMap.set(p.livingTypeId, new Prisma.Decimal(p.priceAmount));
      }

      let chargesCreated = 0;
      let invoicesCreated = 0;

      // 8. Create charges and invoices
      for (const student of students) {
        const studentIdStr = student.id.toString();
        const livingTypeIdStr = student.living_type_id!.toString();

        // Skip if no price for this living type
        if (!priceMap.has(livingTypeIdStr)) continue;

        const amount = overrideMap.has(studentIdStr)
          ? new Prisma.Decimal(overrideMap.get(studentIdStr)!)
          : priceMap.get(livingTypeIdStr)!;

        let invoiceId: bigint | null = null;

        if (generateInvoices) {
          const invoice = await tx.invoices.create({
            data: {
              tenant_id,
              student_id: student.id,
              type: 'MEAL',
              period_start: week.week_start,
              period_end: week.week_end,
              amount,
              currency: 'UZS',
              status: 'PENDING',
              due_date: dueDate,
              created_by_user_id: staff_user_id,
            },
            select: { id: true },
          });
          invoiceId = invoice.id;
          invoicesCreated++;
        }

        await tx.meal_student_charges.create({
          data: {
            tenant_id,
            meal_announcement_id: announcement.id,
            student_id: student.id,
            living_type_id: student.living_type_id!,
            amount,
            currency: 'UZS',
            status: 'PENDING',
            invoice_id: invoiceId,
          },
        });

        chargesCreated++;
      }

      // 9. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: staff_user_id,
        action: 'CREATE',
        entityType: 'meal_payment_announcements',
        entityId: announcement.id,
        afterData: {
          id: announcement.id.toString(),
          title: announcement.title,
          weekKey: week.week_key,
          pricesCount: dto.prices.length,
          studentsCount: chargesCreated,
          invoicesCount: invoicesCreated,
          isPublished: announcement.is_published,
        },
        ipAddress,
      });

      return {
        id: announcement.id.toString(),
        title: announcement.title,
        weekKey: week.week_key,
        chargesCreated,
        invoicesCreated,
        isPublished: announcement.is_published,
      };
    });
  }

  // ==================== DORM BILLING ====================

  async createDormMonth(tenantId: string, dto: CreateDormMonthDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');

    const month_start = new Date(dto.monthStart);
    const month_end = new Date(dto.monthEnd);

    if (isNaN(month_start.getTime()) || isNaN(month_end.getTime())) {
      throw new BadRequestException('INVALID_DATE');
    }

    if (month_start > month_end) {
      throw new BadRequestException('MONTH_START_MUST_BE_BEFORE_MONTH_END');
    }

    const month_key = monthKey(month_start);

    // Check if month already exists
    const existing = await this.prisma.dorm_billing_months.findUnique({
      where: {
        tenant_id_month_key: {
          tenant_id,
          month_key,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('DORM_MONTH_ALREADY_EXISTS');
    }

    const month = await this.prisma.dorm_billing_months.create({
      data: {
        tenant_id,
        month_key,
        month_start,
        month_end,
      },
      select: {
        id: true,
        month_key: true,
        month_start: true,
        month_end: true,
        created_at: true,
      },
    });

    return {
      id: month.id.toString(),
      monthKey: month.month_key,
      monthStart: toISODate(month.month_start),
      monthEnd: toISODate(month.month_end),
      createdAt: month.created_at,
    };
  }

  async createDormAnnouncement(
    tenantId: string,
    staffUserId: string,
    dto: CreateDormAnnouncementDto,
    ipAddress?: string,
  ) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const staff_user_id = toBigInt(staffUserId, 'staffUserId');
    const dorm_month_id = toBigInt(dto.dormMonthId, 'dormMonthId');

    if (!dto.prices?.length) {
      throw new BadRequestException('PRICES_REQUIRED');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Check dorm month
      const month = await tx.dorm_billing_months.findFirst({
        where: {
          id: dorm_month_id,
          tenant_id,
        },
        select: {
          id: true,
          month_key: true,
          month_start: true,
          month_end: true,
        },
      });

      if (!month) {
        throw new NotFoundException('DORM_MONTH_NOT_FOUND');
      }

      // 2. Validate living types
      const livingTypeIds = dto.prices.map((p) =>
        toBigInt(p.livingTypeId, 'livingTypeId'),
      );

      const livingTypes = await tx.living_types.findMany({
        where: {
          tenant_id,
          id: { in: livingTypeIds },
          is_active: true,
        },
        select: { id: true },
      });

      if (livingTypes.length !== livingTypeIds.length) {
        throw new BadRequestException('INVALID_LIVING_TYPE');
      }

      // 3. Create announcement
      const isPublished = dto.isPublished ?? false;
      const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      const generateInvoices = dto.generateInvoices ?? true;

      const announcement = await tx.dorm_payment_announcements.create({
        data: {
          tenant_id,
          dorm_month_id: month.id,
          title: dto.title.trim(),
          message: dto.message?.trim() || null,
          due_date: dueDate,
          is_published: isPublished,
          published_at: isPublished ? new Date() : null,
          created_by_user_id: staff_user_id,
        },
        select: {
          id: true,
          title: true,
          is_published: true,
        },
      });

      // 4. Create prices
      await tx.dorm_announcement_prices.createMany({
        data: dto.prices.map((p) => ({
          dorm_announcement_id: announcement.id,
          living_type_id: toBigInt(p.livingTypeId, 'livingTypeId'),
          price_amount: new Prisma.Decimal(p.priceAmount),
          currency: 'UZS',
        })),
      });

      // 5. Get active students with living type (FULL_BOARD or WEEKDAYS_ONLY for dorm)
      const students = await tx.students.findMany({
        where: {
          tenant_id,
          status: 'ACTIVE',
          living_type_id: { not: null },
          living_types: {
            code: { in: ['FULL_BOARD', 'WEEKDAYS_ONLY'] },
          },
        },
        select: {
          id: true,
          living_type_id: true,
        },
      });

      // 6. Create override map
      const overrideMap = new Map<string, number>();
      for (const o of dto.overrides ?? []) {
        if (o.amount < 0) {
          throw new BadRequestException('OVERRIDE_AMOUNT_MUST_BE_POSITIVE');
        }
        overrideMap.set(o.studentId, o.amount);
      }

      // 7. Create price map
      const priceMap = new Map<string, Prisma.Decimal>();
      for (const p of dto.prices) {
        priceMap.set(p.livingTypeId, new Prisma.Decimal(p.priceAmount));
      }

      let chargesCreated = 0;
      let invoicesCreated = 0;

      // 8. Create charges and invoices
      for (const student of students) {
        const studentIdStr = student.id.toString();
        const livingTypeIdStr = student.living_type_id!.toString();

        // Skip if no price for this living type
        if (!priceMap.has(livingTypeIdStr)) continue;

        const amount = overrideMap.has(studentIdStr)
          ? new Prisma.Decimal(overrideMap.get(studentIdStr)!)
          : priceMap.get(livingTypeIdStr)!;

        let invoiceId: bigint | null = null;

        if (generateInvoices) {
          const invoice = await tx.invoices.create({
            data: {
              tenant_id,
              student_id: student.id,
              type: 'DORM',
              period_start: month.month_start,
              period_end: month.month_end,
              amount,
              currency: 'UZS',
              status: 'PENDING',
              due_date: dueDate,
              created_by_user_id: staff_user_id,
            },
            select: { id: true },
          });
          invoiceId = invoice.id;
          invoicesCreated++;
        }

        await tx.dorm_student_charges.create({
          data: {
            tenant_id,
            dorm_announcement_id: announcement.id,
            student_id: student.id,
            living_type_id: student.living_type_id!,
            amount,
            currency: 'UZS',
            status: 'PENDING',
            invoice_id: invoiceId,
          },
        });

        chargesCreated++;
      }

      // 9. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: staff_user_id,
        action: 'CREATE',
        entityType: 'dorm_payment_announcements',
        entityId: announcement.id,
        afterData: {
          id: announcement.id.toString(),
          title: announcement.title,
          monthKey: month.month_key,
          pricesCount: dto.prices.length,
          studentsCount: chargesCreated,
          invoicesCount: invoicesCreated,
          isPublished: announcement.is_published,
        },
        ipAddress,
      });

      return {
        id: announcement.id.toString(),
        title: announcement.title,
        monthKey: month.month_key,
        chargesCreated,
        invoicesCreated,
        isPublished: announcement.is_published,
      };
    });
  }

  // ==================== INVOICES ====================

  async listInvoices(tenantId: string, q: ListInvoicesQueryDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.invoicesWhereInput = {
      tenant_id,
    };

    if (q.studentId) {
      where.student_id = toBigInt(q.studentId, 'studentId');
    }

    if (q.type) {
      where.type = q.type;
    }

    if (q.status) {
      where.status = q.status;
    }

    if (q.from || q.to) {
      where.created_at = {};
      if (q.from) {
        where.created_at.gte = new Date(q.from);
      }
      if (q.to) {
        const toDate = new Date(q.to);
        toDate.setHours(23, 59, 59, 999);
        where.created_at.lte = toDate;
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.invoices.count({ where }),
      this.prisma.invoices.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
            },
          },
          payments: {
            select: {
              id: true,
              paid_amount: true,
              paid_at: true,
              method: true,
              source: true,
            },
          },
          _count: {
            select: {
              payments: true,
              meal_student_charges: true,
              dorm_student_charges: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => {
        const totalPaid = item.payments.reduce(
          (sum, p) => sum.add(p.paid_amount),
          new Prisma.Decimal(0),
        );
        const remaining = item.amount.sub(totalPaid);
        const isOverdue =
          item.due_date &&
          item.status === 'PENDING' &&
          new Date(item.due_date) < new Date();

        return {
          id: item.id.toString(),
          studentId: item.student_id.toString(),
          studentName: item.students.full_name,
          type: item.type,
          amount: item.amount.toString(),
          currency: item.currency,
          status: isOverdue ? 'OVERDUE' : item.status,
          periodStart: item.period_start ? toISODate(item.period_start) : null,
          periodEnd: item.period_end ? toISODate(item.period_end) : null,
          dueDate: item.due_date ? toISODate(item.due_date) : null,
          createdAt: item.created_at,
          totalPaid: totalPaid.toString(),
          remaining: remaining.toString(),
          paymentsCount: item._count.payments,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async createCourseInvoice(
    tenantId: string,
    staffUserId: string,
    dto: CreateCourseInvoiceDto,
    ipAddress?: string,
  ) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const staff_user_id = toBigInt(staffUserId, 'staffUserId');
    const student_id = toBigInt(dto.studentId, 'studentId');

    if (dto.amount < 0) {
      throw new BadRequestException('AMOUNT_MUST_BE_POSITIVE');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Check student exists
      const student = await tx.students.findFirst({
        where: {
          id: student_id,
          tenant_id,
        },
        select: {
          id: true,
          full_name: true,
        },
      });

      if (!student) {
        throw new NotFoundException('STUDENT_NOT_FOUND');
      }

      // 2. Create invoice
      const invoice = await tx.invoices.create({
        data: {
          tenant_id,
          student_id,
          type: dto.type ?? 'COURSE',
          period_start: dto.periodStart ? new Date(dto.periodStart) : null,
          period_end: dto.periodEnd ? new Date(dto.periodEnd) : null,
          amount: new Prisma.Decimal(dto.amount),
          currency: 'UZS',
          status: 'PENDING',
          due_date: dto.dueDate ? new Date(dto.dueDate) : null,
          created_by_user_id: staff_user_id,
        },
        select: {
          id: true,
          amount: true,
          status: true,
        },
      });

      // 3. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: staff_user_id,
        action: 'CREATE',
        entityType: 'invoices',
        entityId: invoice.id,
        afterData: {
          id: invoice.id.toString(),
          studentId: student.id.toString(),
          studentName: student.full_name,
          type: dto.type ?? 'COURSE',
          amount: invoice.amount.toString(),
          status: invoice.status,
        },
        ipAddress,
      });

      return {
        id: invoice.id.toString(),
        amount: invoice.amount.toString(),
        status: invoice.status,
      };
    });
  }

  // getInvoiceDetail() metodining to'liq to'g'ri versiyasi:
  async getInvoiceDetail(tenantId: string, invoiceId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const invoice_id = toBigInt(invoiceId, 'invoiceId');

    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: invoice_id,
        tenant_id,
      },
      include: {
        students: {
          select: {
            id: true,
            full_name: true,
          },
        },
        payments: {
          orderBy: { paid_at: 'desc' },
          include: {
            // ✅ TO'G'RI RELATION NOMLARI
            users_payments_created_by_user_idTousers: {
              select: { full_name: true },
            },
            users_payments_received_by_user_idTousers: {
              select: { full_name: true },
            },
          },
        },
        meal_student_charges: {
          include: {
            meal_payment_announcements: {
              select: { title: true },
            },
          },
        },
        dorm_student_charges: {
          include: {
            dorm_payment_announcements: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('INVOICE_NOT_FOUND');
    }

    const totalPaid = invoice.payments.reduce(
      (sum, p) => sum.add(p.paid_amount),
      new Prisma.Decimal(0),
    );
    const remaining = invoice.amount.sub(totalPaid);
    const isOverdue =
      invoice.due_date &&
      invoice.status === 'PENDING' &&
      new Date(invoice.due_date) < new Date();

    return {
      id: invoice.id.toString(),
      studentId: invoice.student_id.toString(),
      studentName: invoice.students.full_name,
      type: invoice.type,
      amount: invoice.amount.toString(),
      currency: invoice.currency,
      status: isOverdue ? 'OVERDUE' : invoice.status,
      periodStart: invoice.period_start
        ? toISODate(invoice.period_start)
        : null,
      periodEnd: invoice.period_end ? toISODate(invoice.period_end) : null,
      dueDate: invoice.due_date ? toISODate(invoice.due_date) : null,
      createdAt: invoice.created_at,
      totalPaid: totalPaid.toString(),
      remaining: remaining.toString(),
      payments: invoice.payments.map((p) => ({
        id: p.id.toString(),
        paidAmount: p.paid_amount.toString(),
        paidAt: p.paid_at,
        method: p.method,
        source: p.source,
        reference: p.reference,
        createdBy: p.users_payments_created_by_user_idTousers?.full_name,
        receivedBy: p.users_payments_received_by_user_idTousers?.full_name,
      })),
      sourceCharges: {
        meal: invoice.meal_student_charges.map((c) => ({
          id: c.id.toString(),
          announcement: c.meal_payment_announcements?.title,
          amount: c.amount.toString(),
        })),
        dorm: invoice.dorm_student_charges.map((c) => ({
          id: c.id.toString(),
          announcement: c.dorm_payment_announcements?.title,
          amount: c.amount.toString(),
        })),
      },
    };
  }

  // ==================== PAYMENTS ====================

  async createPayment(
    tenantId: string,
    staffUserId: string,
    dto: CreatePaymentDto,
    ipAddress?: string,
  ) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const staff_user_id = toBigInt(staffUserId, 'staffUserId');
    const invoice_id = toBigInt(dto.invoiceId, 'invoiceId');

    if (dto.paidAmount < 0) {
      throw new BadRequestException('PAID_AMOUNT_MUST_BE_POSITIVE');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Check invoice exists
      const invoice = await tx.invoices.findFirst({
        where: {
          id: invoice_id,
          tenant_id,
        },
        select: {
          id: true,
          student_id: true,
          amount: true,
          status: true,
          students: {
            select: { full_name: true },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('INVOICE_NOT_FOUND');
      }

      if (invoice.status === 'PAID') {
        throw new BadRequestException('INVOICE_ALREADY_PAID');
      }

      if (invoice.status === 'CANCELLED') {
        throw new BadRequestException('INVOICE_CANCELLED');
      }

      // 2. Create payment
      const payment = await tx.payments.create({
        data: {
          tenant_id,
          invoice_id,
          source: dto.source ?? 'MANUAL',
          paid_amount: new Prisma.Decimal(dto.paidAmount),
          method: dto.method ?? 'CASH',
          reference: dto.reference?.trim() || null,
          created_by_user_id: staff_user_id,
          received_by_user_id: staff_user_id,
        },
        select: {
          id: true,
          paid_amount: true,
        },
      });

      // 3. Calculate total paid
      const totalPaidAgg = await tx.payments.aggregate({
        where: {
          invoice_id,
        },
        _sum: {
          paid_amount: true,
        },
      });

      const totalPaid = totalPaidAgg._sum.paid_amount ?? new Prisma.Decimal(0);
      const isFullyPaid = totalPaid.gte(invoice.amount);

      // 4. Update invoice status
      if (isFullyPaid && invoice.status !== 'PAID') {
        await tx.invoices.update({
          where: { id: invoice_id },
          data: { status: 'PAID' },
        });

        // Update related charges
        await tx.meal_student_charges.updateMany({
          where: { tenant_id, invoice_id },
          data: { status: 'PAID' },
        });

        await tx.dorm_student_charges.updateMany({
          where: { tenant_id, invoice_id },
          data: { status: 'PAID' },
        });
      }

      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: staff_user_id,
        action: 'PAYMENT',
        entityType: 'payments',
        entityId: payment.id,
        afterData: {
          id: payment.id.toString(),
          invoiceId: invoice_id.toString(),
          studentId: invoice.student_id.toString(),
          studentName: invoice.students.full_name,
          paidAmount: payment.paid_amount.toString(),
          method: dto.method ?? 'CASH',
          source: dto.source ?? 'MANUAL',
        },
        ipAddress,
      });

      return {
        ok: true,
        paymentId: payment.id.toString(),
        paidAmount: payment.paid_amount.toString(),
        totalPaid: totalPaid.toString(),
        invoiceStatus: isFullyPaid ? 'PAID' : 'PENDING',
      };
    });
  }

  async listPayments(tenantId: string, q: ListPaymentsQueryDto) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.paymentsWhereInput = {
      tenant_id,
    };

    if (q.invoiceId) {
      where.invoice_id = toBigInt(q.invoiceId, 'invoiceId');
    }

    if (q.studentId) {
      where.invoices = {
        student_id: toBigInt(q.studentId, 'studentId'),
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.payments.count({ where }),
      this.prisma.payments.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
        include: {
          invoices: {
            select: {
              id: true,
              student_id: true,
              type: true,
              amount: true,
              students: {
                select: { full_name: true },
              },
            },
          },
          users_payments_created_by_user_idTousers: {
            select: { full_name: true },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        invoiceId: item.invoice_id.toString(),
        invoiceType: item.invoices.type,
        studentId: item.invoices.student_id.toString(),
        studentName: item.invoices.students.full_name,
        paidAmount: item.paid_amount.toString(),
        paidAt: item.paid_at,
        method: item.method,
        source: item.source,
        reference: item.reference,
        createdBy: item.users_payments_created_by_user_idTousers?.full_name,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== GUARDIAN ENDPOINTS ====================

  async guardianInvoices(tenantId: string, studentAccountId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const student_account_id = toBigInt(studentAccountId, 'studentAccountId');

    const account = await this.prisma.student_accounts.findFirst({
      where: {
        id: student_account_id,
        tenant_id,
      },
      select: {
        student_id: true,
        students: {
          select: { full_name: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');
    }

    const invoices = await this.prisma.invoices.findMany({
      where: {
        tenant_id,
        student_id: account.student_id,
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: {
        payments: {
          select: {
            id: true,
            paid_amount: true,
            paid_at: true,
            method: true,
          },
        },
      },
    });

    const summary = invoices.reduce(
      (acc, inv) => {
        const paid = inv.payments.reduce(
          (sum, p) => sum.add(p.paid_amount),
          new Prisma.Decimal(0),
        );
        const remaining = inv.amount.sub(paid);

        acc.totalAmount = acc.totalAmount.add(inv.amount);
        acc.totalPaid = acc.totalPaid.add(paid);
        acc.totalRemaining = acc.totalRemaining.add(remaining);

        if (inv.status === 'PENDING') {
          acc.pendingCount += 1;
          acc.pendingAmount = acc.pendingAmount.add(remaining);
        }

        return acc;
      },
      {
        totalAmount: new Prisma.Decimal(0),
        totalPaid: new Prisma.Decimal(0),
        totalRemaining: new Prisma.Decimal(0),
        pendingCount: 0,
        pendingAmount: new Prisma.Decimal(0),
      },
    );

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
      },
      summary: {
        totalInvoices: invoices.length,
        totalAmount: summary.totalAmount.toString(),
        totalPaid: summary.totalPaid.toString(),
        totalRemaining: summary.totalRemaining.toString(),
        pendingInvoices: summary.pendingCount,
        pendingAmount: summary.pendingAmount.toString(),
      },
      invoices: invoices.map((inv) => {
        const paid = inv.payments.reduce(
          (sum, p) => sum.add(p.paid_amount),
          new Prisma.Decimal(0),
        );
        const remaining = inv.amount.sub(paid);
        const isOverdue =
          inv.due_date &&
          inv.status === 'PENDING' &&
          new Date(inv.due_date) < new Date();

        return {
          id: inv.id.toString(),
          type: inv.type,
          amount: inv.amount.toString(),
          currency: inv.currency,
          status: isOverdue ? 'OVERDUE' : inv.status,
          periodStart: inv.period_start ? toISODate(inv.period_start) : null,
          periodEnd: inv.period_end ? toISODate(inv.period_end) : null,
          dueDate: inv.due_date ? toISODate(inv.due_date) : null,
          createdAt: inv.created_at,
          paidAmount: paid.toString(),
          remainingAmount: remaining.toString(),
          payments: inv.payments.map((p) => ({
            id: p.id.toString(),
            paidAmount: p.paid_amount.toString(),
            paidAt: p.paid_at,
            method: p.method,
          })),
        };
      }),
    };
  }

  async guardianPayments(tenantId: string, studentAccountId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const student_account_id = toBigInt(studentAccountId, 'studentAccountId');

    const account = await this.prisma.student_accounts.findFirst({
      where: {
        id: student_account_id,
        tenant_id,
      },
      select: {
        student_id: true,
      },
    });

    if (!account) {
      throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');
    }

    const payments = await this.prisma.payments.findMany({
      where: {
        tenant_id,
        invoices: {
          student_id: account.student_id,
        },
      },
      orderBy: [{ paid_at: 'desc' }, { id: 'desc' }],
      include: {
        invoices: {
          select: {
            id: true,
            type: true,
            amount: true,
          },
        },
      },
      take: 100,
    });

    return {
      payments: payments.map((p) => ({
        id: p.id.toString(),
        invoiceId: p.invoice_id.toString(),
        invoiceType: p.invoices.type,
        invoiceAmount: p.invoices.amount.toString(),
        paidAmount: p.paid_amount.toString(),
        paidAt: p.paid_at,
        method: p.method,
        source: p.source,
        reference: p.reference,
      })),
    };
  }
}
