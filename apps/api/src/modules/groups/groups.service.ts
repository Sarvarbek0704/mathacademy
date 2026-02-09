import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClientKnownRequestError } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function toBigInt(v: unknown, field: string): bigint {
  const s = String(v ?? '').trim();
  if (!s || !/^\d+$/.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function prismaErrorToHttp(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictException('UNIQUE_CONSTRAINT');
    if (e.code === 'P2003') throw new ConflictException('FK_CONSTRAINT');
    if (e.code === 'P2025') throw new NotFoundException('NOT_FOUND');
  }
  throw e;
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: {
    tenantId: string;
    academicYearId?: string;
    grade?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');

      const where: Prisma.groupsWhereInput = {
        tenant_id,
        ...(args.academicYearId
          ? {
              academic_year_id: toBigInt(args.academicYearId, 'academicYearId'),
            }
          : {}),
        ...(args.grade ? { grade: Number(args.grade) } : {}),
      };

      const rows = await this.prisma.groups.findMany({
        where,
        orderBy: { id: 'desc' },
        include: {
          academic_years: {
            select: { id: true, name: true, start_date: true, end_date: true },
          },
          campuses: { select: { id: true, name: true } },
          student_tracks: { select: { id: true, name: true } },
          // ✅ curator relation nomi schema’da "users"
          users: { select: { id: true, username: true, full_name: true } },
        },
      });

      return { data: rows };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async detail(args: { tenantId: string; groupId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.groupId, 'groupId');

      const row = await this.prisma.groups.findFirst({
        where: { id, tenant_id },
        include: {
          academic_years: {
            select: { id: true, name: true, start_date: true, end_date: true },
          },
          campuses: { select: { id: true, name: true } },
          student_tracks: { select: { id: true, name: true } },
          users: { select: { id: true, username: true, full_name: true } },
          group_subjects: {
            include: {
              subjects: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!row) throw new NotFoundException('GROUP_NOT_FOUND');

      return {
        ...row,
        subjects: row.group_subjects.map((gs) => gs.subjects),
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async create(args: {
    tenantId: string;
    dto: {
      name: string;
      grade: number;
      academicYearId: string;
      campusId?: string;
      curatorUserId?: string;
      trackId?: string;
      subjectIds?: string[];
    };
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const name = String(args.dto.name || '').trim();
      const grade = Number(args.dto.grade);

      if (!name) throw new BadRequestException('NAME_REQUIRED');
      if (![10, 11].includes(grade))
        throw new BadRequestException('INVALID_GRADE');

      const academic_year_id = toBigInt(
        args.dto.academicYearId,
        'academicYearId',
      );

      const ay = await this.prisma.academic_years.findFirst({
        where: { id: academic_year_id, tenant_id },
        select: { id: true },
      });
      if (!ay) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');

      const campus_id = args.dto.campusId
        ? toBigInt(args.dto.campusId, 'campusId')
        : null;
      const curator_user_id = args.dto.curatorUserId
        ? toBigInt(args.dto.curatorUserId, 'curatorUserId')
        : null;
      const track_id = args.dto.trackId
        ? toBigInt(args.dto.trackId, 'trackId')
        : null;

      const created = await this.prisma.$transaction(async (tx) => {
        if (campus_id) {
          const c = await tx.campuses.findFirst({
            where: { id: campus_id, tenant_id },
            select: { id: true },
          });
          if (!c) throw new BadRequestException('CAMPUS_NOT_FOUND');
        }
        if (curator_user_id) {
          const u = await tx.users.findFirst({
            where: { id: curator_user_id, tenant_id },
            select: { id: true },
          });
          if (!u) throw new BadRequestException('CURATOR_NOT_FOUND');
        }
        if (track_id) {
          const t = await tx.student_tracks.findFirst({
            where: { id: track_id, tenant_id },
            select: { id: true },
          });
          if (!t) throw new BadRequestException('TRACK_NOT_FOUND');
        }

        const group = await tx.groups.create({
          data: {
            name,
            grade,
            tenants: { connect: { id: tenant_id } },
            academic_years: { connect: { id: academic_year_id } },
            ...(campus_id ? { campuses: { connect: { id: campus_id } } } : {}),
            ...(curator_user_id
              ? { users: { connect: { id: curator_user_id } } }
              : {}),
            ...(track_id
              ? { student_tracks: { connect: { id: track_id } } }
              : {}),
          },
          select: { id: true },
        });

        const subjectIds = Array.isArray(args.dto.subjectIds)
          ? args.dto.subjectIds
          : [];
        if (subjectIds.length) {
          const subjBig = subjectIds.map((x) => toBigInt(x, 'subjectId'));
          const found = await tx.subjects.findMany({
            where: { tenant_id, id: { in: subjBig } },
            select: { id: true },
          });
          if (found.length !== subjBig.length)
            throw new BadRequestException('SUBJECT_NOT_FOUND');

          await tx.group_subjects.createMany({
            data: subjBig.map((sid) => ({
              group_id: group.id,
              subject_id: sid,
            })),
            skipDuplicates: true,
          });
        }

        return group;
      });

      return { id: created.id.toString() };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async update(args: {
    tenantId: string;
    groupId: string;
    dto: {
      name?: string;
      grade?: number;
      academicYearId?: string;
      campusId?: string | null;
      curatorUserId?: string | null;
      trackId?: string | null;
    };
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.groupId, 'groupId');

      const exists = await this.prisma.groups.findFirst({
        where: { id, tenant_id },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('GROUP_NOT_FOUND');

      const data: Prisma.groupsUpdateInput = {};

      if (args.dto.name !== undefined) {
        const name = String(args.dto.name || '').trim();
        if (!name) throw new BadRequestException('NAME_REQUIRED');
        data.name = name;
      }

      if (args.dto.grade !== undefined) {
        const grade = Number(args.dto.grade);
        if (![10, 11].includes(grade))
          throw new BadRequestException('INVALID_GRADE');
        data.grade = grade;
      }

      if (args.dto.academicYearId !== undefined) {
        const ayId = toBigInt(args.dto.academicYearId, 'academicYearId');
        const ay = await this.prisma.academic_years.findFirst({
          where: { id: ayId, tenant_id },
          select: { id: true },
        });
        if (!ay) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');
        data.academic_years = { connect: { id: ayId } };
      }

      if (args.dto.campusId !== undefined) {
        if (
          args.dto.campusId === null ||
          String(args.dto.campusId).trim() === ''
        ) {
          data.campuses = { disconnect: true };
        } else {
          const campusId = toBigInt(args.dto.campusId, 'campusId');
          const c = await this.prisma.campuses.findFirst({
            where: { id: campusId, tenant_id },
            select: { id: true },
          });
          if (!c) throw new BadRequestException('CAMPUS_NOT_FOUND');
          data.campuses = { connect: { id: campusId } };
        }
      }

      if (args.dto.curatorUserId !== undefined) {
        if (
          args.dto.curatorUserId === null ||
          String(args.dto.curatorUserId).trim() === ''
        ) {
          data.users = { disconnect: true };
        } else {
          const curatorId = toBigInt(args.dto.curatorUserId, 'curatorUserId');
          const u = await this.prisma.users.findFirst({
            where: { id: curatorId, tenant_id },
            select: { id: true },
          });
          if (!u) throw new BadRequestException('CURATOR_NOT_FOUND');
          data.users = { connect: { id: curatorId } };
        }
      }

      if (args.dto.trackId !== undefined) {
        if (
          args.dto.trackId === null ||
          String(args.dto.trackId).trim() === ''
        ) {
          data.student_tracks = { disconnect: true };
        } else {
          const trackId = toBigInt(args.dto.trackId, 'trackId');
          const t = await this.prisma.student_tracks.findFirst({
            where: { id: trackId, tenant_id },
            select: { id: true },
          });
          if (!t) throw new BadRequestException('TRACK_NOT_FOUND');
          data.student_tracks = { connect: { id: trackId } };
        }
      }

      await this.prisma.groups.update({ where: { id }, data });

      return { ok: true };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async remove(args: { tenantId: string; groupId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.groupId, 'groupId');

      const row = await this.prisma.groups.findFirst({
        where: { id, tenant_id },
        select: { id: true },
      });
      if (!row) throw new NotFoundException('GROUP_NOT_FOUND');

      try {
        await this.prisma.groups.delete({ where: { id } });
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2003') {
          throw new ConflictException('GROUP_HAS_DEPENDENCIES');
        }
        throw e;
      }

      return { ok: true };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async setSubjects(args: {
    tenantId: string;
    groupId: string;
    subjectIds: string[];
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const group_id = toBigInt(args.groupId, 'groupId');

      const g = await this.prisma.groups.findFirst({
        where: { id: group_id, tenant_id },
        select: { id: true },
      });
      if (!g) throw new NotFoundException('GROUP_NOT_FOUND');

      const ids = Array.isArray(args.subjectIds) ? args.subjectIds : [];
      const subjIds = ids.map((x) => toBigInt(x, 'subjectId'));

      const found = await this.prisma.subjects.findMany({
        where: { tenant_id, id: { in: subjIds } },
        select: { id: true },
      });
      if (found.length !== subjIds.length)
        throw new BadRequestException('SUBJECT_NOT_FOUND');

      await this.prisma.$transaction(async (tx) => {
        await tx.group_subjects.deleteMany({ where: { group_id } });
        if (subjIds.length) {
          await tx.group_subjects.createMany({
            data: subjIds.map((sid) => ({ group_id, subject_id: sid })),
            skipDuplicates: true,
          });
        }
      });

      return { ok: true };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }
}
