// apps/api/src/modules/academic-years/academic-years.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { parseDateOnly } from '../../common/utils/date.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicYearListQuery } from './dto/academic-year-list.query.dto';
import { AcademicYearStatsQuery } from './dto/academic-year-stats.query.dto';
import { RolloverAcademicYearDto } from './dto/rollover-academic-year.dto';

function bi(v: string | bigint, field = 'id'): bigint {
  try {
    if (typeof v === 'bigint') return v;
    if (!v || typeof v !== 'string') throw new Error('bad');
    const n = BigInt(v);
    if (n <= 0n) throw new Error('non-positive');
    return n;
  } catch {
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  }
}

function safeCountAll(row: any): number {
  return Number(row?._count?._all ?? 0);
}

export interface PaginatedAcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  createdAt: Date;
  counts: {
    groups: number;
    assessments: number;
    timetables: number;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

function ok<T>(data: T) {
  return { ok: true, data };
}

@Injectable()
export class AcademicYearsService {
  private auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  private validateDates(startDate: string, endDate: string) {
    const s = parseDateOnly(startDate, 'startDate');
    const e = parseDateOnly(endDate, 'endDate');
    if (s.getTime() >= e.getTime()) {
      throw new BadRequestException('INVALID_DATE_RANGE');
    }
    return { s, e };
  }

  async current(tenantId: string) {
    const tenant_id = bi(tenantId, 'tenantId');
    try {
      const row = await this.prisma.academic_years.findFirst({
        where: { tenant_id, is_current: true },
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          is_current: true,
          created_at: true,
        },
      });

      if (!row) throw new NotFoundException('CURRENT_ACADEMIC_YEAR_NOT_SET');

      return ok({
        id: row.id.toString(),
        name: row.name,
        startDate: row.start_date,
        endDate: row.end_date,
        isCurrent: row.is_current,
        createdAt: row.created_at,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async list(
    tenantId: string,
    q: AcademicYearListQuery,
  ): Promise<PaginatedResult<PaginatedAcademicYear>> {
    const tenant_id = bi(tenantId, 'tenantId');
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    try {
      const where: Prisma.academic_yearsWhereInput = {
        tenant_id,
        ...(q.search
          ? { name: { contains: q.search.trim(), mode: 'insensitive' } }
          : {}),
        ...(typeof q.isCurrent === 'boolean'
          ? { is_current: q.isCurrent }
          : {}),
      };

      const [total, rows] = await this.prisma.$transaction([
        this.prisma.academic_years.count({ where }),
        this.prisma.academic_years.findMany({
          where,
          orderBy: [{ is_current: 'desc' }, { start_date: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
            created_at: true,
            _count: {
              select: { groups: true, assessments: true, timetable: true },
            },
          },
        }),
      ]);

      const items = rows.map((r) => ({
        id: r.id.toString(),
        name: r.name,
        startDate: r.start_date,
        endDate: r.end_date,
        isCurrent: r.is_current,
        createdAt: r.created_at,
        counts: {
          groups: r._count.groups,
          assessments: r._count.assessments,
          timetables: r._count.timetable,
        },
      }));

      return paginated(items, total, page, limit);
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async detail(tenantId: string, id: string) {
    const tenant_id = bi(tenantId, 'tenantId');
    const ayId = bi(id, 'academicYearId');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const ay = await tx.academic_years.findFirst({
          where: { tenant_id, id: ayId },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
            created_at: true,
            _count: {
              select: { groups: true, assessments: true, timetable: true },
            },
          },
        });
        if (!ay) throw new NotFoundException('NOT_FOUND');

        const [lessonsCount, studentsCount] = await Promise.all([
          tx.timetable_lessons.count({
            where: { timetable: { academic_year_id: ayId, tenant_id } },
          }),
          tx.students.count({
            where: {
              tenant_id,
              archived_at: null,
              groups: { academic_year_id: ayId },
            },
          }),
        ]);

        return { ay, lessonsCount, studentsCount };
      });

      const { ay, lessonsCount, studentsCount } = result;

      return ok({
        id: ay.id.toString(),
        name: ay.name,
        startDate: ay.start_date,
        endDate: ay.end_date,
        isCurrent: ay.is_current,
        createdAt: ay.created_at,
        counts: {
          groups: ay._count.groups,
          students: studentsCount,
          assessments: ay._count.assessments,
          timetables: ay._count.timetable,
          lessons: lessonsCount,
        },
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async overview(tenantId: string, id: string) {
    const tenant_id = bi(tenantId, 'tenantId');
    const ayId = bi(id, 'academicYearId');

    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const ay = await tx.academic_years.findFirst({
          where: { tenant_id, id: ayId },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
          },
        });
        if (!ay) throw new NotFoundException('NOT_FOUND');

        const [
          groupsByGrade,
          studentsByStatus,
          assessmentsByType,
          timetablesCount,
          lessonsCount,
        ] = await Promise.all([
          tx.groups.groupBy({
            where: { tenant_id, academic_year_id: ayId },
            by: ['grade'],
            _count: { _all: true },
            orderBy: { grade: 'asc' },
          }),
          tx.students.groupBy({
            where: {
              tenant_id,
              archived_at: null,
              groups: { academic_year_id: ayId },
            },
            by: ['status'],
            _count: { _all: true },
            orderBy: { status: 'asc' },
          }),
          tx.assessments.groupBy({
            where: { tenant_id, academic_year_id: ayId },
            by: ['type'],
            _count: { _all: true },
            orderBy: { type: 'asc' },
          }),
          tx.timetable.count({ where: { tenant_id, academic_year_id: ayId } }),
          tx.timetable_lessons.count({
            where: { timetable: { tenant_id, academic_year_id: ayId } },
          }),
        ]);

        const groups = groupsByGrade.map((x) => ({
          grade: x.grade,
          count: safeCountAll(x),
        }));
        const students = studentsByStatus.map((x) => ({
          status: x.status,
          count: safeCountAll(x),
        }));
        const assessments = assessmentsByType.map((x) => ({
          type: x.type,
          count: safeCountAll(x),
        }));

        return {
          ay,
          timetablesCount,
          lessonsCount,
          groups,
          students,
          assessments,
        };
      });

      const totalGroups = data.groups.reduce((a, b) => a + b.count, 0);
      const totalStudents = data.students.reduce((a, b) => a + b.count, 0);
      const totalAssessments = data.assessments.reduce(
        (a, b) => a + b.count,
        0,
      );

      return ok({
        academicYear: {
          id: data.ay.id.toString(),
          name: data.ay.name,
          startDate: data.ay.start_date,
          endDate: data.ay.end_date,
          isCurrent: data.ay.is_current,
        },
        totals: {
          groups: totalGroups,
          students: totalStudents,
          assessments: totalAssessments,
          timetables: data.timetablesCount,
          lessons: data.lessonsCount,
        },
        charts: {
          groupsByGrade: data.groups,
          studentsByStatus: data.students,
          assessmentsByType: data.assessments,
        },
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async create(
    tenantId: string,
    actorUserId: string | null,
    dto: CreateAcademicYearDto,
    ip?: string | null,
  ) {
    const tenant_id = bi(tenantId, 'tenantId');
    const actorId = actorUserId ? bi(actorUserId, 'userId') : null;

    const { s, e } = this.validateDates(dto.startDate, dto.endDate);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.isCurrent) {
          await tx.academic_years.updateMany({
            where: { tenant_id, is_current: true },
            data: { is_current: false },
          });
        }

        const row = await tx.academic_years.create({
          data: {
            tenant_id,
            name: dto.name.trim(),
            start_date: s,
            end_date: e,
            is_current: dto.isCurrent ?? false,
          },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
            created_at: true,
          },
        });

        return row;
      });

      if (actorId) {
        await this.auditLogger.logStaffAction(
          tenant_id,
          actorId,
          'CREATE',
          'academic_years',
          created.id,
          {
            before: null,
            after: {
              id: created.id.toString(),
              name: created.name,
              startDate: created.start_date,
              endDate: created.end_date,
              isCurrent: created.is_current,
            },
          },
          ip ?? undefined,
        );
      }

      return ok({
        id: created.id.toString(),
        name: created.name,
        startDate: created.start_date,
        endDate: created.end_date,
        isCurrent: created.is_current,
        createdAt: created.created_at,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async update(
    tenantId: string,
    actorUserId: string | null,
    id: string,
    dto: UpdateAcademicYearDto,
    ip?: string | null,
  ) {
    const tenant_id = bi(tenantId, 'tenantId');
    const ayId = bi(id, 'academicYearId');
    const actorId = actorUserId ? bi(actorUserId, 'userId') : null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const before = await tx.academic_years.findFirst({
          where: { tenant_id, id: ayId },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
            created_at: true,
          },
        });
        if (!before) throw new NotFoundException('NOT_FOUND');

        let start_date: Date | undefined;
        let end_date: Date | undefined;

        if (dto.startDate || dto.endDate) {
          const s = dto.startDate
            ? dto.startDate
            : before.start_date.toISOString().slice(0, 10);
          const e = dto.endDate
            ? dto.endDate
            : before.end_date.toISOString().slice(0, 10);
          const parsed = this.validateDates(s, e);
          start_date = parsed.s;
          end_date = parsed.e;
        }

        if (dto.isCurrent === true) {
          await tx.academic_years.updateMany({
            where: { tenant_id, is_current: true, NOT: { id: ayId } },
            data: { is_current: false },
          });
        }

        const after = await tx.academic_years.update({
          where: { id: ayId },
          data: {
            ...(dto.name ? { name: dto.name.trim() } : {}),
            ...(typeof dto.isCurrent === 'boolean'
              ? { is_current: dto.isCurrent }
              : {}),
            ...(start_date ? { start_date } : {}),
            ...(end_date ? { end_date } : {}),
          },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
            created_at: true,
          },
        });

        return { before, after };
      });

      if (actorId) {
        await this.auditLogger.logStaffAction(
          tenant_id,
          actorId,
          'UPDATE',
          'academic_years',
          ayId,
          {
            before: {
              id: result.before.id.toString(),
              name: result.before.name,
              startDate: result.before.start_date,
              endDate: result.before.end_date,
              isCurrent: result.before.is_current,
            },
            after: {
              id: result.after.id.toString(),
              name: result.after.name,
              startDate: result.after.start_date,
              endDate: result.after.end_date,
              isCurrent: result.after.is_current,
            },
          },
          ip ?? undefined,
        );
      }

      return ok({
        id: result.after.id.toString(),
        name: result.after.name,
        startDate: result.after.start_date,
        endDate: result.after.end_date,
        isCurrent: result.after.is_current,
        createdAt: result.after.created_at,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async setCurrent(
    tenantId: string,
    actorUserId: string | null,
    id: string,
    ip?: string | null,
  ) {
    const tenant_id = bi(tenantId, 'tenantId');
    const ayId = bi(id, 'academicYearId');
    const actorId = actorUserId ? bi(actorUserId, 'userId') : null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const exists = await tx.academic_years.findFirst({
          where: { tenant_id, id: ayId },
          select: { id: true, is_current: true, name: true },
        });
        if (!exists) throw new NotFoundException('NOT_FOUND');

        await tx.academic_years.updateMany({
          where: { tenant_id, is_current: true, NOT: { id: ayId } },
          data: { is_current: false },
        });

        const after = await tx.academic_years.update({
          where: { id: ayId },
          data: { is_current: true },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
          },
        });

        return { before: exists, after };
      });

      if (actorId) {
        await this.auditLogger.logStaffAction(
          tenant_id,
          actorId,
          'OTHER',
          'academic_years',
          ayId,
          {
            before: {
              id: result.before.id.toString(),
              name: result.before.name,
              isCurrent: result.before.is_current,
            },
            after: {
              id: result.after.id.toString(),
              name: result.after.name,
              startDate: result.after.start_date,
              endDate: result.after.end_date,
              isCurrent: result.after.is_current,
            },
          },
          ip ?? undefined,
        );
      }

      return ok({
        id: result.after.id.toString(),
        name: result.after.name,
        startDate: result.after.start_date,
        endDate: result.after.end_date,
        isCurrent: result.after.is_current,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async remove(
    tenantId: string,
    actorUserId: string | null,
    id: string,
    force: boolean,
    ip?: string | null,
  ) {
    const tenant_id = bi(tenantId, 'tenantId');
    const ayId = bi(id, 'academicYearId');
    const actorId = actorUserId ? bi(actorUserId, 'userId') : null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const ay = await tx.academic_years.findFirst({
          where: { tenant_id, id: ayId },
          select: { id: true, name: true, is_current: true },
        });
        if (!ay) throw new NotFoundException('NOT_FOUND');
        if (ay.is_current)
          throw new BadRequestException('CANNOT_DELETE_CURRENT_ACADEMIC_YEAR');

        const [groups, assessments, timetables] = await Promise.all([
          tx.groups.count({ where: { tenant_id, academic_year_id: ayId } }),
          tx.assessments.count({
            where: { tenant_id, academic_year_id: ayId },
          }),
          tx.timetable.count({ where: { tenant_id, academic_year_id: ayId } }),
        ]);

        if (!force && (groups > 0 || assessments > 0 || timetables > 0)) {
          throw new BadRequestException({
            code: 'HAS_DEPENDENCIES',
            message: 'Academic year has dependencies',
            details: { groups, assessments, timetables },
          } as any);
        }

        const deleted = await tx.academic_years.delete({
          where: { id: ayId },
          select: { id: true, name: true },
        });

        return { ay, deleted };
      });

      if (actorId) {
        await this.auditLogger.logStaffAction(
          tenant_id,
          actorId,
          'DELETE',
          'academic_years',
          ayId,
          {
            before: {
              id: result.ay.id.toString(),
              name: result.ay.name,
              isCurrent: result.ay.is_current,
            },
            after: {
              id: result.deleted.id.toString(),
              name: result.deleted.name,
            },
          },
          ip ?? undefined,
        );
      }

      return ok({
        deleted: true,
        id: result.deleted.id.toString(),
        name: result.deleted.name,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async stats(tenantId: string, q: AcademicYearStatsQuery) {
    const tenant_id = bi(tenantId, 'tenantId');
    const last = q.last ? Number(q.last) : null;

    if (q.last && last !== null) {
      if (!Number.isFinite(last) || last <= 0 || last > 50) {
        throw new BadRequestException('INVALID_last');
      }
    }

    try {
      const years = await this.prisma.academic_years.findMany({
        where: { tenant_id },
        orderBy: [{ start_date: 'desc' }],
        take: last ?? undefined,
        select: {
          id: true,
          name: true,
          start_date: true,
          end_date: true,
          is_current: true,
          _count: {
            select: { groups: true, assessments: true, timetable: true },
          },
        },
      });

      const yearIds = years.map((x) => x.id);

      const [studentsByAy, lessonsByAy] = await this.prisma.$transaction([
        this.prisma.students.groupBy({
          where: {
            tenant_id,
            archived_at: null,
            groups: { academic_year_id: { in: yearIds } },
          },
          by: ['current_group_id'],
          _count: { _all: true },
          orderBy: { current_group_id: 'asc' },
        }),
        this.prisma.timetable_lessons.groupBy({
          where: {
            timetable: { tenant_id, academic_year_id: { in: yearIds } },
          },
          by: ['timetable_id'],
          _count: { _all: true },
          orderBy: { timetable_id: 'asc' },
        }),
      ]);

      const groups = await this.prisma.groups.findMany({
        where: { tenant_id, academic_year_id: { in: yearIds } },
        select: { id: true, academic_year_id: true },
      });
      const groupToAy = new Map<string, string>();
      for (const g of groups)
        groupToAy.set(g.id.toString(), g.academic_year_id.toString());

      const studentsCountMap = new Map<string, number>();
      for (const r of studentsByAy) {
        const gid = r.current_group_id ? r.current_group_id.toString() : null;
        if (!gid) continue;
        const ay = groupToAy.get(gid);
        if (!ay) continue;
        studentsCountMap.set(
          ay,
          (studentsCountMap.get(ay) ?? 0) + safeCountAll(r),
        );
      }

      const timetables = await this.prisma.timetable.findMany({
        where: { tenant_id, academic_year_id: { in: yearIds } },
        select: { id: true, academic_year_id: true },
      });
      const ttToAy = new Map<string, string>();
      for (const t of timetables)
        ttToAy.set(t.id.toString(), t.academic_year_id.toString());

      const lessonsCountMap = new Map<string, number>();
      for (const r of lessonsByAy) {
        const tid = r.timetable_id ? r.timetable_id.toString() : null;
        if (!tid) continue;
        const ay = ttToAy.get(tid);
        if (!ay) continue;
        lessonsCountMap.set(
          ay,
          (lessonsCountMap.get(ay) ?? 0) + safeCountAll(r),
        );
      }

      return ok({
        years: years.map((y) => ({
          id: y.id.toString(),
          name: y.name,
          startDate: y.start_date,
          endDate: y.end_date,
          isCurrent: y.is_current,
          groups: y._count.groups,
          students: studentsCountMap.get(y.id.toString()) ?? 0,
          assessments: y._count.assessments,
          timetables: y._count.timetable,
          lessons: lessonsCountMap.get(y.id.toString()) ?? 0,
        })),
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async rollover(
    tenantId: string,
    actorUserId: string | null,
    sourceAcademicYearId: string,
    dto: RolloverAcademicYearDto,
    ip?: string | null,
  ) {
    const tenant_id = bi(tenantId, 'tenantId');
    const sourceId = bi(sourceAcademicYearId, 'academicYearId');
    const actorId = actorUserId ? bi(actorUserId, 'userId') : null;

    const { s, e } = this.validateDates(dto.startDate, dto.endDate);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const source = await tx.academic_years.findFirst({
          where: { tenant_id, id: sourceId },
          select: { id: true, name: true },
        });
        if (!source)
          throw new NotFoundException('SOURCE_ACADEMIC_YEAR_NOT_FOUND');

        if (dto.makeCurrent) {
          await tx.academic_years.updateMany({
            where: { tenant_id, is_current: true },
            data: { is_current: false },
          });
        }

        const created = await tx.academic_years.create({
          data: {
            tenant_id,
            name: dto.name.trim(),
            start_date: s,
            end_date: e,
            is_current: dto.makeCurrent ?? false,
          },
          select: {
            id: true,
            name: true,
            start_date: true,
            end_date: true,
            is_current: true,
          },
        });

        let clonedGroups = 0;

        if (dto.cloneGroups) {
          const groups = await tx.groups.findMany({
            where: { tenant_id, academic_year_id: sourceId },
            select: {
              name: true,
              grade: true,
              campus_id: true,
              track_id: true,
              curator_user_id: true,
            },
          });

          if (groups.length) {
            await tx.groups.createMany({
              data: groups.map((g) => ({
                tenant_id,
                academic_year_id: created.id,
                name: g.name,
                grade: g.grade,
                campus_id: g.campus_id,
                track_id: g.track_id,
                curator_user_id: g.curator_user_id,
              })),
              skipDuplicates: true,
            });
            clonedGroups = groups.length;
          }
        }

        return { source, created, clonedGroups };
      });

      if (actorId) {
        await this.auditLogger.logStaffAction(
          tenant_id,
          actorId,
          'CREATE',
          'academic_years_rollover',
          result.created.id,
          {
            before: {
              sourceAcademicYearId: result.source.id.toString(),
              sourceName: result.source.name,
            },
            after: {
              createdAcademicYearId: result.created.id.toString(),
              name: result.created.name,
              clonedGroups: result.clonedGroups,
            },
          },
          ip ?? undefined,
        );
      }

      return ok({
        source: { id: result.source.id.toString(), name: result.source.name },
        created: {
          id: result.created.id.toString(),
          name: result.created.name,
          startDate: result.created.start_date,
          endDate: result.created.end_date,
          isCurrent: result.created.is_current,
        },
        clonedGroups: result.clonedGroups,
      });
    } catch (e) {
      rethrowServiceError(e);
    }
  }
}
