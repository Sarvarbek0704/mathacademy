// apps/api/src/modules/timetable/timetable.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ListTimetablesQueryDto } from './dto/list-timetables.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class TimetableService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ---------- Timetables ----------

  async createTimetable(args: {
    tenantId: string;
    userId: string;
    dto: CreateTimetableDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const group_id = toBigInt(args.dto.groupId, 'groupId');
      const academic_year_id = toBigInt(
        args.dto.academicYearId,
        'academicYearId',
      );
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      // Verify group and academic year belong to tenant
      const group = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        select: { id: true, name: true },
      });
      if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

      const academicYear = await this.prisma.academic_years.findFirst({
        where: { id: academic_year_id, tenant_id },
        select: { id: true, name: true },
      });
      if (!academicYear) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');

      const timetable = await this.prisma.timetable.create({
        data: {
          tenant_id,
          group_id,
          academic_year_id,
          name: args.dto.name.trim(),
          created_by_user_id,
        },
        include: {
          groups: { select: { name: true } },
          academic_years: { select: { name: true } },
          users: { select: { full_name: true } },
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'timetable',
        entityId: timetable.id,
        afterData: {
          id: timetable.id.toString(),
          group: timetable.groups.name,
          academicYear: timetable.academic_years.name,
          name: timetable.name,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: timetable.id.toString(),
        groupId: group_id.toString(),
        groupName: timetable.groups.name,
        academicYearId: academic_year_id.toString(),
        academicYearName: timetable.academic_years.name,
        name: timetable.name,
        createdBy: timetable.users?.full_name,
        createdAt: timetable.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listTimetables(args: {
    tenantId: string;
    query: ListTimetablesQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.timetableWhereInput = { tenant_id };

      if (args.query.groupId) {
        where.group_id = toBigInt(args.query.groupId, 'groupId');
      }
      if (args.query.academicYearId) {
        where.academic_year_id = toBigInt(
          args.query.academicYearId,
          'academicYearId',
        );
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.timetable.count({ where }),
        this.prisma.timetable.findMany({
          where,
          skip,
          take: limit,
          orderBy: { created_at: 'desc' },
          include: {
            groups: { select: { name: true } },
            academic_years: { select: { name: true } },
            _count: { select: { timetable_lessons: true } },
          },
        }),
      ]);

      return {
        data: items.map((t) => ({
          id: t.id.toString(),
          groupId: t.group_id.toString(),
          groupName: t.groups.name,
          academicYearId: t.academic_year_id.toString(),
          academicYearName: t.academic_years.name,
          name: t.name,
          createdAt: t.created_at,
          lessonsCount: t._count.timetable_lessons,
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

  async getTimetable(args: { tenantId: string; timetableId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');

      const timetable = await this.prisma.timetable.findFirst({
        where: { id: timetable_id, tenant_id },
        include: {
          groups: true,
          academic_years: true,
          users: { select: { full_name: true } },
          timetable_lessons: {
            orderBy: [{ day_of_week: 'asc' }, { period_no: 'asc' }],
            include: {
              subjects: { select: { id: true, name: true, is_core: true } },
              users: { select: { id: true, full_name: true } },
            },
          },
        },
      });
      if (!timetable) throw new NotFoundException('TIMETABLE_NOT_FOUND');

      return {
        id: timetable.id.toString(),
        groupId: timetable.group_id.toString(),
        groupName: timetable.groups.name,
        academicYearId: timetable.academic_year_id.toString(),
        academicYearName: timetable.academic_years.name,
        name: timetable.name,
        createdBy: timetable.users?.full_name,
        createdAt: timetable.created_at,
        lessons: timetable.timetable_lessons.map((l) => ({
          id: l.id.toString(),
          dayOfWeek: l.day_of_week,
          periodNo: l.period_no,
          subject: {
            id: l.subjects.id.toString(),
            name: l.subjects.name,
            isCore: l.subjects.is_core,
          },
          teacher: l.users
            ? { id: l.users.id.toString(), name: l.users.full_name }
            : null,
          room: l.room,
          startsAt: l.starts_at,
          endsAt: l.ends_at,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateTimetable(args: {
    tenantId: string;
    timetableId: string;
    userId: string;
    dto: UpdateTimetableDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.timetable.findFirst({
          where: { id: timetable_id, tenant_id },
          include: { groups: { select: { name: true } } },
        });
        if (!existing) throw new NotFoundException('TIMETABLE_NOT_FOUND');

        const updateData: Prisma.timetableUpdateInput = {};
        if (args.dto.name) updateData.name = args.dto.name.trim();
        if (args.dto.groupId) {
          const group_id = toBigInt(args.dto.groupId, 'groupId');
          const group = await tx.groups.findFirst({
            where: { id: group_id, tenant_id },
          });
          if (!group) throw new NotFoundException('GROUP_NOT_FOUND');
          updateData.groups = { connect: { id: group_id } };
        }
        if (args.dto.academicYearId) {
          const academic_year_id = toBigInt(
            args.dto.academicYearId,
            'academicYearId',
          );
          const ay = await tx.academic_years.findFirst({
            where: { id: academic_year_id, tenant_id },
          });
          if (!ay) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');
          updateData.academic_years = { connect: { id: academic_year_id } };
        }

        const updated = await tx.timetable.update({
          where: { id: timetable_id },
          data: updateData,
          include: {
            groups: { select: { name: true } },
            academic_years: { select: { name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'timetable',
          entityId: timetable_id,
          beforeData: { id: existing.id.toString(), name: existing.name },
          afterData: { id: updated.id.toString(), name: updated.name },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          groupId: updated.group_id.toString(),
          groupName: updated.groups.name,
          academicYearId: updated.academic_year_id.toString(),
          academicYearName: updated.academic_years.name,
          name: updated.name,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteTimetable(args: {
    tenantId: string;
    timetableId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const timetable = await tx.timetable.findFirst({
          where: { id: timetable_id, tenant_id },
        });
        if (!timetable) throw new NotFoundException('TIMETABLE_NOT_FOUND');

        // Check if it has lessons? We can cascade delete.
        const lessonsCount = await tx.timetable_lessons.count({
          where: { timetable_id },
        });
        if (lessonsCount > 0) {
          throw new BadRequestException('TIMETABLE_HAS_LESSONS');
        }

        await tx.timetable.delete({ where: { id: timetable_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'timetable',
          entityId: timetable_id,
          beforeData: { id: timetable.id.toString(), name: timetable.name },
          ipAddress: args.ipAddress,
        });

        return { ok: true };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Lessons ----------

  async addLesson(args: {
    tenantId: string;
    timetableId: string;
    userId: string;
    dto: CreateLessonDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const timetable = await tx.timetable.findFirst({
          where: { id: timetable_id, tenant_id },
        });
        if (!timetable) throw new NotFoundException('TIMETABLE_NOT_FOUND');

        // Check if a lesson with same day_of_week and period_no already exists
        const existing = await tx.timetable_lessons.findFirst({
          where: {
            timetable_id,
            day_of_week: args.dto.dayOfWeek,
            period_no: args.dto.periodNo,
          },
        });
        if (existing) {
          throw new BadRequestException('LESSON_ALREADY_EXISTS_AT_THIS_SLOT');
        }

        // Validate subject
        const subject_id = toBigInt(args.dto.subjectId, 'subjectId');
        const subject = await tx.subjects.findFirst({
          where: { id: subject_id, tenant_id },
        });
        if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

        let teacher_user_id: bigint | null = null;
        if (args.dto.teacherUserId) {
          teacher_user_id = toBigInt(args.dto.teacherUserId, 'teacherUserId');
          const teacher = await tx.users.findFirst({
            where: { id: teacher_user_id, tenant_id },
          });
          if (!teacher) throw new NotFoundException('TEACHER_NOT_FOUND');
        }

        const lesson = await tx.timetable_lessons.create({
          data: {
            timetable_id,
            day_of_week: args.dto.dayOfWeek,
            period_no: args.dto.periodNo,
            subject_id,
            teacher_user_id,
            room: args.dto.room,
            starts_at: args.dto.startsAt
              ? new Date(`1970-01-01T${args.dto.startsAt}:00Z`)
              : null,
            ends_at: args.dto.endsAt
              ? new Date(`1970-01-01T${args.dto.endsAt}:00Z`)
              : null,
          },
          include: {
            subjects: { select: { name: true } },
            users: { select: { full_name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'timetable_lessons',
          entityId: lesson.id,
          afterData: {
            id: lesson.id.toString(),
            timetableId: timetable_id.toString(),
            dayOfWeek: lesson.day_of_week,
            periodNo: lesson.period_no,
            subject: lesson.subjects.name,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: lesson.id.toString(),
          dayOfWeek: lesson.day_of_week,
          periodNo: lesson.period_no,
          subjectId: subject_id.toString(),
          subjectName: lesson.subjects.name,
          teacherId: teacher_user_id?.toString(),
          teacherName: lesson.users?.full_name,
          room: lesson.room,
          startsAt: lesson.starts_at,
          endsAt: lesson.ends_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateLesson(args: {
    tenantId: string;
    timetableId: string;
    lessonId: string;
    userId: string;
    dto: UpdateLessonDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const lesson_id = toBigInt(args.lessonId, 'lessonId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const lesson = await tx.timetable_lessons.findFirst({
          where: { id: lesson_id, timetable: { tenant_id, id: timetable_id } },
        });
        if (!lesson) throw new NotFoundException('LESSON_NOT_FOUND');

        const updateData: Prisma.timetable_lessonsUpdateInput = {};

        if (args.dto.dayOfWeek !== undefined) {
          updateData.day_of_week = args.dto.dayOfWeek;
        }
        if (args.dto.periodNo !== undefined) {
          updateData.period_no = args.dto.periodNo;
        }
        if (args.dto.subjectId) {
          const subject_id = toBigInt(args.dto.subjectId, 'subjectId');
          const subject = await tx.subjects.findFirst({
            where: { id: subject_id, tenant_id },
          });
          if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');
          updateData.subjects = { connect: { id: subject_id } };
        }
        if (args.dto.teacherUserId !== undefined) {
          if (args.dto.teacherUserId) {
            const teacher_id = toBigInt(
              args.dto.teacherUserId,
              'teacherUserId',
            );
            const teacher = await tx.users.findFirst({
              where: { id: teacher_id, tenant_id },
            });
            if (!teacher) throw new NotFoundException('TEACHER_NOT_FOUND');
            updateData.users = { connect: { id: teacher_id } };
          } else {
            updateData.users = { disconnect: true };
          }
        }
        if (args.dto.room !== undefined) {
          updateData.room = args.dto.room;
        }
        if (args.dto.startsAt !== undefined) {
          updateData.starts_at = args.dto.startsAt
            ? new Date(`1970-01-01T${args.dto.startsAt}:00Z`)
            : null;
        }
        if (args.dto.endsAt !== undefined) {
          updateData.ends_at = args.dto.endsAt
            ? new Date(`1970-01-01T${args.dto.endsAt}:00Z`)
            : null;
        }

        // Check for conflict if day/period changed
        if (
          args.dto.dayOfWeek !== undefined ||
          args.dto.periodNo !== undefined
        ) {
          const newDay = args.dto.dayOfWeek ?? lesson.day_of_week;
          const newPeriod = args.dto.periodNo ?? lesson.period_no;
          const existingConflict = await tx.timetable_lessons.findFirst({
            where: {
              timetable_id,
              day_of_week: newDay,
              period_no: newPeriod,
              id: { not: lesson_id },
            },
          });
          if (existingConflict) {
            throw new BadRequestException('LESSON_SLOT_ALREADY_OCCUPIED');
          }
        }

        const updated = await tx.timetable_lessons.update({
          where: { id: lesson_id },
          data: updateData,
          include: {
            subjects: { select: { name: true } },
            users: { select: { full_name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'timetable_lessons',
          entityId: lesson_id,
          beforeData: {
            id: lesson.id.toString(),
            dayOfWeek: lesson.day_of_week,
            periodNo: lesson.period_no,
          },
          afterData: {
            id: updated.id.toString(),
            dayOfWeek: updated.day_of_week,
            periodNo: updated.period_no,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          dayOfWeek: updated.day_of_week,
          periodNo: updated.period_no,
          subjectId: updated.subject_id.toString(),
          subjectName: updated.subjects.name,
          teacherId: updated.teacher_user_id?.toString(),
          teacherName: updated.users?.full_name,
          room: updated.room,
          startsAt: updated.starts_at,
          endsAt: updated.ends_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteLesson(args: {
    tenantId: string;
    timetableId: string;
    lessonId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const lesson_id = toBigInt(args.lessonId, 'lessonId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const lesson = await tx.timetable_lessons.findFirst({
          where: { id: lesson_id, timetable: { tenant_id, id: timetable_id } },
        });
        if (!lesson) throw new NotFoundException('LESSON_NOT_FOUND');

        await tx.timetable_lessons.delete({ where: { id: lesson_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'timetable_lessons',
          entityId: lesson_id,
          beforeData: {
            id: lesson.id.toString(),
            dayOfWeek: lesson.day_of_week,
            periodNo: lesson.period_no,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async batchUpsertLessons(args: {
    tenantId: string;
    timetableId: string;
    userId: string;
    lessons: CreateLessonDto[];
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const timetable_id = toBigInt(args.timetableId, 'timetableId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const timetable = await tx.timetable.findFirst({
          where: { id: timetable_id, tenant_id },
        });
        if (!timetable) throw new NotFoundException('TIMETABLE_NOT_FOUND');

        // Delete all existing lessons
        await tx.timetable_lessons.deleteMany({
          where: { timetable_id },
        });

        // Prepare and validate new lessons
        const lessonsData: Prisma.timetable_lessonsCreateManyInput[] = [];
        const usedSlots = new Set<string>();

        for (const dto of args.lessons) {
          const slot = `${dto.dayOfWeek}-${dto.periodNo}`;
          if (usedSlots.has(slot)) {
            throw new BadRequestException(
              `Duplicate slot: day ${dto.dayOfWeek}, period ${dto.periodNo}`,
            );
          }
          usedSlots.add(slot);

          const subject_id = toBigInt(dto.subjectId, 'subjectId');
          const subject = await tx.subjects.findFirst({
            where: { id: subject_id, tenant_id },
          });
          if (!subject)
            throw new NotFoundException(`Subject ${dto.subjectId} not found`);

          let teacher_user_id: bigint | null = null;
          if (dto.teacherUserId) {
            teacher_user_id = toBigInt(dto.teacherUserId, 'teacherUserId');
            const teacher = await tx.users.findFirst({
              where: { id: teacher_user_id, tenant_id },
            });
            if (!teacher)
              throw new NotFoundException(
                `Teacher ${dto.teacherUserId} not found`,
              );
          }

          lessonsData.push({
            timetable_id,
            day_of_week: dto.dayOfWeek,
            period_no: dto.periodNo,
            subject_id,
            teacher_user_id,
            room: dto.room,
            starts_at: dto.startsAt
              ? new Date(`1970-01-01T${dto.startsAt}:00Z`)
              : null,
            ends_at: dto.endsAt
              ? new Date(`1970-01-01T${dto.endsAt}:00Z`)
              : null,
          });
        }

        if (lessonsData.length) {
          await tx.timetable_lessons.createMany({
            data: lessonsData,
            skipDuplicates: false,
          });
        }

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'timetable_lessons',
          entityId: timetable_id,
          afterData: { lessonsCount: lessonsData.length },
          ipAddress: args.ipAddress,
        });

        return { ok: true, count: lessonsData.length };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Guardian ----------

  async guardianTimetable(args: { studentAccountId: string }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: {
          students: {
            include: {
              groups: {
                include: {
                  academic_years: { select: { is_current: true } },
                },
              },
            },
          },
        },
      });
      if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

      const student = account.students;
      if (!student.current_group_id) {
        return {
          hasTimetable: false,
          message: 'Student not assigned to any group',
        };
      }

      // Find timetable for current academic year
      const timetable = await this.prisma.timetable.findFirst({
        where: {
          group_id: student.current_group_id,
          academic_years: { is_current: true },
        },
        include: {
          timetable_lessons: {
            orderBy: [{ day_of_week: 'asc' }, { period_no: 'asc' }],
            include: {
              subjects: { select: { name: true } },
              users: { select: { full_name: true } },
            },
          },
        },
      });

      if (!timetable) {
        return {
          hasTimetable: false,
          message: 'No timetable for current academic year',
        };
      }

      return {
        hasTimetable: true,
        timetable: {
          id: timetable.id.toString(),
          name: timetable.name,
          lessons: timetable.timetable_lessons.map((l) => ({
            dayOfWeek: l.day_of_week,
            periodNo: l.period_no,
            subject: l.subjects.name,
            teacher: l.users?.full_name,
            room: l.room,
            startsAt: l.starts_at,
            endsAt: l.ends_at,
          })),
        },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
