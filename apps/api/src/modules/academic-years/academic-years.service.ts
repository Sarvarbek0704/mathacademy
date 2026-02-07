import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: { tenantId: string }) {
    const tenantId = BigInt(args.tenantId || '0');
    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT ay.*
        FROM academic_years ay
        WHERE ay.tenant_id = ${tenantId}
        ORDER BY ay.id DESC
      `,
    );
    return { data: rows };
  }
}
