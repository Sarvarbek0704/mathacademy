import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseBigIntId } from '../../common/utils/id.util';
import { parseDateOnly } from '../../common/utils/date.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: { tenantId: string }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');

      const rows = await this.prisma.academic_years.findMany({
        where: { tenant_id },
        orderBy: [{ is_current: 'desc' }, { start_date: 'desc' }],
      });

      return { data: rows };
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async detail(args: { tenantId: string; id: string }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');
      const id = parseBigIntId(args.id, 'id');

      const row = await this.prisma.academic_years.findFirst({
        where: { id, tenant_id },
      });

      if (!row) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');
      return row;
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async create(args: { tenantId: string; dto: CreateAcademicYearDto }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');

      const name = String(args.dto.name || '').trim();
      const start_date = parseDateOnly(args.dto.startDate, 'startDate');
      const end_date = parseDateOnly(args.dto.endDate, 'endDate');
      if (end_date.getTime() < start_date.getTime())
        throw new BadRequestException('END_BEFORE_START');

      const isCurrent = Boolean(args.dto.isCurrent);

      const created = await this.prisma.$transaction(async (tx) => {
        if (isCurrent) {
          await tx.academic_years.updateMany({
            where: { tenant_id, is_current: true },
            data: { is_current: false },
          });
        }

        return tx.academic_years.create({
          data: {
            tenants: { connect: { id: tenant_id } },
            name,
            start_date,
            end_date,
            is_current: isCurrent,
          },
        });
      });

      return created;
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async update(args: {
    tenantId: string;
    id: string;
    dto: UpdateAcademicYearDto;
  }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');
      const id = parseBigIntId(args.id, 'id');

      const existing = await this.prisma.academic_years.findFirst({
        where: { id, tenant_id },
      });
      if (!existing) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');

      const name = args.dto.name ? String(args.dto.name).trim() : existing.name;
      const start_date = args.dto.startDate
        ? parseDateOnly(args.dto.startDate, 'startDate')
        : existing.start_date;
      const end_date = args.dto.endDate
        ? parseDateOnly(args.dto.endDate, 'endDate')
        : existing.end_date;

      if (end_date.getTime() < start_date.getTime())
        throw new BadRequestException('END_BEFORE_START');

      const isCurrent =
        args.dto.isCurrent === undefined
          ? existing.is_current
          : Boolean(args.dto.isCurrent);

      const updated = await this.prisma.$transaction(async (tx) => {
        if (isCurrent) {
          await tx.academic_years.updateMany({
            where: { tenant_id, is_current: true, id: { not: id } },
            data: { is_current: false },
          });
        }

        return tx.academic_years.update({
          where: { id },
          data: { name, start_date, end_date, is_current: isCurrent },
        });
      });

      return updated;
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async setCurrent(args: { tenantId: string; id: string }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');
      const id = parseBigIntId(args.id, 'id');

      const exists = await this.prisma.academic_years.findFirst({
        where: { id, tenant_id },
      });
      if (!exists) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');

      await this.prisma.$transaction(async (tx) => {
        await tx.academic_years.updateMany({
          where: { tenant_id, is_current: true, id: { not: id } },
          data: { is_current: false },
        });
        await tx.academic_years.update({
          where: { id },
          data: { is_current: true },
        });
      });

      return { ok: true };
    } catch (e) {
      rethrowServiceError(e);
    }
  }

  async remove(args: { tenantId: string; id: string }) {
    try {
      const tenant_id = parseBigIntId(args.tenantId, 'tenantId');
      const id = parseBigIntId(args.id, 'id');

      const exists = await this.prisma.academic_years.findFirst({
        where: { id, tenant_id },
      });
      if (!exists) throw new NotFoundException('ACADEMIC_YEAR_NOT_FOUND');

      const groupsCount = await this.prisma.groups.count({
        where: { tenant_id, academic_year_id: id },
      });
      if (groupsCount > 0)
        throw new BadRequestException('ACADEMIC_YEAR_HAS_GROUPS');

      await this.prisma.academic_years.delete({ where: { id } });
      return { ok: true };
    } catch (e) {
      rethrowServiceError(e);
    }
  }
}
