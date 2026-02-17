// apps/api/src/modules/competitions/competitions.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CompetitionListQueryDto } from './dto/competition-list.query.dto';
import { SetCompetitionEntriesDto } from './dto/set-entries.dto';
import { SetCompetitionResultsDto } from './dto/set-results.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class CompetitionsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== COMPETITIONS CRUD ====================

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateCompetitionDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const created_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    // Validate dates
    const starts_at = new Date(args.dto.startsAt);
    if (isNaN(starts_at.getTime())) {
      throw new BadRequestException('INVALID_STARTS_AT');
    }

    let ends_at: Date | null = null;
    if (args.dto.endsAt) {
      ends_at = new Date(args.dto.endsAt);
      if (isNaN(ends_at.getTime())) {
        throw new BadRequestException('INVALID_ENDS_AT');
      }
      if (ends_at <= starts_at) {
        throw new BadRequestException('ENDS_AT_MUST_BE_AFTER_STARTS_AT');
      }
    }

    const competition = await this.prisma.competitions.create({
      data: {
        tenant_id,
        title: args.dto.title.trim(),
        mode: args.dto.mode,
        starts_at,
        ends_at,
        rules: args.dto.rules?.trim() || null,
      },
      select: {
        id: true,
        title: true,
        mode: true,
        starts_at: true,
        ends_at: true,
        rules: true,
        created_at: true,
      },
    });

    await this.auditLogger.log({
      tenantId: tenant_id,
      actorType: 'STAFF',
      actorUserId: created_by_user_id,
      action: 'CREATE',
      entityType: 'competitions',
      entityId: competition.id,
      afterData: {
        id: competition.id.toString(),
        title: competition.title,
        mode: competition.mode,
        startsAt: competition.starts_at,
      },
      ipAddress: args.ipAddress,
    });

    return {
      id: competition.id.toString(),
      title: competition.title,
      mode: competition.mode,
      startsAt: competition.starts_at,
      endsAt: competition.ends_at,
      rules: competition.rules,
      createdAt: competition.created_at,
    };
  }

  async list(args: { tenantId: string; query: CompetitionListQueryDto }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.competitionsWhereInput = {
      tenant_id,
    };

    if (args.query.mode) {
      where.mode = args.query.mode;
    }

    if (args.query.from || args.query.to) {
      where.starts_at = {};
      if (args.query.from) {
        where.starts_at.gte = new Date(args.query.from);
      }
      if (args.query.to) {
        where.starts_at.lte = new Date(args.query.to);
      }
    }

    if (args.query.q) {
      const search = args.query.q.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { rules: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.competitionsOrderByWithRelationInput = {};
    if (args.query.sortBy === 'startsAt') {
      orderBy.starts_at = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'createdAt') {
      orderBy.created_at = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'title') {
      orderBy.title = args.query.sortDir ?? 'desc';
    } else {
      orderBy.starts_at = 'desc';
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.competitions.count({ where }),
      this.prisma.competitions.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              competition_entries: true,
              competition_results: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        title: item.title,
        mode: item.mode,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        rules: item.rules,
        createdAt: item.created_at,
        entriesCount: item._count.competition_entries,
        resultsCount: item._count.competition_results,
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

  async getDetail(args: { tenantId: string; competitionId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');

    const competition = await this.prisma.competitions.findFirst({
      where: { id: competition_id, tenant_id },
      include: {
        _count: {
          select: {
            competition_entries: true,
            competition_results: true,
          },
        },
        competition_entries: {
          include: {
            students: { select: { id: true, full_name: true } },
            groups: { select: { id: true, name: true } },
          },
          orderBy: { id: 'asc' },
        },
        competition_results: {
          include: {
            competition_entries: {
              select: { name_display: true, entry_type: true },
            },
          },
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!competition) {
      throw new NotFoundException('COMPETITION_NOT_FOUND');
    }

    return {
      id: competition.id.toString(),
      title: competition.title,
      mode: competition.mode,
      startsAt: competition.starts_at,
      endsAt: competition.ends_at,
      rules: competition.rules,
      createdAt: competition.created_at,
      entriesCount: competition._count.competition_entries,
      resultsCount: competition._count.competition_results,
      entries: competition.competition_entries.map((e) => ({
        id: e.id.toString(),
        entryType: e.entry_type,
        nameDisplay: e.name_display,
        studentId: e.student_id?.toString() || null,
        studentName: e.students?.full_name || null,
        groupId: e.group_id?.toString() || null,
        groupName: e.groups?.name || null,
        createdAt: e.created_at,
      })),
      results: competition.competition_results.map((r) => ({
        entryId: r.entry_id.toString(),
        entryName: r.competition_entries.name_display,
        entryType: r.competition_entries.entry_type,
        rank: r.rank,
        score: r.score?.toString() || null,
        prize: r.prize,
      })),
    };
  }

  async update(args: {
    tenantId: string;
    competitionId: string;
    userId: string;
    dto: UpdateCompetitionDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');
    const updated_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.competitions.findFirst({
        where: { id: competition_id, tenant_id },
      });
      if (!existing) throw new NotFoundException('COMPETITION_NOT_FOUND');

      const updateData: Prisma.competitionsUpdateInput = {};

      if (args.dto.title !== undefined) {
        updateData.title = args.dto.title.trim();
      }
      if (args.dto.mode !== undefined) {
        updateData.mode = args.dto.mode;
      }
      if (args.dto.startsAt !== undefined) {
        const starts_at = new Date(args.dto.startsAt);
        if (isNaN(starts_at.getTime())) {
          throw new BadRequestException('INVALID_STARTS_AT');
        }
        updateData.starts_at = starts_at;
      }
      if (args.dto.endsAt !== undefined) {
        if (args.dto.endsAt === null || args.dto.endsAt === '') {
          updateData.ends_at = null;
        } else {
          const ends_at = new Date(args.dto.endsAt);
          if (isNaN(ends_at.getTime())) {
            throw new BadRequestException('INVALID_ENDS_AT');
          }
          updateData.ends_at = ends_at;
        }
      }
      if (args.dto.rules !== undefined) {
        updateData.rules = args.dto.rules?.trim() || null;
      }

      // Validate date order if both are being set
      if (updateData.starts_at && updateData.ends_at) {
        if (updateData.ends_at <= updateData.starts_at) {
          throw new BadRequestException('ENDS_AT_MUST_BE_AFTER_STARTS_AT');
        }
      } else if (updateData.starts_at && existing.ends_at) {
        if (existing.ends_at <= updateData.starts_at) {
          throw new BadRequestException('ENDS_AT_MUST_BE_AFTER_STARTS_AT');
        }
      } else if (updateData.ends_at && existing.starts_at) {
        if (updateData.ends_at <= existing.starts_at) {
          throw new BadRequestException('ENDS_AT_MUST_BE_AFTER_STARTS_AT');
        }
      }

      const updated = await tx.competitions.update({
        where: { id: competition_id },
        data: updateData,
        select: {
          id: true,
          title: true,
          mode: true,
          starts_at: true,
          ends_at: true,
          rules: true,
          created_at: true,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'competitions',
        entityId: competition_id,
        beforeData: {
          id: existing.id.toString(),
          title: existing.title,
          startsAt: existing.starts_at,
        },
        afterData: {
          id: updated.id.toString(),
          title: updated.title,
          startsAt: updated.starts_at,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        title: updated.title,
        mode: updated.mode,
        startsAt: updated.starts_at,
        endsAt: updated.ends_at,
        rules: updated.rules,
        createdAt: updated.created_at,
      };
    });
  }

  async remove(args: {
    tenantId: string;
    competitionId: string;
    userId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');
    const deleted_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      const competition = await tx.competitions.findFirst({
        where: { id: competition_id, tenant_id },
        select: { id: true, title: true },
      });
      if (!competition) throw new NotFoundException('COMPETITION_NOT_FOUND');

      // Check for dependencies? We can cascade delete entries/results via Prisma schema.
      // If we want to prevent deletion if there are entries, we can check.
      const entriesCount = await tx.competition_entries.count({
        where: { competition_id },
      });

      if (entriesCount > 0) {
        throw new BadRequestException('COMPETITION_HAS_ENTRIES');
      }

      await tx.competitions.delete({ where: { id: competition_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'competitions',
        entityId: competition_id,
        beforeData: {
          id: competition.id.toString(),
          title: competition.title,
        },
        ipAddress: args.ipAddress,
      });

      return { ok: true, id: competition_id.toString() };
    });
  }

  // ==================== ENTRIES ====================

  async setEntries(args: {
    tenantId: string;
    competitionId: string;
    userId: string;
    dto: SetCompetitionEntriesDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');
    const created_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Competition exists
      const competition = await tx.competitions.findFirst({
        where: { id: competition_id, tenant_id },
        select: { id: true, title: true },
      });
      if (!competition) throw new NotFoundException('COMPETITION_NOT_FOUND');

      // 2. Delete existing entries
      await tx.competition_entries.deleteMany({
        where: { competition_id },
      });

      // 3. Prepare and validate entries
      const entries = args.dto.entries;
      const createData: Prisma.competition_entriesCreateManyInput[] = [];

      for (const entry of entries) {
        const entryType = entry.entryType;
        let studentId: bigint | null = null;
        let groupId: bigint | null = null;
        let nameDisplay = entry.nameDisplay?.trim() || '';

        if (entryType === 'STUDENT') {
          if (!entry.studentId)
            throw new BadRequestException('STUDENT_ID_REQUIRED');
          studentId = toBigInt(entry.studentId, 'studentId');

          const student = await tx.students.findFirst({
            where: { id: studentId, tenant_id, archived_at: null },
            select: { full_name: true, current_group_id: true },
          });
          if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

          if (!nameDisplay) nameDisplay = student.full_name;
          groupId = student.current_group_id;
        } else if (entryType === 'GROUP') {
          if (!entry.groupId)
            throw new BadRequestException('GROUP_ID_REQUIRED');
          groupId = toBigInt(entry.groupId, 'groupId');

          const group = await tx.groups.findFirst({
            where: { id: groupId, tenant_id },
            select: { name: true },
          });
          if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

          if (!nameDisplay) nameDisplay = group.name;
        } else {
          // TEAM or DORM
          if (!nameDisplay)
            throw new BadRequestException('NAME_DISPLAY_REQUIRED');
        }

        createData.push({
          competition_id,
          entry_type: entryType,
          student_id: studentId,
          group_id: groupId,
          name_display: nameDisplay,
        });
      }

      // 4. Bulk create
      if (createData.length > 0) {
        await tx.competition_entries.createMany({
          data: createData,
          skipDuplicates: true,
        });
      }

      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'UPDATE',
        entityType: 'competition_entries',
        entityId: competition_id,
        afterData: {
          competitionId: competition_id.toString(),
          competitionTitle: competition.title,
          entriesCount: createData.length,
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        competitionId: competition_id.toString(),
        entriesCount: createData.length,
      };
    });
  }

  async getEntries(args: { tenantId: string; competitionId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');

    const competition = await this.prisma.competitions.findFirst({
      where: { id: competition_id, tenant_id },
      select: { id: true },
    });
    if (!competition) throw new NotFoundException('COMPETITION_NOT_FOUND');

    const entries = await this.prisma.competition_entries.findMany({
      where: { competition_id },
      include: {
        students: { select: { id: true, full_name: true } },
        groups: { select: { id: true, name: true } },
        _count: { select: { competition_results: true } },
      },
      orderBy: [{ entry_type: 'asc' }, { id: 'asc' }],
    });

    return {
      competitionId: competition_id.toString(),
      entries: entries.map((e) => ({
        id: e.id.toString(),
        entryType: e.entry_type,
        nameDisplay: e.name_display,
        studentId: e.student_id?.toString() || null,
        studentName: e.students?.full_name || null,
        groupId: e.group_id?.toString() || null,
        groupName: e.groups?.name || null,
        createdAt: e.created_at,
        hasResult: e._count.competition_results > 0,
      })),
    };
  }

  // ==================== RESULTS ====================

  async setResults(args: {
    tenantId: string;
    competitionId: string;
    userId: string;
    dto: SetCompetitionResultsDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');
    const created_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Competition exists
      const competition = await tx.competitions.findFirst({
        where: { id: competition_id, tenant_id },
        select: { id: true, title: true },
      });
      if (!competition) throw new NotFoundException('COMPETITION_NOT_FOUND');

      const results = args.dto.results;

      // ✅ Tipni aniq belgilash
      const operations: Promise<any>[] = [];

      for (const result of results) {
        const entry_id = toBigInt(result.entryId, 'entryId');

        // Verify entry belongs to this competition and tenant
        const entry = await tx.competition_entries.findFirst({
          where: {
            id: entry_id,
            competition_id,
            competitions: { tenant_id },
          },
          select: { id: true },
        });
        if (!entry)
          throw new NotFoundException(`ENTRY_NOT_FOUND: ${result.entryId}`);

        const score = result.score ? new Prisma.Decimal(result.score) : null;

        operations.push(
          tx.competition_results.upsert({
            where: {
              competition_id_entry_id: {
                competition_id,
                entry_id,
              },
            },
            update: {
              rank: result.rank,
              score,
              prize: result.prize?.trim() || null,
            },
            create: {
              competition_id,
              entry_id,
              rank: result.rank,
              score,
              prize: result.prize?.trim() || null,
            },
          }),
        );
      }

      await Promise.all(operations);

      // 3. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'UPDATE',
        entityType: 'competition_results',
        entityId: competition_id,
        afterData: {
          competitionId: competition_id.toString(),
          competitionTitle: competition.title,
          resultsCount: results.length,
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        competitionId: competition_id.toString(),
        resultsCount: results.length,
      };
    });
  }

  async getResults(args: { tenantId: string; competitionId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const competition_id = toBigInt(args.competitionId, 'competitionId');

    const competition = await this.prisma.competitions.findFirst({
      where: { id: competition_id, tenant_id },
      select: { id: true },
    });
    if (!competition) throw new NotFoundException('COMPETITION_NOT_FOUND');

    const results = await this.prisma.competition_results.findMany({
      where: { competition_id },
      include: {
        competition_entries: {
          select: {
            name_display: true,
            entry_type: true,
            students: { select: { full_name: true } },
            groups: { select: { name: true } },
          },
        },
      },
      orderBy: [{ rank: 'asc' }, { entry_id: 'asc' }],
    });

    return {
      competitionId: competition_id.toString(),
      results: results.map((r) => ({
        entryId: r.entry_id.toString(),
        entryName: r.competition_entries.name_display,
        entryType: r.competition_entries.entry_type,
        studentName: r.competition_entries.students?.full_name || null,
        groupName: r.competition_entries.groups?.name || null,
        rank: r.rank,
        score: r.score?.toString() || null,
        prize: r.prize,
      })),
    };
  }

  // ==================== GUARDIAN ====================

  async guardianList(args: {
    studentAccountId: string;
    from?: string;
    to?: string;
  }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );

    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: {
          select: {
            current_group_id: true,
          },
        },
      },
    });
    if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

    const studentId = account.student_id;
    const tenantId = account.tenant_id;
    const groupId = account.students?.current_group_id;

    const where: Prisma.competitionsWhereInput = {
      tenant_id: tenantId,
      competition_entries: {
        some: {
          OR: [
            { entry_type: 'STUDENT', student_id: studentId },
            ...(groupId ? [{ entry_type: 'GROUP', group_id: groupId }] : []),
          ],
        },
      },
    };

    if (args.from || args.to) {
      where.starts_at = {};
      if (args.from) where.starts_at.gte = new Date(args.from);
      if (args.to) where.starts_at.lte = new Date(args.to);
    }

    const competitions = await this.prisma.competitions.findMany({
      where,
      orderBy: [{ starts_at: 'desc' }, { id: 'desc' }],
      include: {
        competition_entries: {
          where: {
            OR: [
              { entry_type: 'STUDENT', student_id: studentId },
              ...(groupId ? [{ entry_type: 'GROUP', group_id: groupId }] : []),
            ],
          },
          include: {
            competition_results: {
              select: {
                rank: true,
                score: true,
                prize: true,
              },
            },
          },
        },
      },
    });

    return {
      studentId: studentId.toString(),
      competitions: competitions.map((c) => ({
        id: c.id.toString(),
        title: c.title,
        mode: c.mode,
        startsAt: c.starts_at,
        endsAt: c.ends_at,
        entries: c.competition_entries.map((e) => ({
          entryId: e.id.toString(),
          entryType: e.entry_type,
          nameDisplay: e.name_display,
          result: e.competition_results[0] || null,
        })),
      })),
    };
  }

  async guardianResult(args: {
    studentAccountId: string;
    competitionId: string;
  }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );
    const competition_id = toBigInt(args.competitionId, 'competitionId');

    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: {
          select: {
            current_group_id: true,
          },
        },
      },
    });
    if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

    const studentId = account.student_id;
    const tenantId = account.tenant_id;
    const groupId = account.students?.current_group_id;

    // Try to find student entry first
    let entry = await this.prisma.competition_entries.findFirst({
      where: {
        competition_id,
        competitions: { tenant_id: tenantId },
        entry_type: 'STUDENT',
        student_id: studentId,
      },
      include: {
        competition_results: true,
      },
    });

    if (!entry && groupId) {
      entry = await this.prisma.competition_entries.findFirst({
        where: {
          competition_id,
          competitions: { tenant_id: tenantId },
          entry_type: 'GROUP',
          group_id: groupId,
        },
        include: {
          competition_results: true,
        },
      });
    }

    if (!entry) {
      return { data: null };
    }

    return {
      data: {
        entryId: entry.id.toString(),
        entryType: entry.entry_type,
        nameDisplay: entry.name_display,
        result: entry.competition_results[0] || null,
      },
    };
  }
}
