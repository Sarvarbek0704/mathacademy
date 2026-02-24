// apps/api/src/modules/events/events.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';
import { EventListQueryDto } from './dto/event-list.query.dto';
import { GuardianEventQueryDto } from './dto/guardian-event.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class EventsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== EVENTS ====================

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateEventDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        // Validate campus if provided
        let campus_id: bigint | null = null;
        if (args.dto.campusId) {
          campus_id = toBigInt(args.dto.campusId, 'campusId');
          const campus = await tx.campuses.findFirst({
            where: { id: campus_id, tenant_id },
          });
          if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
        }

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

        const event = await tx.events.create({
          data: {
            tenant_id,
            campus_id,
            title: args.dto.title.trim(),
            event_type: args.dto.eventType ?? 'OTHER',
            starts_at,
            ends_at,
            description: args.dto.description?.trim() || null,
            created_by_user_id,
          },
          include: {
            campuses: true,
            users: {
              select: { full_name: true },
            },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'events',
          entityId: event.id,
          afterData: {
            id: event.id.toString(),
            title: event.title,
            startsAt: event.starts_at,
            campus: event.campuses?.name || null,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: event.id.toString(),
          title: event.title,
          eventType: event.event_type,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          campusId: event.campus_id?.toString() || null,
          campusName: event.campuses?.name || null,
          description: event.description,
          createdBy: event.users?.full_name || null,
          createdAt: event.created_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async list(args: { tenantId: string; query: EventListQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.eventsWhereInput = {
        tenant_id,
      };

      if (args.query.campusId) {
        where.campus_id = toBigInt(args.query.campusId, 'campusId');
      }

      if (args.query.eventType) {
        where.event_type = args.query.eventType;
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
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const orderBy: Prisma.eventsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'startsAt') {
        orderBy.starts_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'createdAt') {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'title') {
        orderBy.title = args.query.sortDir ?? 'desc';
      } else {
        orderBy.starts_at = 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.events.count({ where }),
        this.prisma.events.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            campuses: true,
            users: { select: { full_name: true } },
            _count: {
              select: { event_participants: true },
            },
          },
        }),
      ]);

      return {
        data: items.map((e) => ({
          id: e.id.toString(),
          title: e.title,
          eventType: e.event_type,
          startsAt: e.starts_at,
          endsAt: e.ends_at,
          campusId: e.campus_id?.toString() || null,
          campusName: e.campuses?.name || null,
          description: e.description,
          createdBy: e.users?.full_name || null,
          createdAt: e.created_at,
          participantsCount: e._count.event_participants,
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
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getDetail(args: { tenantId: string; eventId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');

      const event = await this.prisma.events.findFirst({
        where: { id: event_id, tenant_id },
        include: {
          campuses: true,
          users: { select: { full_name: true } },
          event_participants: {
            include: {
              students: {
                select: {
                  id: true,
                  full_name: true,
                  current_group_id: true,
                  groups: { select: { name: true } },
                },
              },
            },
            orderBy: { student_id: 'asc' },
          },
          _count: {
            select: { event_participants: true },
          },
        },
      });

      if (!event) {
        throw new NotFoundException('EVENT_NOT_FOUND');
      }

      return {
        id: event.id.toString(),
        title: event.title,
        eventType: event.event_type,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        campusId: event.campus_id?.toString() || null,
        campusName: event.campuses?.name || null,
        description: event.description,
        createdBy: event.users?.full_name || null,
        createdAt: event.created_at,
        participantsCount: event._count.event_participants,
        participants: event.event_participants.map((p) => ({
          studentId: p.student_id.toString(),
          studentName: p.students.full_name,
          groupId: p.students.current_group_id?.toString() || null,
          groupName: p.students.groups?.name || null,
          role: p.role,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async update(args: {
    tenantId: string;
    eventId: string;
    userId: string;
    dto: UpdateEventDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.events.findFirst({
          where: { id: event_id, tenant_id },
          include: { campuses: true },
        });
        if (!existing) throw new NotFoundException('EVENT_NOT_FOUND');

        const updateData: Prisma.eventsUpdateInput = {};

        if (args.dto.title !== undefined) {
          updateData.title = args.dto.title.trim();
        }
        if (args.dto.campusId !== undefined) {
          if (args.dto.campusId) {
            const campus_id = toBigInt(args.dto.campusId, 'campusId');
            const campus = await tx.campuses.findFirst({
              where: { id: campus_id, tenant_id },
            });
            if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
            updateData.campuses = { connect: { id: campus_id } };
          } else {
            updateData.campuses = { disconnect: true };
          }
        }
        if (args.dto.eventType !== undefined) {
          updateData.event_type = args.dto.eventType;
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
        if (args.dto.description !== undefined) {
          updateData.description = args.dto.description?.trim() || null;
        }

        // Validate date order
        const newStartsAt = updateData.starts_at ?? existing.starts_at;
        const newEndsAt =
          updateData.ends_at !== undefined
            ? updateData.ends_at
            : existing.ends_at;
        if (newEndsAt && newEndsAt <= newStartsAt) {
          throw new BadRequestException('ENDS_AT_MUST_BE_AFTER_STARTS_AT');
        }

        const updated = await tx.events.update({
          where: { id: event_id },
          data: updateData,
          include: {
            campuses: true,
            users: { select: { full_name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'events',
          entityId: event_id,
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
          eventType: updated.event_type,
          startsAt: updated.starts_at,
          endsAt: updated.ends_at,
          campusId: updated.campus_id?.toString() || null,
          campusName: updated.campuses?.name || null,
          description: updated.description,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async delete(args: {
    tenantId: string;
    eventId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.events.findFirst({
          where: { id: event_id, tenant_id },
        });
        if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

        // Check if event has participants? We can cascade delete via Prisma schema.
        // Optionally prevent deletion if participants exist.
        const participantsCount = await tx.event_participants.count({
          where: { event_id },
        });
        if (participantsCount > 0) {
          throw new BadRequestException('EVENT_HAS_PARTICIPANTS');
        }

        await tx.events.delete({ where: { id: event_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'events',
          entityId: event_id,
          beforeData: {
            id: event.id.toString(),
            title: event.title,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: event_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== PARTICIPANTS ====================

  async setParticipants(args: {
    tenantId: string;
    eventId: string;
    userId: string;
    dto: SetParticipantsDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        // 1. Event exists
        const event = await tx.events.findFirst({
          where: { id: event_id, tenant_id },
        });
        if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

        // 2. If groupId provided, validate group
        let group_id: bigint | null = null;
        if (args.dto.groupId) {
          group_id = toBigInt(args.dto.groupId, 'groupId');
          const group = await tx.groups.findFirst({
            where: { id: group_id, tenant_id },
          });
          if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
        }

        // 3. Validate student IDs and filter by tenant and optionally group
        const studentIds = args.dto.studentIds.map((id) =>
          toBigInt(id, 'studentId'),
        );
        const studentWhere: Prisma.studentsWhereInput = {
          tenant_id,
          id: { in: studentIds },
          archived_at: null,
        };
        if (group_id) {
          studentWhere.current_group_id = group_id;
        }

        const validStudents = await tx.students.findMany({
          where: studentWhere,
          select: { id: true },
        });

        if (validStudents.length === 0) {
          throw new BadRequestException('NO_VALID_STUDENTS');
        }

        // 4. Replace participants
        await tx.event_participants.deleteMany({
          where: { event_id },
        });

        const role = args.dto.role?.trim() || 'PARTICIPANT';
        await tx.event_participants.createMany({
          data: validStudents.map((s) => ({
            event_id,
            student_id: s.id,
            role,
          })),
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'UPDATE',
          entityType: 'event_participants',
          entityId: event_id,
          afterData: {
            eventId: event_id.toString(),
            eventTitle: event.title,
            participantsCount: validStudents.length,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          added: validStudents.length,
          eventId: event_id.toString(),
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getParticipants(args: { tenantId: string; eventId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');

      const event = await this.prisma.events.findFirst({
        where: { id: event_id, tenant_id },
      });
      if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

      const participants = await this.prisma.event_participants.findMany({
        where: { event_id },
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              current_group_id: true,
              groups: { select: { name: true } },
            },
          },
        },
        orderBy: { student_id: 'asc' },
      });

      return {
        eventId: event_id.toString(),
        participants: participants.map((p) => ({
          studentId: p.student_id.toString(),
          studentName: p.students.full_name,
          groupId: p.students.current_group_id?.toString() || null,
          groupName: p.students.groups?.name || null,
          role: p.role,
        })),
        count: participants.length,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async addParticipants(args: {
    tenantId: string;
    eventId: string;
    userId: string;
    dto: SetParticipantsDto; // reuse same DTO, but will add to existing participants
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.events.findFirst({
          where: { id: event_id, tenant_id },
        });
        if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

        let group_id: bigint | null = null;
        if (args.dto.groupId) {
          group_id = toBigInt(args.dto.groupId, 'groupId');
          const group = await tx.groups.findFirst({
            where: { id: group_id, tenant_id },
          });
          if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
        }

        const studentIds = args.dto.studentIds.map((id) =>
          toBigInt(id, 'studentId'),
        );
        const studentWhere: Prisma.studentsWhereInput = {
          tenant_id,
          id: { in: studentIds },
          archived_at: null,
        };
        if (group_id) {
          studentWhere.current_group_id = group_id;
        }

        const validStudents = await tx.students.findMany({
          where: studentWhere,
          select: { id: true },
        });

        if (validStudents.length === 0) {
          throw new BadRequestException('NO_VALID_STUDENTS');
        }

        const role = args.dto.role?.trim() || 'PARTICIPANT';

        // Get existing participants to avoid duplicates
        const existingParticipants = await tx.event_participants.findMany({
          where: { event_id },
          select: { student_id: true },
        });
        const existingStudentIds = new Set(
          existingParticipants.map((ep) => ep.student_id.toString()),
        );

        const newParticipants = validStudents.filter(
          (s) => !existingStudentIds.has(s.id.toString()),
        );

        if (newParticipants.length > 0) {
          await tx.event_participants.createMany({
            data: newParticipants.map((s) => ({
              event_id,
              student_id: s.id,
              role,
            })),
          });
        }

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'UPDATE',
          entityType: 'event_participants',
          entityId: event_id,
          afterData: {
            eventId: event_id.toString(),
            eventTitle: event.title,
            addedCount: newParticipants.length,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          added: newParticipants.length,
          total: existingParticipants.length + newParticipants.length,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async removeParticipants(args: {
    tenantId: string;
    eventId: string;
    userId: string;
    studentIds: string[];
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const event_id = toBigInt(args.eventId, 'eventId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.events.findFirst({
          where: { id: event_id, tenant_id },
        });
        if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

        const studentIds = args.studentIds.map((id) =>
          toBigInt(id, 'studentId'),
        );

        const result = await tx.event_participants.deleteMany({
          where: {
            event_id,
            student_id: { in: studentIds },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'UPDATE',
          entityType: 'event_participants',
          entityId: event_id,
          afterData: {
            eventId: event_id.toString(),
            removedCount: result.count,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          removed: result.count,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== GUARDIAN ====================

  // apps/api/src/modules/events/events.service.ts - guardianList metodining to'g'ri versiyasi

  // apps/api/src/modules/events/events.service.ts - guardianList metodining to'g'ri versiyasi

  async guardianList(args: {
    studentAccountId: string;
    query: GuardianEventQueryDto;
  }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        select: {
          student_id: true,
          tenant_id: true,
          students: { select: { full_name: true } },
        },
      });
      if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

      const studentId = account.student_id;
      const tenantId = account.tenant_id;

      const where: Prisma.event_participantsWhereInput = {
        student_id: studentId,
        events: {
          tenant_id: tenantId,
        },
      };

      if (args.query.from || args.query.to) {
        const eventsWhere: Prisma.eventsWhereInput = {
          tenant_id: tenantId,
          starts_at: {}, // ✅ TypeScript bu yerda DateTimeFilter deb tushunadi
        };

        if (args.query.from) {
          // ✅ `as Prisma.DateTimeFilter` cast qilish kerak
          (eventsWhere.starts_at as Prisma.DateTimeFilter).gte = new Date(
            args.query.from,
          );
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          (eventsWhere.starts_at as Prisma.DateTimeFilter).lte = toDate;
        }

        where.events = eventsWhere;
      }

      const events = await this.prisma.event_participants.findMany({
        where,
        orderBy: { events: { starts_at: 'desc' } },
        include: {
          events: {
            include: {
              campuses: { select: { name: true } },
            },
          },
        },
        take: 200,
      });

      return {
        student: {
          id: studentId.toString(),
          fullName: account.students.full_name,
        },
        events: events.map((ep) => ({
          id: ep.events.id.toString(),
          title: ep.events.title,
          eventType: ep.events.event_type,
          startsAt: ep.events.starts_at,
          endsAt: ep.events.ends_at,
          campusId: ep.events.campus_id?.toString() || null,
          campusName: ep.events.campuses?.name || null,
          description: ep.events.description,
          role: ep.role,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getEventSummary(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const now = new Date();
    const endOfWeek = new Date();
    endOfWeek.setDate(now.getDate() + 7);

    const activeCount = await this.prisma.events.count({
      where: {
        tenant_id,
        starts_at: { lte: endOfWeek },
        OR: [{ ends_at: { gte: now } }, { ends_at: null }],
      },
    });

    return { activeCount };
  }

  async getUpcomingEvents(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const now = new Date();

    const events = await this.prisma.events.findMany({
      where: {
        tenant_id,
        starts_at: { gte: now },
      },
      orderBy: { starts_at: 'asc' },
      take: 5,
      include: {
        campuses: { select: { name: true } },
      },
    });

    return events.map((e) => ({
      id: e.id.toString(),
      title: e.title,
      startAt: e.starts_at,
      location: e.campuses?.name || null,
    }));
  }
}
