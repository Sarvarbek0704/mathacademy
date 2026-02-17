// apps/api/src/modules/leaves/leaves.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveDecisionDto } from './dto/decision.dto';
import { LeaveListQueryDto } from './dto/leave-list.query.dto';
import { GuardianLeaveQueryDto } from './dto/guardian-leave.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class LeavesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== CREATE ====================

  async create(args: {
    tenantId: string;
    userId: string;
    dto: CreateLeaveDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const student_id = toBigInt(args.dto.studentId, 'studentId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        // 1. Student exists and belongs to tenant
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id, archived_at: null },
          select: { id: true, full_name: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // 2. Validate dates
        const start_at = new Date(args.dto.startAt);
        const end_at = new Date(args.dto.endAt);
        if (isNaN(start_at.getTime()) || isNaN(end_at.getTime())) {
          throw new BadRequestException('INVALID_DATE');
        }
        if (end_at <= start_at) {
          throw new BadRequestException('END_AT_MUST_BE_AFTER_START_AT');
        }

        // 3. Check for overlapping leave requests (optional)
        const overlapping = await tx.leave_requests.count({
          where: {
            tenant_id,
            student_id,
            status: { in: ['PENDING', 'APPROVED'] },
            OR: [
              {
                start_at: { lt: end_at },
                end_at: { gt: start_at },
              },
            ],
          },
        });
        if (overlapping > 0) {
          throw new BadRequestException('OVERLAPPING_LEAVE_REQUEST_EXISTS');
        }

        // 4. Create leave request
        const leave = await tx.leave_requests.create({
          data: {
            tenant_id,
            student_id,
            requested_by: args.dto.requestedBy ?? 'STUDENT_VERBAL',
            reason: args.dto.reason.trim(),
            start_at,
            end_at,
            status: 'PENDING',
            notes: args.dto.notes?.trim() || null,
          },
          include: {
            students: { select: { full_name: true } },
          },
        });

        // 5. Audit log
        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'leave_requests',
          entityId: leave.id,
          afterData: {
            id: leave.id.toString(),
            studentId: student_id.toString(),
            studentName: student.full_name,
            startAt: leave.start_at,
            endAt: leave.end_at,
            status: leave.status,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: leave.id.toString(),
          studentId: leave.student_id.toString(),
          studentName: leave.students.full_name,
          reason: leave.reason,
          startAt: leave.start_at,
          endAt: leave.end_at,
          status: leave.status,
          createdAt: leave.created_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== LIST ====================

  async list(args: { tenantId: string; query: LeaveListQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.leave_requestsWhereInput = {
        tenant_id,
      };

      if (args.query.studentId) {
        where.student_id = toBigInt(args.query.studentId, 'studentId');
      }

      if (args.query.groupId) {
        where.students = {
          current_group_id: toBigInt(args.query.groupId, 'groupId'),
        };
      }

      if (args.query.status) {
        where.status = args.query.status;
      }

      if (args.query.from || args.query.to) {
        where.OR = [
          {
            start_at: {},
          },
          {
            end_at: {},
          },
        ];
        if (args.query.from) {
          (where.OR[0].start_at as Prisma.DateTimeFilter).gte = new Date(
            args.query.from,
          );
          (where.OR[1].end_at as Prisma.DateTimeFilter).gte = new Date(
            args.query.from,
          );
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          (where.OR[0].start_at as Prisma.DateTimeFilter).lte = toDate;
          (where.OR[1].end_at as Prisma.DateTimeFilter).lte = toDate;
        }
      }

      const orderBy: Prisma.leave_requestsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'startAt') {
        orderBy.start_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'status') {
        orderBy.status = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.leave_requests.count({ where }),
        this.prisma.leave_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            students: {
              select: {
                id: true,
                full_name: true,
                current_group_id: true,
                groups: { select: { name: true } },
              },
            },
            users: { select: { id: true, full_name: true } },
          },
        }),
      ]);

      return {
        data: items.map((l) => ({
          id: l.id.toString(),
          studentId: l.student_id.toString(),
          studentName: l.students.full_name,
          groupId: l.students.current_group_id?.toString() || null,
          groupName: l.students.groups?.name || null,
          requestedBy: l.requested_by,
          reason: l.reason,
          startAt: l.start_at,
          endAt: l.end_at,
          status: l.status,
          notes: l.notes,
          approvedBy: l.users
            ? {
                id: l.users.id.toString(),
                name: l.users.full_name,
              }
            : null,
          approvedAt: l.approved_at,
          closedAt: l.closed_at,
          createdAt: l.created_at,
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

  // ==================== GET DETAIL ====================

  async getDetail(args: { tenantId: string; leaveId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const leave_id = toBigInt(args.leaveId, 'leaveId');

      const leave = await this.prisma.leave_requests.findFirst({
        where: { id: leave_id, tenant_id },
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              current_group_id: true,
              groups: { select: { name: true } },
            },
          },
          users: { select: { id: true, full_name: true } },
        },
      });

      if (!leave) {
        throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');
      }

      return {
        id: leave.id.toString(),
        studentId: leave.student_id.toString(),
        studentName: leave.students.full_name,
        groupId: leave.students.current_group_id?.toString() || null,
        groupName: leave.students.groups?.name || null,
        requestedBy: leave.requested_by,
        reason: leave.reason,
        startAt: leave.start_at,
        endAt: leave.end_at,
        status: leave.status,
        notes: leave.notes,
        approvedBy: leave.users
          ? {
              id: leave.users.id.toString(),
              name: leave.users.full_name,
            }
          : null,
        approvedAt: leave.approved_at,
        closedAt: leave.closed_at,
        createdAt: leave.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== UPDATE ====================

  async update(args: {
    tenantId: string;
    leaveId: string;
    userId: string;
    dto: UpdateLeaveDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const leave_id = toBigInt(args.leaveId, 'leaveId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.leave_requests.findFirst({
          where: { id: leave_id, tenant_id },
          include: { students: { select: { full_name: true } } },
        });
        if (!existing) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');

        // Only pending requests can be edited
        if (existing.status !== 'PENDING') {
          throw new BadRequestException('CANNOT_EDIT_NON_PENDING_LEAVE');
        }

        const updateData: Prisma.leave_requestsUpdateInput = {};

        if (args.dto.reason !== undefined) {
          updateData.reason = args.dto.reason.trim();
        }
        if (args.dto.requestedBy !== undefined) {
          updateData.requested_by = args.dto.requestedBy;
        }
        if (args.dto.startAt !== undefined) {
          const start_at = new Date(args.dto.startAt);
          if (isNaN(start_at.getTime()))
            throw new BadRequestException('INVALID_START_AT');
          updateData.start_at = start_at;
        }
        if (args.dto.endAt !== undefined) {
          const end_at = new Date(args.dto.endAt);
          if (isNaN(end_at.getTime()))
            throw new BadRequestException('INVALID_END_AT');
          updateData.end_at = end_at;
        }
        if (args.dto.notes !== undefined) {
          updateData.notes = args.dto.notes?.trim() || null;
        }

        // Validate date order
        const newStartAt = updateData.start_at ?? existing.start_at;
        const newEndAt = updateData.end_at ?? existing.end_at;
        if (newEndAt <= newStartAt) {
          throw new BadRequestException('END_AT_MUST_BE_AFTER_START_AT');
        }

        // Check for overlapping (skip if dates unchanged)
        if (
          updateData.start_at !== undefined ||
          updateData.end_at !== undefined
        ) {
          const overlapping = await tx.leave_requests.count({
            where: {
              tenant_id,
              student_id: existing.student_id,
              id: { not: leave_id },
              status: { in: ['PENDING', 'APPROVED'] },
              OR: [
                {
                  // ✅ `as Prisma.DateTimeFilter` cast qilish
                  start_at: { lt: newEndAt as Date } as Prisma.DateTimeFilter,
                  end_at: { gt: newStartAt as Date } as Prisma.DateTimeFilter,
                },
              ],
            },
          });
          if (overlapping > 0) {
            throw new BadRequestException('OVERLAPPING_LEAVE_REQUEST_EXISTS');
          }
        }

        const updated = await tx.leave_requests.update({
          where: { id: leave_id },
          data: updateData,
          include: {
            students: { select: { full_name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'leave_requests',
          entityId: leave_id,
          beforeData: {
            id: existing.id.toString(),
            reason: existing.reason,
            startAt: existing.start_at,
            endAt: existing.end_at,
          },
          afterData: {
            id: updated.id.toString(),
            reason: updated.reason,
            startAt: updated.start_at,
            endAt: updated.end_at,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          studentId: updated.student_id.toString(),
          studentName: updated.students.full_name,
          reason: updated.reason,
          startAt: updated.start_at,
          endAt: updated.end_at,
          status: updated.status,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== DELETE ====================

  async delete(args: {
    tenantId: string;
    leaveId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const leave_id = toBigInt(args.leaveId, 'leaveId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const leave = await tx.leave_requests.findFirst({
          where: { id: leave_id, tenant_id },
        });
        if (!leave) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');

        // Only pending requests can be deleted
        if (leave.status !== 'PENDING') {
          throw new BadRequestException('CANNOT_DELETE_NON_PENDING_LEAVE');
        }

        await tx.leave_requests.delete({ where: { id: leave_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'leave_requests',
          entityId: leave_id,
          beforeData: {
            id: leave.id.toString(),
            reason: leave.reason,
            status: leave.status,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: leave_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== DECISION MAKING ====================

  private async setDecision(args: {
    tenantId: string;
    userId: string;
    leaveId: string;
    status: 'APPROVED' | 'REJECTED' | 'CLOSED';
    notes?: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const leave_id = toBigInt(args.leaveId, 'leaveId');
      const user_id = toBigInt(args.userId, 'userId');

      return await this.prisma.$transaction(async (tx) => {
        const leave = await tx.leave_requests.findFirst({
          where: { id: leave_id, tenant_id },
          include: { students: { select: { full_name: true } } },
        });
        if (!leave) throw new NotFoundException('LEAVE_REQUEST_NOT_FOUND');

        // State transition validation
        if (leave.status === 'CLOSED') {
          throw new BadRequestException('LEAVE_ALREADY_CLOSED');
        }
        if (args.status === 'APPROVED' && leave.status !== 'PENDING') {
          throw new BadRequestException('ONLY_PENDING_LEAVES_CAN_BE_APPROVED');
        }
        if (args.status === 'REJECTED' && leave.status !== 'PENDING') {
          throw new BadRequestException('ONLY_PENDING_LEAVES_CAN_BE_REJECTED');
        }
        if (args.status === 'CLOSED' && leave.status !== 'APPROVED') {
          throw new BadRequestException('ONLY_APPROVED_LEAVES_CAN_BE_CLOSED');
        }

        // ✅ To‘g‘ri update: data obyekti to‘g‘ridan-to‘g‘ri yoziladi
        const updated = await tx.leave_requests.update({
          where: { id: leave_id },
          data: {
            status: args.status,
            notes: args.notes?.trim() ?? leave.notes,
            ...(args.status === 'APPROVED' || args.status === 'REJECTED'
              ? {
                  approved_by_user_id: user_id,
                  approved_at: new Date(),
                }
              : {}),
            ...(args.status === 'CLOSED'
              ? {
                  closed_at: new Date(),
                }
              : {}),
          },
          include: { students: { select: { full_name: true } } },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: user_id,
          action: 'UPDATE',
          entityType: 'leave_requests',
          entityId: leave_id,
          beforeData: {
            id: leave.id.toString(),
            status: leave.status,
          },
          afterData: {
            id: updated.id.toString(),
            status: updated.status,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          id: updated.id.toString(),
          status: updated.status,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async approve(args: {
    tenantId: string;
    userId: string;
    leaveId: string;
    dto: LeaveDecisionDto;
    ipAddress?: string;
  }) {
    return this.setDecision({
      ...args,
      leaveId: args.leaveId,
      status: 'APPROVED',
      notes: args.dto.notes,
    });
  }

  async reject(args: {
    tenantId: string;
    userId: string;
    leaveId: string;
    dto: LeaveDecisionDto;
    ipAddress?: string;
  }) {
    return this.setDecision({
      ...args,
      leaveId: args.leaveId,
      status: 'REJECTED',
      notes: args.dto.notes,
    });
  }

  async close(args: {
    tenantId: string;
    userId: string;
    leaveId: string;
    dto: LeaveDecisionDto;
    ipAddress?: string;
  }) {
    return this.setDecision({
      ...args,
      leaveId: args.leaveId,
      status: 'CLOSED',
      notes: args.dto.notes,
    });
  }

  // ==================== GUARDIAN ====================

  async guardianList(args: {
    studentAccountId: string;
    query: GuardianLeaveQueryDto;
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
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.leave_requestsWhereInput = {
        tenant_id: tenantId,
        student_id: studentId,
      };

      if (args.query.status) {
        where.status = args.query.status;
      }

      if (args.query.from || args.query.to) {
        where.OR = [{ start_at: {} }, { end_at: {} }];
        if (args.query.from) {
          (where.OR[0].start_at as Prisma.DateTimeFilter).gte = new Date(
            args.query.from,
          );
          (where.OR[1].end_at as Prisma.DateTimeFilter).gte = new Date(
            args.query.from,
          );
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          (where.OR[0].start_at as Prisma.DateTimeFilter).lte = toDate;
          (where.OR[1].end_at as Prisma.DateTimeFilter).lte = toDate;
        }
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.leave_requests.count({ where }),
        this.prisma.leave_requests.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' }, // ✅ to‘g‘ri
          include: {
            users: { select: { full_name: true } },
          },
        }),
      ]);

      return {
        student: {
          id: studentId.toString(),
          fullName: account.students.full_name,
        },
        leaves: items.map((l) => ({
          id: l.id.toString(),
          requestedBy: l.requested_by,
          reason: l.reason,
          startAt: l.start_at,
          endAt: l.end_at,
          status: l.status,
          notes: l.notes,
          approvedBy: l.users?.full_name || null,
          approvedAt: l.approved_at,
          closedAt: l.closed_at,
          createdAt: l.created_at,
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
}
