import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AwardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: { tenantId: string; userId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const userId = args.userId ? BigInt(args.userId) : null;

    const awardType = String(args.dto.awardType || '').trim();
    const title = String(args.dto.title || '').trim();
    const description = args.dto.description
      ? String(args.dto.description)
      : null;
    const valueAmount = args.dto.valueAmount
      ? String(args.dto.valueAmount)
      : null;
    const issuedAt = args.dto.issuedAt ? String(args.dto.issuedAt) : null;

    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO awards (tenant_id, award_type, title, description, value_amount, issued_at, issued_by_user_id)
        VALUES (
          ${tenantId}, ${awardType}, ${title}, ${description},
          ${valueAmount ? Prisma.sql`${valueAmount}::decimal` : Prisma.sql`NULL`},
          ${issuedAt ? Prisma.sql`${issuedAt}::timestamptz` : Prisma.sql`now()`},
          ${userId}
        )
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async list(args: {
    tenantId: string;
    from?: string;
    to?: string;
    q?: string;
    awardType?: string;
    limit?: string;
    offset?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    const q = args.q ? String(args.q).trim() : null;
    const awardType = args.awardType ? String(args.awardType).trim() : null;

    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const offset = Math.max(Number(args.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          a.id::text AS id,
          a.award_type,
          a.title,
          a.description,
          a.value_amount,
          a.issued_at,
          a.issued_by_user_id::text AS issued_by_user_id
        FROM awards a
        WHERE a.tenant_id=${tenantId}
          ${awardType ? Prisma.sql`AND a.award_type=${awardType}` : Prisma.empty}
          ${from ? Prisma.sql`AND a.issued_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND a.issued_at <= ${to}::timestamptz` : Prisma.empty}
          ${q ? Prisma.sql`AND (a.title ILIKE ${'%' + q + '%'} OR COALESCE(a.description,'') ILIKE ${'%' + q + '%'})` : Prisma.empty}
        ORDER BY a.issued_at DESC, a.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async setRecipients(args: { tenantId: string; awardId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const awardId = BigInt(args.awardId);

    const a = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM awards WHERE tenant_id=${tenantId} AND id=${awardId} LIMIT 1`,
    );
    if (!a.length) throw new BadRequestException('AWARD_NOT_FOUND');

    const note = args.dto.note ? String(args.dto.note) : null;
    const studentIds: string[] = Array.isArray(args.dto.studentIds)
      ? args.dto.studentIds
      : [];
    const groupIds: string[] = Array.isArray(args.dto.groupIds)
      ? args.dto.groupIds
      : [];

    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM award_recipients WHERE award_id=${awardId}`,
    );

    let added = 0;

    // STUDENT recipients (group_id is required => take from students.current_group_id)
    if (studentIds.length) {
      const ids = studentIds.map((x) => BigInt(x));
      const students = await this.prisma.$queryRaw<
        { id: bigint; current_group_id: bigint | null }[]
      >(
        Prisma.sql`
          SELECT id, current_group_id
          FROM students
          WHERE tenant_id=${tenantId} AND id IN (${Prisma.join(ids)})
        `,
      );

      for (const s of students) {
        if (!s.current_group_id) continue;
        await this.prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO award_recipients (award_id, recipient_type, student_id, group_id, note)
            VALUES (${awardId}, 'STUDENT', ${s.id}, ${s.current_group_id}, ${note})
          `,
        );
        added++;
      }
    }

    // GROUP recipients => expand group students, recipient_type='GROUP'
    if (groupIds.length) {
      for (const gidStr of groupIds) {
        const gid = BigInt(gidStr);
        const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
          Prisma.sql`SELECT id FROM groups WHERE tenant_id=${tenantId} AND id=${gid} LIMIT 1`,
        );
        if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

        const students = await this.prisma.$queryRaw<{ id: bigint }[]>(
          Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND current_group_id=${gid}`,
        );

        for (const s of students) {
          await this.prisma.$executeRaw(
            Prisma.sql`
              INSERT INTO award_recipients (award_id, recipient_type, student_id, group_id, note)
              VALUES (${awardId}, 'GROUP', ${s.id}, ${gid}, ${note})
            `,
          );
          added++;
        }
      }
    }

    return { ok: true, added };
  }

  async recipients(args: { tenantId: string; awardId: string }) {
    const tenantId = BigInt(args.tenantId);
    const awardId = BigInt(args.awardId);

    const a = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM awards WHERE tenant_id=${tenantId} AND id=${awardId} LIMIT 1`,
    );
    if (!a.length) throw new BadRequestException('AWARD_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          ar.recipient_type,
          ar.student_id::text AS student_id,
          st.full_name,
          ar.group_id::text AS group_id,
          g.name AS group_name,
          ar.note
        FROM award_recipients ar
        JOIN students st ON st.id = ar.student_id
        JOIN groups g ON g.id = ar.group_id
        WHERE ar.award_id=${awardId}
        ORDER BY ar.recipient_type ASC, st.id ASC
      `,
    );

    return { data: rows };
  }

  async guardianList(args: { studentAccountId: string }) {
    const studentAccountId = BigInt(args.studentAccountId);

    const base = await this.prisma.$queryRaw<
      { student_id: bigint; tenant_id: bigint }[]
    >(
      Prisma.sql`
        SELECT sa.student_id, s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const studentId = base[0].student_id;
    const tenantId = base[0].tenant_id;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          a.id::text AS id,
          a.award_type,
          a.title,
          a.description,
          a.value_amount,
          a.issued_at,
          ar.recipient_type,
          ar.group_id::text AS group_id,
          g.name AS group_name,
          ar.note
        FROM award_recipients ar
        JOIN awards a ON a.id = ar.award_id
        JOIN groups g ON g.id = ar.group_id
        WHERE ar.student_id=${studentId}
          AND a.tenant_id=${tenantId}
        ORDER BY a.issued_at DESC, a.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }
}
