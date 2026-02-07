import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: {
    tenantId: string;
    academicYearId?: string;
    grade?: string;
  }) {
    const tenantId = BigInt(args.tenantId || '0');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT g.*
        FROM groups g
        WHERE g.tenant_id = ${tenantId}
          ${args.academicYearId ? Prisma.sql`AND g.academic_year_id = ${BigInt(args.academicYearId)}` : Prisma.empty}
          ${args.grade ? Prisma.sql`AND g.grade = ${Number(args.grade)}` : Prisma.empty}
        ORDER BY g.id DESC
      `,
    );

    return { data: rows };
  }

  async create(args: {
    tenantId: string;
    dto: { name: string; grade: number; academicYearId: string };
  }) {
    const tenantId = BigInt(args.tenantId || '0');

    const ayId = BigInt(args.dto.academicYearId);

    const ok = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
    SELECT id
    FROM academic_years
    WHERE tenant_id = ${tenantId} AND id = ${ayId}
    LIMIT 1
  `,
    );

    if (!ok.length) throw new BadRequestException('ACADEMIC_YEAR_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO groups (tenant_id, academic_year_id, grade, name, created_at)
        VALUES (${tenantId}, ${BigInt(args.dto.academicYearId)}, ${args.dto.grade}, ${args.dto.name}, now())
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }
}
