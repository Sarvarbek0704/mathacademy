import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupListQuery } from './dto/group-list.query';
import { SetGroupSubjectsDto } from './dto/set-group-subjects.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CloneGroupDto } from './dto/clone-group.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  try {
    return BigInt(s);
  } catch {
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  }
}

function normalizeName(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function uniqStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x ?? '').trim();
    if (!s) continue;
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function mapPrismaError(e: unknown): never {
  if (
    e instanceof BadRequestException ||
    e instanceof NotFoundException ||
    e instanceof ConflictException
  )
    throw e;

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // unique violation
    if (e.code === 'P2002') throw new ConflictException('ALREADY_EXISTS');
    // FK constraint
    if (e.code === 'P2003') throw new BadRequestException('INVALID_REFERENCE');
    // not found on update/delete
    if (e.code === 'P2025') throw new NotFoundException('NOT_FOUND');
    throw new BadRequestException('DB_ERROR');
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException('INVALID_DB_QUERY');
  }

  // user talabi: 500 qaytmasin
  throw new BadRequestException('REQUEST_FAILED');
}

@Injectable()
export class GroupsService {
  private readonly audit: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.audit = new AuditLogger(prisma);
  }

  async list(tenantId: string, q: GroupListQuery) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const limit = Math.max(1, Math.min(200, Number(q.limit ?? 50)));
      const offset = Math.max(0, Number(q.offset ?? 0));
      const includeCounts = q.includeCounts !== false;

      const where: Prisma.groupsWhereInput = {
        tenant_id,
        ...(q.academicYearId
          ? { academic_year_id: toBigInt(q.academicYearId, 'academicYearId') }
          : {}),
        ...(q.campusId ? { campus_id: toBigInt(q.campusId, 'campusId') } : {}),
        ...(q.trackId ? { track_id: toBigInt(q.trackId, 'trackId') } : {}),
        ...(q.curatorUserId
          ? { curator_user_id: toBigInt(q.curatorUserId, 'curatorUserId') }
          : {}),
        ...(q.grade ? { grade: Number(q.grade) } : {}),
      };

      const search = normalizeName(q.q);
      if (search) where.name = { contains: search, mode: 'insensitive' };

      const sortBy = q.sortBy ?? 'created_at';
      const sortDir = q.sortDir ?? 'desc';

      const orderBy: Prisma.groupsOrderByWithRelationInput =
        sortBy === 'id'
          ? { id: sortDir }
          : sortBy === 'name'
            ? { name: sortDir }
            : sortBy === 'grade'
              ? { grade: sortDir }
              : { created_at: sortDir };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.groups.count({ where }),
        this.prisma.groups.findMany({
          where,
          orderBy,
          take: limit,
          skip: offset,
          include: {
            campuses: true,
            academic_years: true,
            student_tracks: true,
            users: true, // curator
            ...(includeCounts
              ? { _count: { select: { students: true, group_subjects: true } } }
              : {}),
          },
        }),
      ]);

      return { 
        total, 
        limit, 
        offset, 
        data: items.map(g => ({
          id: g.id.toString(),
          name: g.name,
          grade: g.grade,
          campusId: g.campus_id?.toString(),
          academicYearId: g.academic_year_id?.toString(),
          trackId: g.track_id?.toString(),
          curatorUserId: g.curator_user_id?.toString(),
          campus: g.campuses ? { id: g.campuses.id.toString(), name: g.campuses.name } : null,
          academicYear: g.academic_years ? { id: g.academic_years.id.toString(), name: g.academic_years.name } : null,
          track: g.student_tracks ? { id: g.student_tracks.id.toString(), name: g.student_tracks.name, color: (g.student_tracks as any).color || null } : null,
          curator: g.users ? { id: g.users.id.toString(), name: g.users.full_name } : null,
          studentCount: g._count?.students || 0,
          studentsCount: g._count?.students || 0,
          subjectsCount: g._count?.group_subjects || 0
        }))
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async detail(tenantId: string, id: string) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const group_id = toBigInt(id, 'id');

      const g = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        include: {
          campuses: true,
          academic_years: true,
          student_tracks: true,
          users: true,
          _count: {
            select: {
              students: true,
              group_subjects: true,
              assessments: true,
              attendance_sessions: true,
            },
          },
          group_subjects: {
            include: { subjects: true },
            orderBy: { subject_id: 'asc' },
          },
        },
      });

      if (!g) throw new NotFoundException('GROUP_NOT_FOUND');

      return {
        ...g,
        subjects: g.group_subjects.map((x) => x.subjects),
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async create(
    tenantId: string,
    actorUserId: string | undefined,
    dto: CreateGroupDto,
  ) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const actor_user_id = actorUserId
        ? toBigInt(actorUserId, 'actorUserId')
        : null;

      const name = normalizeName(dto.name);
      if (!name) throw new BadRequestException('INVALID_NAME');

      const grade = Number(dto.grade);
      if (![10, 11].includes(grade))
        throw new BadRequestException('INVALID_GRADE');

      const academic_year_id = toBigInt(dto.academicYearId, 'academicYearId');
      const campus_id = dto.campusId
        ? toBigInt(dto.campusId, 'campusId')
        : null;
      const track_id = dto.trackId ? toBigInt(dto.trackId, 'trackId') : null;
      const curator_user_id = dto.curatorUserId
        ? toBigInt(dto.curatorUserId, 'curatorUserId')
        : null;

      // FK pre-check (500 chiqmasin)
      await this.prisma.$transaction(async (tx) => {
        const ay = await tx.academic_years.findFirst({
          where: { id: academic_year_id, tenant_id },
          select: { id: true },
        });
        if (!ay) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');

        if (campus_id) {
          const campus = await tx.campuses.findFirst({
            where: { id: campus_id, tenant_id },
            select: { id: true },
          });
          if (!campus) throw new BadRequestException('CAMPUS_NOT_FOUND');
        }

        if (track_id) {
          const track = await tx.student_tracks.findFirst({
            where: { id: track_id, tenant_id },
            select: { id: true },
          });
          if (!track) throw new BadRequestException('TRACK_NOT_FOUND');
        }

        if (curator_user_id) {
          const curator = await tx.users.findFirst({
            where: { id: curator_user_id, tenant_id },
            select: { id: true },
          });
          if (!curator) throw new BadRequestException('CURATOR_NOT_FOUND');
        }
      });

      const created = await this.prisma.groups.create({
        data: {
          tenant_id,
          academic_year_id,
          campus_id,
          track_id,
          curator_user_id,
          name,
          grade,
        },
        include: {
          campuses: true,
          academic_years: true,
          student_tracks: true,
          users: true,
        },
      });

      await this.audit.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'CREATE',
        entityType: 'groups',
        entityId: created.id,
        afterData: created,
      });

      return created;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async update(
    tenantId: string,
    actorUserId: string | undefined,
    id: string,
    dto: UpdateGroupDto,
  ) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const actor_user_id = actorUserId
        ? toBigInt(actorUserId, 'actorUserId')
        : null;
      const group_id = toBigInt(id, 'id');

      const existing = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
      });
      if (!existing) throw new NotFoundException('GROUP_NOT_FOUND');

      const data: Prisma.groupsUpdateInput = {};

      if (dto.name !== undefined) {
        const name = normalizeName(dto.name);
        if (!name) throw new BadRequestException('INVALID_NAME');
        data.name = name;
      }

      if (dto.grade !== undefined) {
        const grade = Number(dto.grade);
        if (![10, 11].includes(grade))
          throw new BadRequestException('INVALID_GRADE');
        data.grade = grade;
      }

      if (dto.academicYearId !== undefined) {
        const academic_year_id = toBigInt(dto.academicYearId, 'academicYearId');
        const ay = await this.prisma.academic_years.findFirst({
          where: { id: academic_year_id, tenant_id },
          select: { id: true },
        });
        if (!ay) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');
        data.academic_years = { connect: { id: academic_year_id } };
      }

      if (dto.campusId !== undefined) {
        if (dto.campusId === null || String(dto.campusId).trim() === '') {
          data.campuses = { disconnect: true };
        } else {
          const campus_id = toBigInt(dto.campusId, 'campusId');
          const campus = await this.prisma.campuses.findFirst({
            where: { id: campus_id, tenant_id },
            select: { id: true },
          });
          if (!campus) throw new BadRequestException('CAMPUS_NOT_FOUND');
          data.campuses = { connect: { id: campus_id } };
        }
      }

      if (dto.trackId !== undefined) {
        if (dto.trackId === null || String(dto.trackId).trim() === '') {
          data.student_tracks = { disconnect: true };
        } else {
          const track_id = toBigInt(dto.trackId, 'trackId');
          const track = await this.prisma.student_tracks.findFirst({
            where: { id: track_id, tenant_id },
            select: { id: true },
          });
          if (!track) throw new BadRequestException('TRACK_NOT_FOUND');
          data.student_tracks = { connect: { id: track_id } };
        }
      }

      if (dto.curatorUserId !== undefined) {
        if (
          dto.curatorUserId === null ||
          String(dto.curatorUserId).trim() === ''
        ) {
          data.users = { disconnect: true };
        } else {
          const curator_user_id = toBigInt(dto.curatorUserId, 'curatorUserId');
          const curator = await this.prisma.users.findFirst({
            where: { id: curator_user_id, tenant_id },
            select: { id: true },
          });
          if (!curator) throw new BadRequestException('CURATOR_NOT_FOUND');
          data.users = { connect: { id: curator_user_id } };
        }
      }

      const updated = await this.prisma.groups.update({
        where: { id: group_id },
        data,
        include: {
          campuses: true,
          academic_years: true,
          student_tracks: true,
          users: true,
        },
      });

      await this.audit.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'UPDATE',
        entityType: 'groups',
        entityId: updated.id,
        beforeData: existing,
        afterData: updated,
      });

      return updated;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async remove(tenantId: string, actorUserId: string | undefined, id: string) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const actor_user_id = actorUserId
        ? toBigInt(actorUserId, 'actorUserId')
        : null;
      const group_id = toBigInt(id, 'id');

      const existing = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        include: {
          _count: {
            select: {
              students: true,
              assessments: true,
              attendance_sessions: true,
              timetable: true,
            },
          },
        },
      });
      if (!existing) throw new NotFoundException('GROUP_NOT_FOUND');

      if (
        existing._count.students > 0 ||
        existing._count.assessments > 0 ||
        existing._count.attendance_sessions > 0 ||
        existing._count.timetable > 0
      ) {
        throw new ConflictException('GROUP_HAS_DEPENDENCIES');
      }

      await this.prisma.groups.delete({ where: { id: group_id } });

      await this.audit.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'DELETE',
        entityType: 'groups',
        entityId: group_id,
        beforeData: existing,
      });

      return { ok: true };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async setSubjects(
    tenantId: string,
    actorUserId: string | undefined,
    groupId: string,
    dto: SetGroupSubjectsDto,
  ) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const actor_user_id = actorUserId
        ? toBigInt(actorUserId, 'actorUserId')
        : null;
      const group_id = toBigInt(groupId, 'groupId');

      const group = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        select: { id: true },
      });
      if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

      const subjectIds = uniqStrings(dto.subjectIds);
      if (subjectIds.length === 0)
        throw new BadRequestException('SUBJECTS_REQUIRED');

      const subjectIdsBig = subjectIds.map((x) => toBigInt(x, 'subjectId'));

      const existingSubjects = await this.prisma.subjects.findMany({
        where: { tenant_id, id: { in: subjectIdsBig } },
        select: { id: true },
      });

      if (existingSubjects.length !== subjectIdsBig.length) {
        throw new BadRequestException('SUBJECT_NOT_FOUND');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.group_subjects.deleteMany({ where: { group_id } });
        await tx.group_subjects.createMany({
          data: subjectIdsBig.map((sid) => ({ group_id, subject_id: sid })),
          skipDuplicates: true,
        });
      });

      await this.audit.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'UPDATE',
        entityType: 'group_subjects',
        entityId: group_id,
        afterData: { subjectIds },
      });

      return { ok: true, groupId, subjectIds };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async overview(tenantId: string, groupId: string) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const group_id = toBigInt(groupId, 'groupId');

      const g = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        include: {
          academic_years: true,
          campuses: true,
          student_tracks: true,
          users: true,
        },
      });
      if (!g) throw new NotFoundException('GROUP_NOT_FOUND');

      const since = new Date();
      since.setDate(since.getDate() - 30);

      // groupBy typing muammolarini 0 risk bilan yechish uchun cast qilamiz
      const studentsByStatus = (await this.prisma.students.groupBy({
        where: { tenant_id, current_group_id: group_id, archived_at: null },
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      })) as unknown as Array<{ status: string; _count: { _all: number } }>;

      const attendanceByStatus = (await this.prisma.attendance_marks.groupBy({
        where: {
          attendance_sessions: {
            tenant_id,
            group_id,
            session_date: { gte: since },
          },
        },
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      })) as unknown as Array<{ status: string; _count: { _all: number } }>;

      return {
        group: g,
        studentsStatus: studentsByStatus.map((r) => ({
          status: r.status,
          count: r._count._all,
        })),
        attendance30d: {
          since,
          byStatus: attendanceByStatus.map((r) => ({
            status: r.status,
            count: r._count._all,
          })),
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async stats(
    tenantId: string,
    q: { academicYearId?: string; campusId?: string },
  ) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');

      const where: Prisma.groupsWhereInput = {
        tenant_id,
        ...(q.academicYearId
          ? { academic_year_id: toBigInt(q.academicYearId, 'academicYearId') }
          : {}),
        ...(q.campusId ? { campus_id: toBigInt(q.campusId, 'campusId') } : {}),
      };

      const groupsByGrade = (await this.prisma.groups.groupBy({
        where,
        by: ['grade'],
        _count: { _all: true },
        orderBy: { grade: 'asc' },
      })) as unknown as Array<{ grade: number; _count: { _all: number } }>;

      const studentsByAdmissionGrade = (await this.prisma.students.groupBy({
        where: {
          tenant_id,
          archived_at: null,
          ...(q.academicYearId
            ? {
                groups: {
                  academic_year_id: toBigInt(
                    q.academicYearId,
                    'academicYearId',
                  ),
                },
              }
            : {}),
        },
        by: ['admission_grade'],
        _count: { _all: true },
        orderBy: { admission_grade: 'asc' },
      })) as unknown as Array<{
        admission_grade: number;
        _count: { _all: number };
      }>;

      return {
        groupsByGrade: groupsByGrade.map((x) => ({
          grade: x.grade,
          count: x._count._all,
        })),
        studentsByAdmissionGrade: studentsByAdmissionGrade.map((x) => ({
          admissionGrade: x.admission_grade,
          count: x._count._all,
        })),
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async clone(
    tenantId: string,
    actorUserId: string | undefined,
    sourceGroupId: string,
    dto: CloneGroupDto,
  ) {
    try {
      const tenant_id = toBigInt(tenantId, 'tenantId');
      const actor_user_id = actorUserId
        ? toBigInt(actorUserId, 'actorUserId')
        : null;
      const source_id = toBigInt(sourceGroupId, 'groupId');

      const source = await this.prisma.groups.findFirst({
        where: { id: source_id, tenant_id },
        include: { group_subjects: true },
      });
      if (!source) throw new NotFoundException('GROUP_NOT_FOUND');

      const name = normalizeName(dto.name);
      if (!name) throw new BadRequestException('INVALID_NAME');

      const academic_year_id = dto.academicYearId
        ? toBigInt(dto.academicYearId, 'academicYearId')
        : source.academic_year_id;

      const grade = dto.grade ?? source.grade;
      if (![10, 11].includes(Number(grade)))
        throw new BadRequestException('INVALID_GRADE');

      const ay = await this.prisma.academic_years.findFirst({
        where: { id: academic_year_id, tenant_id },
        select: { id: true },
      });
      if (!ay) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');

      const copySubjects = dto.copySubjects !== false;

      const created = await this.prisma.$transaction(async (tx) => {
        const createdGroup = await tx.groups.create({
          data: {
            tenant_id,
            academic_year_id,
            campus_id: source.campus_id,
            track_id: source.track_id,
            curator_user_id: source.curator_user_id,
            name,
            grade: Number(grade),
          },
        });

        if (copySubjects) {
          const rows = source.group_subjects.map((x) => ({
            group_id: createdGroup.id,
            subject_id: x.subject_id,
          }));
          if (rows.length) {
            await tx.group_subjects.createMany({
              data: rows,
              skipDuplicates: true,
            });
          }
        }

        return createdGroup;
      });

      await this.audit.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: actor_user_id,
        action: 'CREATE',
        entityType: 'groups',
        entityId: created.id,
        afterData: { sourceGroupId, createdGroupId: created.id, copySubjects },
      });

      return { ok: true, createdGroupId: String(created.id) };
    } catch (e) {
      mapPrismaError(e);
    }
  }
}
