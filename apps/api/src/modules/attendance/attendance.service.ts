// apps/api/src/modules/attendance/attendance.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateAttendanceSessionDto } from './dto/create-session.dto';
import { UpsertAttendanceMarksDto } from './dto/upsert-marks.dto';
import {
  AttendanceSessionListQueryDto,
  GuardianAttendanceQueryDto,
} from './dto/attendance-list.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class AttendanceService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async createSession(args: {
    tenantId: string;
    createdByUserId: string;
    dto: CreateAttendanceSessionDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const created_by_user_id = args.createdByUserId
      ? toBigInt(args.createdByUserId, 'createdByUserId')
      : null;
    const group_id = toBigInt(args.dto.groupId, 'groupId');

    return await this.prisma.$transaction(async (tx) => {
      // 1. Group exists?
      const group = await tx.groups.findFirst({
        where: { id: group_id, tenant_id },
        select: { id: true, name: true },
      });

      if (!group) {
        throw new NotFoundException('GROUP_NOT_FOUND');
      }

      // 2. Validate date
      const session_date = new Date(args.dto.sessionDate);
      if (isNaN(session_date.getTime())) {
        throw new BadRequestException('INVALID_DATE');
      }

      // 3. Upsert session (unique: group_id + session_date + type)
      const session = await tx.attendance_sessions.upsert({
        where: {
          group_id_session_date_type: {
            group_id,
            session_date,
            type: args.dto.type,
          },
        },
        update: {
          created_by_user_id, // update creator if exists
        },
        create: {
          tenant_id,
          group_id,
          session_date,
          type: args.dto.type,
          created_by_user_id,
        },
        include: {
          groups: {
            select: { name: true },
          },
        },
      });

      const existing = await tx.attendance_sessions.findUnique({
        where: {
          group_id_session_date_type: {
            group_id,
            session_date,
            type: args.dto.type,
          },
        },
        select: { id: true },
      });

      const isNew = !existing;

      // 4. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'attendance_sessions',
        entityId: session.id,
        afterData: {
          id: session.id.toString(),
          groupId: group_id.toString(),
          groupName: session.groups.name,
          date: session.session_date,
          type: session.type,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: session.id.toString(),
        isNew,
      };
    });
  }

  async listSessions(args: {
    tenantId: string;
    query: AttendanceSessionListQueryDto;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.attendance_sessionsWhereInput = {
      tenant_id,
    };

    if (args.query.groupId) {
      where.group_id = toBigInt(args.query.groupId, 'groupId');
    }

    if (args.query.type) {
      where.type = args.query.type;
    }

    if (args.query.from || args.query.to) {
      where.session_date = {};
      if (args.query.from) {
        where.session_date.gte = new Date(args.query.from);
      }
      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        where.session_date.lte = toDate;
      }
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.attendance_sessions.count({ where }),
      this.prisma.attendance_sessions.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ session_date: 'desc' }, { id: 'desc' }],
        include: {
          groups: {
            select: {
              id: true,
              name: true,
              grade: true,
            },
          },
          users: {
            select: {
              id: true,
              full_name: true,
            },
          },
          _count: {
            select: {
              attendance_marks: true,
            },
          },
        },
      }),
    ]);

    // Get summary counts per session
    const sessionIds = items.map((s) => s.id);
    const markSummary = await this.prisma.attendance_marks.groupBy({
      by: ['session_id', 'status'],
      where: {
        session_id: { in: sessionIds },
      },
      _count: {
        status: true,
      },
    });

    const summaryMap = new Map();
    markSummary.forEach((mark) => {
      const key = mark.session_id.toString();
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {});
      }
      summaryMap.get(key)[mark.status] = mark._count.status;
    });

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        sessionDate: item.session_date,
        type: item.type,
        createdAt: item.created_at,
        group: {
          id: item.groups.id.toString(),
          name: item.groups.name,
          grade: item.groups.grade,
        },
        createdBy: item.users
          ? {
              id: item.users.id.toString(),
              name: item.users.full_name,
            }
          : null,
        marksCount: item._count.attendance_marks,
        summary: summaryMap.get(item.id.toString()) || {},
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSessionDetail(args: { tenantId: string; sessionId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const session_id = toBigInt(args.sessionId, 'sessionId');

    const session = await this.prisma.attendance_sessions.findFirst({
      where: {
        id: session_id,
        tenant_id,
      },
      include: {
        groups: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        users: {
          select: {
            id: true,
            full_name: true,
          },
        },
        attendance_marks: {
          include: {
            students: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
          orderBy: {
            students: {
              full_name: 'asc',
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('SESSION_NOT_FOUND');
    }

    // Get all active students in this group
    const groupStudents = await this.prisma.students.findMany({
      where: {
        tenant_id,
        current_group_id: session.group_id,
        archived_at: null,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        full_name: true,
      },
      orderBy: {
        full_name: 'asc',
      },
    });

    // Map existing marks
    const markMap = new Map();
    session.attendance_marks.forEach((mark) => {
      markMap.set(mark.student_id.toString(), {
        status: mark.status,
        note: mark.note,
      });
    });

    // Complete attendance list with all students
    const attendanceList = groupStudents.map((student) => ({
      studentId: student.id.toString(),
      studentName: student.full_name,
      status: markMap.get(student.id.toString())?.status || null,
      note: markMap.get(student.id.toString())?.note || null,
    }));

    // Summary statistics
    const summary = {
      total: groupStudents.length,
      present: session.attendance_marks.filter((m) => m.status === 'PRESENT')
        .length,
      absent: session.attendance_marks.filter((m) => m.status === 'ABSENT')
        .length,
      late: session.attendance_marks.filter((m) => m.status === 'LATE').length,
      excused: session.attendance_marks.filter((m) => m.status === 'EXCUSED')
        .length,
      unmarked: groupStudents.length - session.attendance_marks.length,
    };

    return {
      id: session.id.toString(),
      sessionDate: session.session_date,
      type: session.type,
      createdAt: session.created_at,
      group: {
        id: session.groups.id.toString(),
        name: session.groups.name,
        grade: session.groups.grade,
      },
      createdBy: session.users
        ? {
            id: session.users.id.toString(),
            name: session.users.full_name,
          }
        : null,
      summary,
      attendance: attendanceList,
    };
  }

  async upsertMarks(args: {
    tenantId: string;
    sessionId: string;
    enteredByUserId: string;
    dto: UpsertAttendanceMarksDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const session_id = toBigInt(args.sessionId, 'sessionId');
    const entered_by_user_id = args.enteredByUserId
      ? toBigInt(args.enteredByUserId, 'enteredByUserId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Session exists?
      const session = await tx.attendance_sessions.findFirst({
        where: {
          id: session_id,
          tenant_id,
        },
        select: {
          id: true,
          group_id: true,
          session_date: true,
          type: true,
          groups: {
            select: { name: true },
          },
        },
      });

      if (!session) {
        throw new NotFoundException('SESSION_NOT_FOUND');
      }

      // 2. Get all active students in this group
      const groupStudents = await tx.students.findMany({
        where: {
          tenant_id,
          current_group_id: session.group_id,
          archived_at: null,
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });

      const validStudentIds = new Set(
        groupStudents.map((s) => s.id.toString()),
      );

      // 3. Validate all student IDs
      for (const mark of args.dto.marks) {
        if (!validStudentIds.has(mark.studentId)) {
          throw new BadRequestException(
            `STUDENT_NOT_IN_GROUP: ${mark.studentId}`,
          );
        }
      }

      // 4. Upsert marks
      const operations = args.dto.marks.map(async (mark) => {
        const student_id = toBigInt(mark.studentId, 'studentId');

        return tx.attendance_marks.upsert({
          where: {
            session_id_student_id: {
              session_id,
              student_id,
            },
          },
          update: {
            status: mark.status,
            note: mark.note?.trim() || null,
          },
          create: {
            session_id,
            student_id,
            status: mark.status,
            note: mark.note?.trim() || null,
          },
        });
      });

      await Promise.all(operations);

      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: entered_by_user_id,
        action: 'UPDATE',
        entityType: 'attendance_marks',
        entityId: session_id,
        afterData: {
          sessionId: session_id.toString(),
          groupName: session.groups.name,
          date: session.session_date,
          type: session.type,
          marksCount: args.dto.marks.length,
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        count: operations.length,
        message: `Attendance marks saved for ${operations.length} students`,
      };
    });
  }

  async guardianList(args: {
    studentAccountId: string;
    query: GuardianAttendanceQueryDto;
  }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    // Get student info
    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: {
          select: {
            full_name: true,
            current_group_id: true,
            groups: {
              select: { name: true, grade: true },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    const where: Prisma.attendance_marksWhereInput = {
      student_id: account.student_id,
      attendance_sessions: {
        tenant_id: account.tenant_id,
      },
    };

    if (args.query.from || args.query.to) {
      const sessionWhere: Prisma.attendance_sessionsWhereInput = {};
      sessionWhere.session_date = {};

      if (args.query.from) {
        sessionWhere.session_date.gte = new Date(args.query.from);
      }

      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        sessionWhere.session_date.lte = toDate;
      }

      where.attendance_sessions = sessionWhere;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.attendance_marks.count({ where }),
      this.prisma.attendance_marks.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          attendance_sessions: {
            session_date: 'desc',
          },
        },
        include: {
          attendance_sessions: {
            include: {
              groups: {
                select: {
                  name: true,
                  grade: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate summary statistics
    const summary = {
      total: total,
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };

    items.forEach((item) => {
      summary[item.status as keyof typeof summary] += 1;
    });

    // Calculate monthly stats
    const monthlyStats = new Map();
    items.forEach((item) => {
      const date = item.attendance_sessions.session_date;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyStats.has(monthKey)) {
        monthlyStats.set(monthKey, {
          month: monthKey,
          PRESENT: 0,
          ABSENT: 0,
          LATE: 0,
          EXCUSED: 0,
          total: 0,
        });
      }

      const stat = monthlyStats.get(monthKey);
      stat[item.status as keyof typeof stat] += 1;
      stat.total += 1;
    });

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
        group: account.students.groups?.name || null,
        grade: account.students.groups?.grade || null,
      },
      summary,
      monthlyStats: Array.from(monthlyStats.values()).sort((a, b) =>
        b.month.localeCompare(a.month),
      ),
      records: items.map((item) => ({
        date: item.attendance_sessions.session_date,
        type: item.attendance_sessions.type,
        group: item.attendance_sessions.groups.name,
        grade: item.attendance_sessions.groups.grade,
        status: item.status,
        note: item.note,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGroupStatistics(args: {
    tenantId: string;
    groupId: string;
    from?: string;
    to?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const group_id = toBigInt(args.groupId, 'groupId');

    const where: Prisma.attendance_marksWhereInput = {
      attendance_sessions: {
        tenant_id,
        group_id,
      },
    };

    if (args.from || args.to) {
      const sessionWhere: Prisma.attendance_sessionsWhereInput = {
        tenant_id,
        group_id,
      };

      sessionWhere.session_date = {};

      if (args.from) {
        sessionWhere.session_date.gte = new Date(args.from);
      }

      if (args.to) {
        const toDate = new Date(args.to);
        toDate.setHours(23, 59, 59, 999);

        sessionWhere.session_date.lte = toDate;
      }

      where.attendance_sessions = sessionWhere;
    }

    // Get all marks
    const marks = await this.prisma.attendance_marks.findMany({
      where,
      include: {
        attendance_sessions: {
          select: {
            session_date: true,
            type: true,
          },
        },
      },
    });

    // Daily statistics
    const dailyStats = new Map();
    marks.forEach((mark) => {
      const date = mark.attendance_sessions.session_date
        .toISOString()
        .split('T')[0];

      if (!dailyStats.has(date)) {
        dailyStats.set(date, {
          date,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        });
      }

      const stat = dailyStats.get(date);
      stat[mark.status.toLowerCase() as keyof typeof stat] += 1;
      stat.total += 1;
    });

    // Type statistics
    const typeStats = {
      CLASS: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
      STUDY_HALL: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
      EVENT: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
    };

    marks.forEach((mark) => {
      const type = mark.attendance_sessions.type as keyof typeof typeStats;
      if (typeStats[type]) {
        typeStats[type][
          mark.status.toLowerCase() as keyof (typeof typeStats)[typeof type]
        ] += 1;
        typeStats[type].total += 1;
      }
    });

    return {
      period: {
        from: args.from || 'all',
        to: args.to || 'all',
      },
      summary: {
        total: marks.length,
        present: marks.filter((m) => m.status === 'PRESENT').length,
        absent: marks.filter((m) => m.status === 'ABSENT').length,
        late: marks.filter((m) => m.status === 'LATE').length,
        excused: marks.filter((m) => m.status === 'EXCUSED').length,
      },
      dailyStats: Array.from(dailyStats.values()).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
      byType: typeStats,
    };
  }
}
