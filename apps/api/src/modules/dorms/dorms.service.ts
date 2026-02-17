import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateDormDto } from './dto/create-dorm.dto';
import { UpdateDormDto } from './dto/update-dorm.dto';
import { CreateDormRoomDto } from './dto/create-dorm-room.dto';
import { UpdateDormRoomDto } from './dto/update-dorm-room.dto';
import { AssignRoomDto } from './dto/assign-room.dto';
import { ListDormsQueryDto } from './dto/list-dorms.query.dto';
import { ListRoomsQueryDto } from './dto/list-rooms.query.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

@Injectable()
export class DormsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ---------- Dorms ----------

  async createDorm(args: {
    tenantId: string;
    userId: string;
    dto: CreateDormDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      let campus_id: bigint | null = null;
      if (args.dto.campusId) {
        campus_id = toBigInt(args.dto.campusId, 'campusId');
        const campus = await this.prisma.campuses.findFirst({
          where: { id: campus_id, tenant_id },
        });
        if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
      }

      const dorm = await this.prisma.dorms.create({
        data: {
          tenant_id,
          campus_id,
          name: args.dto.name.trim(),
          description: args.dto.description?.trim() || null,
          is_active: args.dto.isActive ?? true,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'dorms',
        entityId: dorm.id,
        afterData: { id: dorm.id.toString(), name: dorm.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: dorm.id.toString(),
        name: dorm.name,
        campusId: dorm.campus_id?.toString() || null,
        description: dorm.description,
        isActive: dorm.is_active,
        createdAt: dorm.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listDorms(args: { tenantId: string; query: ListDormsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.dormsWhereInput = { tenant_id };
      if (args.query.campusId) {
        where.campus_id = toBigInt(args.query.campusId, 'campusId');
      }
      if (args.query.isActive !== undefined) {
        where.is_active = args.query.isActive;
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.dorms.count({ where }),
        this.prisma.dorms.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            campuses: { select: { name: true } },
            _count: { select: { dorm_rooms: true } },
          },
        }),
      ]);

      return {
        data: items.map((d) => ({
          id: d.id.toString(),
          name: d.name,
          campusId: d.campus_id?.toString() || null,
          campusName: d.campuses?.name || null,
          description: d.description,
          isActive: d.is_active,
          roomsCount: d._count.dorm_rooms,
          createdAt: d.created_at,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getDorm(args: { tenantId: string; dormId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');

      const dorm = await this.prisma.dorms.findFirst({
        where: { id: dorm_id, tenant_id },
        include: {
          campuses: true,
          dorm_rooms: {
            orderBy: { room_code: 'asc' },
            include: {
              _count: {
                select: {
                  student_room_assignments: {
                    where: {
                      OR: [
                        { end_date: null },
                        { end_date: { gte: new Date() } },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!dorm) throw new NotFoundException('DORM_NOT_FOUND');

      return {
        id: dorm.id.toString(),
        name: dorm.name,
        campusId: dorm.campus_id?.toString() || null,
        campusName: dorm.campuses?.name || null,
        description: dorm.description,
        isActive: dorm.is_active,
        createdAt: dorm.created_at,
        rooms: dorm.dorm_rooms.map((r) => ({
          id: r.id.toString(),
          roomCode: r.room_code,
          capacity: r.capacity,
          genderPolicy: r.gender_policy,
          currentOccupancy: r._count.student_room_assignments,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateDorm(args: {
    tenantId: string;
    dormId: string;
    userId: string;
    dto: UpdateDormDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const dorm = await this.prisma.dorms.findFirst({
        where: { id: dorm_id, tenant_id },
      });
      if (!dorm) throw new NotFoundException('DORM_NOT_FOUND');

      const updateData: Prisma.dormsUpdateInput = {};
      if (args.dto.name) updateData.name = args.dto.name.trim();
      if (args.dto.campusId !== undefined) {
        if (args.dto.campusId) {
          const campus_id = toBigInt(args.dto.campusId, 'campusId');
          const campus = await this.prisma.campuses.findFirst({
            where: { id: campus_id, tenant_id },
          });
          if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
          updateData.campuses = { connect: { id: campus_id } };
        } else {
          updateData.campuses = { disconnect: true };
        }
      }
      if (args.dto.description !== undefined) {
        updateData.description = args.dto.description?.trim() || null;
      }
      if (args.dto.isActive !== undefined) {
        updateData.is_active = args.dto.isActive;
      }

      const updated = await this.prisma.dorms.update({
        where: { id: dorm_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'dorms',
        entityId: dorm_id,
        beforeData: { id: dorm.id.toString(), name: dorm.name },
        afterData: { id: updated.id.toString(), name: updated.name },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        name: updated.name,
        campusId: updated.campus_id?.toString() || null,
        description: updated.description,
        isActive: updated.is_active,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteDorm(args: {
    tenantId: string;
    dormId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const dorm = await this.prisma.dorms.findFirst({
        where: { id: dorm_id, tenant_id },
        include: { _count: { select: { dorm_rooms: true } } },
      });
      if (!dorm) throw new NotFoundException('DORM_NOT_FOUND');

      if (dorm._count.dorm_rooms > 0) {
        throw new BadRequestException('DORM_HAS_ROOMS');
      }

      await this.prisma.dorms.delete({ where: { id: dorm_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'dorms',
        entityId: dorm_id,
        beforeData: { id: dorm.id.toString(), name: dorm.name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Rooms ----------

  async createRoom(args: {
    tenantId: string;
    dormId: string;
    userId: string;
    dto: CreateDormRoomDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const dorm = await this.prisma.dorms.findFirst({
        where: { id: dorm_id, tenant_id },
      });
      if (!dorm) throw new NotFoundException('DORM_NOT_FOUND');

      const existing = await this.prisma.dorm_rooms.findFirst({
        where: { dorm_id, room_code: args.dto.roomCode },
      });
      if (existing) throw new BadRequestException('ROOM_CODE_ALREADY_EXISTS');

      const room = await this.prisma.dorm_rooms.create({
        data: {
          dorm_id,
          room_code: args.dto.roomCode,
          capacity: args.dto.capacity,
          gender_policy: args.dto.genderPolicy,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'dorm_rooms',
        entityId: room.id,
        afterData: {
          id: room.id.toString(),
          roomCode: room.room_code,
          dormId: dorm_id.toString(),
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: room.id.toString(),
        roomCode: room.room_code,
        capacity: room.capacity,
        genderPolicy: room.gender_policy,
        dormId: dorm_id.toString(),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listRooms(args: {
    tenantId: string;
    dormId: string;
    query: ListRoomsQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const dorm = await this.prisma.dorms.findFirst({
        where: { id: dorm_id, tenant_id },
      });
      if (!dorm) throw new NotFoundException('DORM_NOT_FOUND');

      const where: Prisma.dorm_roomsWhereInput = { dorm_id };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.dorm_rooms.count({ where }),
        this.prisma.dorm_rooms.findMany({
          where,
          skip,
          take: limit,
          orderBy: { room_code: 'asc' },
          include: {
            student_room_assignments: {
              where: {
                OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
              },
              select: { student_id: true },
            },
          },
        }),
      ]);

      let data = items.map((r) => ({
        id: r.id.toString(),
        roomCode: r.room_code,
        capacity: r.capacity,
        genderPolicy: r.gender_policy,
        currentOccupancy: r.student_room_assignments.length,
      }));

      if (args.query.availableOnly) {
        data = data.filter((r) => r.currentOccupancy < r.capacity);
      }

      return {
        data,
        meta: {
          page,
          limit,
          total: data.length,
          totalPages: Math.ceil(data.length / limit),
        }, // total after filter is approximated
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getRoom(args: { tenantId: string; dormId: string; roomId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const room_id = toBigInt(args.roomId, 'roomId');

      const room = await this.prisma.dorm_rooms.findFirst({
        where: { id: room_id, dorm_id, dorms: { tenant_id } },
        include: {
          student_room_assignments: {
            where: {
              OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
            },
            include: { students: { select: { full_name: true } } },
          },
        },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

      return {
        id: room.id.toString(),
        roomCode: room.room_code,
        capacity: room.capacity,
        genderPolicy: room.gender_policy,
        currentOccupants: room.student_room_assignments.map((a) => ({
          studentId: a.student_id.toString(),
          studentName: a.students.full_name,
          assignmentId: a.id.toString(),
          startDate: a.start_date,
          note: a.note,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateRoom(args: {
    tenantId: string;
    dormId: string;
    roomId: string;
    userId: string;
    dto: UpdateDormRoomDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const room_id = toBigInt(args.roomId, 'roomId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const room = await this.prisma.dorm_rooms.findFirst({
        where: { id: room_id, dorm_id, dorms: { tenant_id } },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

      if (args.dto.roomCode && args.dto.roomCode !== room.room_code) {
        const existing = await this.prisma.dorm_rooms.findFirst({
          where: { dorm_id, room_code: args.dto.roomCode },
        });
        if (existing) throw new BadRequestException('ROOM_CODE_ALREADY_EXISTS');
      }

      const updateData: Prisma.dorm_roomsUpdateInput = {};
      if (args.dto.roomCode) updateData.room_code = args.dto.roomCode;
      if (args.dto.capacity !== undefined)
        updateData.capacity = args.dto.capacity;
      if (args.dto.genderPolicy !== undefined)
        updateData.gender_policy = args.dto.genderPolicy;

      const updated = await this.prisma.dorm_rooms.update({
        where: { id: room_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'dorm_rooms',
        entityId: room_id,
        beforeData: { id: room.id.toString(), roomCode: room.room_code },
        afterData: { id: updated.id.toString(), roomCode: updated.room_code },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        roomCode: updated.room_code,
        capacity: updated.capacity,
        genderPolicy: updated.gender_policy,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteRoom(args: {
    tenantId: string;
    dormId: string;
    roomId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dorm_id = toBigInt(args.dormId, 'dormId');
      const room_id = toBigInt(args.roomId, 'roomId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const room = await this.prisma.dorm_rooms.findFirst({
        where: { id: room_id, dorm_id, dorms: { tenant_id } },
        include: { _count: { select: { student_room_assignments: true } } },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

      if (room._count.student_room_assignments > 0) {
        throw new BadRequestException('ROOM_HAS_ASSIGNMENTS');
      }

      await this.prisma.dorm_rooms.delete({ where: { id: room_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'dorm_rooms',
        entityId: room_id,
        beforeData: { id: room.id.toString(), roomCode: room.room_code },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Assignments ----------

  async assignRoom(args: {
    tenantId: string;
    roomId: string;
    userId: string;
    dto: AssignRoomDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const room_id = toBigInt(args.roomId, 'roomId');
      const assigned_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const room = await this.prisma.dorm_rooms.findFirst({
        where: { id: room_id, dorms: { tenant_id } },
        include: { dorms: true },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

      const student_id = toBigInt(args.dto.studentId, 'studentId');
      const student = await this.prisma.students.findFirst({
        where: { id: student_id, tenant_id, archived_at: null },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      // Check if student already has an active assignment (end_date null or future)
      const active = await this.prisma.student_room_assignments.findFirst({
        where: {
          student_id,
          OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
        },
      });
      if (active) {
        // End previous assignment
        await this.prisma.student_room_assignments.updateMany({
          where: { id: active.id },
          data: { end_date: new Date() },
        });
      }

      const start_date = args.dto.startDate
        ? new Date(args.dto.startDate)
        : new Date();
      const end_date = args.dto.endDate ? new Date(args.dto.endDate) : null;

      const assignment = await this.prisma.student_room_assignments.create({
        data: {
          tenant_id,
          student_id,
          room_id,
          start_date,
          end_date,
          assigned_by_user_id,
          note: args.dto.note?.trim() || null,
        },
        include: {
          students: { select: { full_name: true } },
          dorm_rooms: { select: { room_code: true } },
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: assigned_by_user_id,
        action: 'CREATE',
        entityType: 'student_room_assignments',
        entityId: assignment.id,
        afterData: {
          id: assignment.id.toString(),
          studentId: student_id.toString(),
          studentName: assignment.students.full_name,
          roomId: room_id.toString(),
          roomCode: assignment.dorm_rooms.room_code,
          startDate: assignment.start_date,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: assignment.id.toString(),
        studentId: student_id.toString(),
        studentName: assignment.students.full_name,
        roomId: room_id.toString(),
        roomCode: assignment.dorm_rooms.room_code,
        startDate: assignment.start_date,
        endDate: assignment.end_date,
        note: assignment.note,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async endAssignment(args: {
    tenantId: string;
    roomId: string;
    assignmentId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const room_id = toBigInt(args.roomId, 'roomId');
      const assignment_id = toBigInt(args.assignmentId, 'assignmentId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const assignment = await this.prisma.student_room_assignments.findFirst({
        where: { id: assignment_id, room_id, tenant_id },
        include: { students: { select: { full_name: true } } },
      });
      if (!assignment) throw new NotFoundException('ASSIGNMENT_NOT_FOUND');
      if (assignment.end_date && assignment.end_date < new Date()) {
        throw new BadRequestException('ASSIGNMENT_ALREADY_ENDED');
      }

      const updated = await this.prisma.student_room_assignments.update({
        where: { id: assignment_id },
        data: { end_date: new Date() },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'student_room_assignments',
        entityId: assignment_id,
        beforeData: {
          id: assignment.id.toString(),
          endDate: assignment.end_date,
        },
        afterData: { id: updated.id.toString(), endDate: updated.end_date },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listAssignments(args: {
    tenantId: string;
    roomId: string;
    query: ListAssignmentsQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const room_id = toBigInt(args.roomId, 'roomId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const room = await this.prisma.dorm_rooms.findFirst({
        where: { id: room_id, dorms: { tenant_id } },
      });
      if (!room) throw new NotFoundException('ROOM_NOT_FOUND');

      const where: Prisma.student_room_assignmentsWhereInput = {
        tenant_id,
        room_id,
      };
      if (args.query.studentId) {
        where.student_id = toBigInt(args.query.studentId, 'studentId');
      }
      if (args.query.currentOnly) {
        where.OR = [{ end_date: null }, { end_date: { gte: new Date() } }];
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.student_room_assignments.count({ where }),
        this.prisma.student_room_assignments.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ start_date: 'desc' }, { id: 'desc' }],
          include: {
            students: { select: { full_name: true } },
            users: { select: { full_name: true } },
          },
        }),
      ]);

      return {
        data: items.map((a) => ({
          id: a.id.toString(),
          studentId: a.student_id.toString(),
          studentName: a.students.full_name,
          startDate: a.start_date,
          endDate: a.end_date,
          assignedBy: a.users?.full_name || null,
          note: a.note,
        })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Guardian ----------

  async guardianDorm(args: { studentAccountId: string }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: { students: true },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');

      const studentId = account.students.id;
      const tenantId = account.students.tenant_id;

      const currentAssignment =
        await this.prisma.student_room_assignments.findFirst({
          where: {
            student_id: studentId,
            tenant_id: tenantId,
            OR: [{ end_date: null }, { end_date: { gte: new Date() } }],
          },
          include: {
            dorm_rooms: {
              include: { dorms: { select: { name: true } } },
            },
          },
        });

      if (!currentAssignment) {
        return { hasRoom: false };
      }

      return {
        hasRoom: true,
        assignment: {
          id: currentAssignment.id.toString(),
          startDate: currentAssignment.start_date,
          note: currentAssignment.note,
          room: {
            id: currentAssignment.dorm_rooms.id.toString(),
            roomCode: currentAssignment.dorm_rooms.room_code,
            capacity: currentAssignment.dorm_rooms.capacity,
            genderPolicy: currentAssignment.dorm_rooms.gender_policy,
            dormName: currentAssignment.dorm_rooms.dorms.name,
          },
        },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
