import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(args: {
    tenantId: string;
    createdByUserId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const createdByUserId = args.createdByUserId
      ? BigInt(args.createdByUserId)
      : null;

    const groupId = BigInt(args.dto.groupId);
    const type = String(args.dto.type);
    const sessionDate = String(args.dto.sessionDate); // YYYY-MM-DD

    // group exists?
    const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM groups WHERE tenant_id=${tenantId} AND id=${groupId} LIMIT 1`,
    );
    if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

    // insert or get existing (unique: group_id + session_date + type)
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        WITH ins AS (
          INSERT INTO attendance_sessions (tenant_id, group_id, session_date, type, created_by_user_id, created_at)
          VALUES (${tenantId}, ${groupId}, ${sessionDate}::date, ${type}, ${createdByUserId}, now())
          ON CONFLICT (group_id, session_date, type) DO NOTHING
          RETURNING id
        )
        SELECT id FROM ins
        UNION ALL
        SELECT id FROM attendance_sessions
        WHERE tenant_id=${tenantId} AND group_id=${groupId} AND session_date=${sessionDate}::date AND type=${type}
        LIMIT 1
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async listSessions(args: {
    tenantId: string;
    groupId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = args.groupId ? BigInt(args.groupId) : null;

    const dateFrom = args.dateFrom ? String(args.dateFrom) : null;
    const dateTo = args.dateTo ? String(args.dateTo) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT s.id, s.group_id, g.name AS group_name, s.session_date, s.type, s.created_at
        FROM attendance_sessions s
        JOIN groups g ON g.id = s.group_id
        WHERE s.tenant_id = ${tenantId}
          ${groupId ? Prisma.sql`AND s.group_id = ${groupId}` : Prisma.empty}
          ${dateFrom ? Prisma.sql`AND s.session_date >= ${dateFrom}::date` : Prisma.empty}
          ${dateTo ? Prisma.sql`AND s.session_date <= ${dateTo}::date` : Prisma.empty}
        ORDER BY s.session_date DESC, s.id DESC
        LIMIT 100
      `,
    );

    return { data: rows };
  }

  async upsertMarks(args: { tenantId: string; sessionId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const sessionId = BigInt(args.sessionId);
    const marks: { studentId: string; status: string; note?: string }[] =
      args.dto.marks || [];

    // session belongs to tenant?
    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM attendance_sessions WHERE tenant_id=${tenantId} AND id=${sessionId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('SESSION_NOT_FOUND');

    // upsert each row (PK: session_id + student_id)
    for (const m of marks) {
      const studentId = BigInt(m.studentId);
      const status = String(m.status);
      const note = m.note ? String(m.note) : null;

      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO attendance_marks (session_id, student_id, status, note)
          VALUES (${sessionId}, ${studentId}, ${status}, ${note})
          ON CONFLICT (session_id, student_id)
          DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note
        `,
      );
    }

    return { ok: true };
  }

  async guardianList(args: {
    studentAccountId: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const studentAccountId = BigInt(args.studentAccountId);
    const dateFrom = args.dateFrom ? String(args.dateFrom) : null;
    const dateTo = args.dateTo ? String(args.dateTo) : null;

    const base = await this.prisma.$queryRaw<
      { student_id: bigint; tenant_id: bigint }[]
    >(
      Prisma.sql`
        SELECT sa.student_id, s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.id = ${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const studentId = base[0].student_id;
    const tenantId = base[0].tenant_id;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          ses.session_date,
          ses.type,
          g.name AS group_name,
          m.status,
          m.note
        FROM attendance_marks m
        JOIN attendance_sessions ses ON ses.id = m.session_id
        JOIN groups g ON g.id = ses.group_id
        WHERE m.student_id = ${studentId}
          AND ses.tenant_id = ${tenantId}
          ${dateFrom ? Prisma.sql`AND ses.session_date >= ${dateFrom}::date` : Prisma.empty}
          ${dateTo ? Prisma.sql`AND ses.session_date <= ${dateTo}::date` : Prisma.empty}
        ORDER BY ses.session_date DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }
}
