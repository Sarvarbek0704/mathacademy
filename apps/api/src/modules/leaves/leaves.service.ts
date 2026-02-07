import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeavesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = BigInt(args.dto.studentId);

    const reason = String(args.dto.reason || '').trim();
    const startAt = String(args.dto.startAt);
    const endAt = String(args.dto.endAt);

    const requestedBy = String(args.dto.requestedBy || 'STUDENT_VERBAL');
    const notes = args.dto.notes ? String(args.dto.notes) : null;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    if (!reason) throw new BadRequestException('REASON_REQUIRED');

    // (oddiy validatsiya)
    const check = await this.prisma.$queryRaw<{ ok: boolean }[]>(
      Prisma.sql`SELECT (${endAt}::timestamptz >= ${startAt}::timestamptz) AS ok`,
    );
    if (!check[0]?.ok) throw new BadRequestException('END_BEFORE_START');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO leave_requests (
          tenant_id, student_id, requested_by, reason, start_at, end_at, status, notes
        )
        VALUES (
          ${tenantId}, ${studentId}, ${requestedBy}, ${reason},
          ${startAt}::timestamptz, ${endAt}::timestamptz,
          'PENDING', ${notes}
        )
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async list(args: {
    tenantId: string;
    studentId?: string;
    groupId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = args.studentId ? BigInt(args.studentId) : null;
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const status = args.status ? String(args.status) : null;
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          lr.id::text AS id,
          lr.student_id::text AS student_id,
          st.full_name,
          st.current_group_id::text AS group_id,
          g.name AS group_name,
          lr.requested_by,
          lr.reason,
          lr.start_at,
          lr.end_at,
          lr.status,
          lr.notes,
          lr.approved_by_user_id::text AS approved_by_user_id,
          lr.approved_at,
          lr.closed_at,
          lr.created_at
        FROM leave_requests lr
        JOIN students st ON st.id = lr.student_id
        LEFT JOIN groups g ON g.id = st.current_group_id
        WHERE lr.tenant_id=${tenantId}
          ${studentId ? Prisma.sql`AND lr.student_id=${studentId}` : Prisma.empty}
          ${groupId ? Prisma.sql`AND st.current_group_id=${groupId}` : Prisma.empty}
          ${status ? Prisma.sql`AND lr.status=${status}` : Prisma.empty}
          ${from ? Prisma.sql`AND lr.start_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND lr.end_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY lr.created_at DESC, lr.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async approve(args: {
    tenantId: string;
    userId: string;
    id: string;
    notes?: string;
  }) {
    return this.setDecision({
      ...args,
      status: 'APPROVED',
      setApproved: true,
      setClosed: false,
    });
  }

  async reject(args: {
    tenantId: string;
    userId: string;
    id: string;
    notes?: string;
  }) {
    return this.setDecision({
      ...args,
      status: 'REJECTED',
      setApproved: true,
      setClosed: false,
    });
  }

  async close(args: {
    tenantId: string;
    userId: string;
    id: string;
    notes?: string;
  }) {
    return this.setDecision({
      ...args,
      status: 'CLOSED',
      setApproved: false,
      setClosed: true,
    });
  }

  private async setDecision(args: {
    tenantId: string;
    userId: string;
    id: string;
    notes?: string;
    status: 'APPROVED' | 'REJECTED' | 'CLOSED';
    setApproved: boolean;
    setClosed: boolean;
  }) {
    const tenantId = BigInt(args.tenantId);
    const id = BigInt(args.id);
    const userId = BigInt(args.userId);
    const notes = args.notes ? String(args.notes) : null;

    const ex = await this.prisma.$queryRaw<{ id: bigint; status: string }[]>(
      Prisma.sql`SELECT id, status FROM leave_requests WHERE tenant_id=${tenantId} AND id=${id} LIMIT 1`,
    );
    if (!ex.length) throw new BadRequestException('LEAVE_NOT_FOUND');

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE leave_requests
        SET
          status = ${args.status},
          notes = COALESCE(${notes}, notes),
          approved_by_user_id = ${args.setApproved ? userId : Prisma.sql`approved_by_user_id`},
          approved_at = ${args.setApproved ? Prisma.sql`now()` : Prisma.sql`approved_at`},
          closed_at = ${args.setClosed ? Prisma.sql`now()` : Prisma.sql`closed_at`}
        WHERE tenant_id=${tenantId} AND id=${id}
      `,
    );

    return { ok: true };
  }

  async guardianList(args: {
    studentAccountId: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const studentAccountId = BigInt(args.studentAccountId);
    const status = args.status ? String(args.status) : null;
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;

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
          lr.id::text AS id,
          lr.requested_by,
          lr.reason,
          lr.start_at,
          lr.end_at,
          lr.status,
          lr.notes,
          lr.approved_at,
          lr.closed_at,
          lr.created_at
        FROM leave_requests lr
        WHERE lr.tenant_id=${tenantId}
          AND lr.student_id=${studentId}
          ${status ? Prisma.sql`AND lr.status=${status}` : Prisma.empty}
          ${from ? Prisma.sql`AND lr.start_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND lr.end_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY lr.created_at DESC, lr.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }
}
