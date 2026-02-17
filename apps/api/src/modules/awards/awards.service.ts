// apps/api/src/modules/awards/awards.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateAwardDto } from './dto/create-award.dto';
import { SetAwardRecipientsDto } from './dto/set-recipients.dto';
import { AwardListQueryDto } from './dto/award-list.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class AwardsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateAwardDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const issued_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // Validate award type
      if (
        !['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'].includes(
          args.dto.awardType,
        )
      ) {
        throw new BadRequestException('INVALID_AWARD_TYPE');
      }

      // Parse value amount if provided
      let value_amount: Prisma.Decimal | null = null;
      if (args.dto.valueAmount) {
        try {
          value_amount = new Prisma.Decimal(args.dto.valueAmount);
          if (value_amount.isNegative()) {
            throw new Error('Negative value');
          }
        } catch {
          throw new BadRequestException('INVALID_VALUE_AMOUNT');
        }
      }

      // Parse issued date
      const issued_at = args.dto.issuedAt
        ? new Date(args.dto.issuedAt)
        : new Date();

      if (isNaN(issued_at.getTime())) {
        throw new BadRequestException('INVALID_ISSUED_AT');
      }

      // Create award
      const award = await tx.awards.create({
        data: {
          tenant_id,
          award_type: args.dto.awardType,
          title: args.dto.title.trim(),
          description: args.dto.description?.trim() || null,
          value_amount,
          issued_at,
          issued_by_user_id,
        },
        include: {
          users: {
            select: {
              id: true,
              full_name: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: issued_by_user_id,
        action: 'CREATE',
        entityType: 'awards',
        entityId: award.id,
        afterData: {
          id: award.id.toString(),
          title: award.title,
          type: award.award_type,
          issuedAt: award.issued_at,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: award.id.toString(),
        awardType: award.award_type,
        title: award.title,
        issuedAt: award.issued_at,
        issuedBy: award.users
          ? {
              id: award.users.id.toString(),
              name: award.users.full_name,
            }
          : null,
      };
    });
  }

  async list(args: { tenantId: string; query: AwardListQueryDto }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.awardsWhereInput = {
      tenant_id,
    };

    if (args.query.awardType) {
      where.award_type = args.query.awardType;
    }

    if (args.query.from || args.query.to) {
      where.issued_at = {};
      if (args.query.from) {
        where.issued_at.gte = new Date(args.query.from);
      }
      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        where.issued_at.lte = toDate;
      }
    }

    if (args.query.q) {
      const search = args.query.q.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.awards.count({ where }),
      this.prisma.awards.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ issued_at: 'desc' }, { id: 'desc' }],
        include: {
          users: {
            select: {
              id: true,
              full_name: true,
            },
          },
          _count: {
            select: {
              award_recipients: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        awardType: item.award_type,
        title: item.title,
        description: item.description,
        valueAmount: item.value_amount?.toString() || null,
        issuedAt: item.issued_at,
        issuedBy: item.users
          ? {
              id: item.users.id.toString(),
              name: item.users.full_name,
            }
          : null,
        recipientsCount: item._count.award_recipients,
        // ✅ created_at ni olib tashladim (modelda yo'q)
      })),
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

  async getDetail(args: { tenantId: string; awardId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const award_id = toBigInt(args.awardId, 'awardId');

    const award = await this.prisma.awards.findFirst({
      where: {
        id: award_id,
        tenant_id,
      },
      include: {
        users: {
          select: {
            id: true,
            full_name: true,
          },
        },
        award_recipients: {
          include: {
            students: {
              select: {
                id: true,
                full_name: true,
              },
            },
            groups: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!award) {
      throw new NotFoundException('AWARD_NOT_FOUND');
    }

    return {
      id: award.id.toString(),
      awardType: award.award_type,
      title: award.title,
      description: award.description,
      valueAmount: award.value_amount?.toString() || null,
      issuedAt: award.issued_at,
      issuedBy: award.users
        ? {
            id: award.users.id.toString(),
            name: award.users.full_name,
          }
        : null,
      recipients: award.award_recipients.map((r) => ({
        recipientType: r.recipient_type,
        studentId: r.student_id?.toString() || null,
        studentName: r.students?.full_name || null,
        groupId: r.group_id?.toString() || null,
        groupName: r.groups?.name || null,
        note: r.note,
      })),
    };
  }

  async setRecipients(args: {
    tenantId: string;
    awardId: string;
    actorUserId: string;
    dto: SetAwardRecipientsDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const award_id = toBigInt(args.awardId, 'awardId');
    const actor_user_id = args.actorUserId
      ? toBigInt(args.actorUserId, 'actorUserId')
      : null;

    // Validate at least one recipient
    if (!args.dto.studentIds?.length && !args.dto.groupIds?.length) {
      throw new BadRequestException('AT_LEAST_ONE_RECIPIENT_REQUIRED');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Award exists?
      const award = await tx.awards.findFirst({
        where: {
          id: award_id,
          tenant_id,
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (!award) {
        throw new NotFoundException('AWARD_NOT_FOUND');
      }

      // 2. Delete existing recipients
      await tx.award_recipients.deleteMany({
        where: { award_id },
      });

      let added = 0;

      // 3. Add student recipients
      if (args.dto.studentIds?.length) {
        const studentIds = args.dto.studentIds.map((id) =>
          toBigInt(id, 'studentId'),
        );

        // Get students with their current group
        const students = await tx.students.findMany({
          where: {
            tenant_id,
            id: { in: studentIds },
            archived_at: null,
            status: 'ACTIVE',
          },
          select: {
            id: true,
            current_group_id: true,
          },
        });

        for (const student of students) {
          if (!student.current_group_id) continue; // Skip students without group

          // ✅ create natijasini o'zgaruvchiga saqlamaymiz
          await tx.award_recipients.create({
            data: {
              award_id,
              recipient_type: 'STUDENT',
              student_id: student.id,
              group_id: student.current_group_id,
              note: args.dto.note?.trim() || null,
            },
          });
          added++;
        }
      }

      // 4. Add group recipients
      if (args.dto.groupIds?.length) {
        const groupIds = args.dto.groupIds.map((id) => toBigInt(id, 'groupId'));

        // Get groups and their students
        const groups = await tx.groups.findMany({
          where: {
            tenant_id,
            id: { in: groupIds },
          },
          select: {
            id: true,
            students: {
              where: {
                archived_at: null,
                status: 'ACTIVE',
              },
              select: {
                id: true,
              },
            },
          },
        });

        for (const group of groups) {
          for (const student of group.students) {
            // ✅ create natijasini o'zgaruvchiga saqlamaymiz
            await tx.award_recipients.create({
              data: {
                award_id,
                recipient_type: 'GROUP',
                student_id: student.id,
                group_id: group.id,
                note: args.dto.note?.trim() || null,
              },
            });
            added++;
          }
        }
      }
      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'UPDATE',
        entityType: 'award_recipients',
        entityId: award_id,
        afterData: {
          awardId: award_id.toString(),
          awardTitle: award.title,
          recipientsCount: added,
          note: args.dto.note,
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        added,
        recipientsCount: added,
      };
    });
  }

  async guardianList(args: { studentAccountId: string }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );

    // Get student info
    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: {
          select: {
            full_name: true,
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    // Get awards for this student
    const awards = await this.prisma.award_recipients.findMany({
      where: {
        student_id: account.student_id,
        awards: {
          tenant_id: account.tenant_id,
        },
      },
      orderBy: {
        awards: {
          issued_at: 'desc',
        },
      },
      include: {
        awards: {
          include: {
            users: {
              select: {
                full_name: true,
              },
            },
          },
        },
        groups: {
          select: {
            name: true,
          },
        },
      },
    });

    // Group by award type
    const byType = {
      GIFT: { count: 0, total: 0 },
      STIPEND: { count: 0, total: 0 },
      CERTIFICATE: { count: 0, total: 0 },
      BADGE: { count: 0, total: 0 },
    };

    awards.forEach((award) => {
      const type = award.awards.award_type as keyof typeof byType;
      byType[type].count += 1;

      if (award.awards.value_amount) {
        byType[type].total += Number(award.awards.value_amount);
      }
    });

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
      },
      summary: {
        total: awards.length,
        byType,
      },
      awards: awards.map((a) => ({
        id: a.awards.id.toString(),
        awardType: a.awards.award_type,
        title: a.awards.title,
        description: a.awards.description,
        valueAmount: a.awards.value_amount?.toString() || null,
        issuedAt: a.awards.issued_at,
        issuedBy: a.awards.users?.full_name || null,
        recipientType: a.recipient_type,
        groupName: a.groups?.name || null,
        note: a.note,
      })),
    };
  }

  async getStatistics(args: { tenantId: string; from?: string; to?: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');

    const where: Prisma.awardsWhereInput = {
      tenant_id,
    };

    if (args.from || args.to) {
      where.issued_at = {};
      if (args.from) {
        where.issued_at.gte = new Date(args.from);
      }
      if (args.to) {
        const toDate = new Date(args.to);
        toDate.setHours(23, 59, 59, 999);
        where.issued_at.lte = toDate;
      }
    }

    // Count by award type
    const typeCounts = await this.prisma.awards.groupBy({
      by: ['award_type'],
      where,
      _count: { award_type: true },
    });

    // Total monetary value by type
    const valueByType = await this.prisma.awards.groupBy({
      by: ['award_type'],
      where: {
        ...where,
        award_type: 'STIPEND',
        value_amount: { not: null },
      },
      _sum: { value_amount: true },
    });

    // Top issuers
    const topIssuers = await this.prisma.awards.groupBy({
      by: ['issued_by_user_id'],
      where,
      _count: { issued_by_user_id: true },
      orderBy: { _count: { issued_by_user_id: 'desc' } },
      take: 5,
    });

    const issuerIds = topIssuers
      .map((i) => i.issued_by_user_id)
      .filter((id): id is bigint => id !== null);

    const issuers = issuerIds.length
      ? await this.prisma.users.findMany({
          where: { id: { in: issuerIds } },
          select: { id: true, full_name: true },
        })
      : [];

    const issuerMap = new Map(
      issuers.map((i) => [i.id.toString(), i.full_name]),
    );

    return {
      totalAwards: await this.prisma.awards.count({ where }),
      byType: typeCounts.reduce(
        (acc, curr) => {
          acc[curr.award_type] = curr._count.award_type;
          return acc;
        },
        {} as Record<string, number>,
      ),
      totalValue: valueByType[0]?._sum.value_amount?.toString() || '0',
      topIssuers: topIssuers.map((i, index) => ({
        rank: index + 1,
        userId: i.issued_by_user_id?.toString(),
        name: issuerMap.get(i.issued_by_user_id?.toString() || '') || 'Unknown',
        count: i._count.issued_by_user_id,
      })),
    };
  }
}
