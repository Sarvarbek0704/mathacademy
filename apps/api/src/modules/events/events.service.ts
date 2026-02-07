import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: { tenantId: string; userId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const userId = args.userId ? BigInt(args.userId) : null;

    const title = String(args.dto.title || '').trim();
    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const campusId = args.dto.campusId ? BigInt(args.dto.campusId) : null;

    const eventType = String(args.dto.eventType || 'OTHER');
    const allowedTypes = ['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'];
    if (!allowedTypes.includes(eventType))
      throw new BadRequestException('INVALID_EVENT_TYPE');

    const startsAt = String(args.dto.startsAt);
    const endsAt = args.dto.endsAt ? String(args.dto.endsAt) : null;
    const description = args.dto.description
      ? String(args.dto.description)
      : null;

    if (campusId) {
      const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM campuses WHERE tenant_id=${tenantId} AND id=${campusId} LIMIT 1`,
      );
      if (!c.length) throw new BadRequestException('CAMPUS_NOT_FOUND');
    }

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO events (
          tenant_id, campus_id, title, event_type, starts_at, ends_at, description, created_by_user_id
        )
        VALUES (
          ${tenantId}, ${campusId}, ${title}, ${eventType},
          ${startsAt}::timestamptz,
          ${endsAt ? Prisma.sql`${endsAt}::timestamptz` : Prisma.sql`NULL`},
          ${description},
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
    campusId?: string;
    eventType?: string;
    limit?: string;
    offset?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    const q = args.q ? String(args.q).trim() : null;
    const campusId = args.campusId ? BigInt(args.campusId) : null;
    const eventType = args.eventType ? String(args.eventType) : null;

    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const offset = Math.max(Number(args.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          e.id::text AS id,
          e.campus_id::text AS campus_id,
          e.title,
          e.event_type,
          e.starts_at,
          e.ends_at,
          e.description,
          e.created_by_user_id::text AS created_by_user_id,
          e.created_at
        FROM events e
        WHERE e.tenant_id=${tenantId}
          ${campusId ? Prisma.sql`AND e.campus_id=${campusId}` : Prisma.empty}
          ${eventType ? Prisma.sql`AND e.event_type=${eventType}` : Prisma.empty}
          ${from ? Prisma.sql`AND e.starts_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND (COALESCE(e.ends_at, e.starts_at) <= ${to}::timestamptz)` : Prisma.empty}
          ${
            q
              ? Prisma.sql`AND (e.title ILIKE ${'%' + q + '%'} OR COALESCE(e.description,'') ILIKE ${'%' + q + '%'})`
              : Prisma.empty
          }
        ORDER BY e.starts_at DESC, e.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async setParticipants(args: { tenantId: string; eventId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const eventId = BigInt(args.eventId);

    const studentIds: string[] = Array.isArray(args.dto.studentIds)
      ? args.dto.studentIds
      : [];
    const role = args.dto.role ? String(args.dto.role) : 'PARTICIPANT';
    const groupId = args.dto.groupId ? BigInt(args.dto.groupId) : null;

    const e = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM events WHERE tenant_id=${tenantId} AND id=${eventId} LIMIT 1`,
    );
    if (!e.length) throw new BadRequestException('EVENT_NOT_FOUND');

    if (groupId) {
      const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM groups WHERE tenant_id=${tenantId} AND id=${groupId} LIMIT 1`,
      );
      if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');
    }

    // replace strategy
    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM event_participants WHERE event_id=${eventId}`,
    );

    if (!studentIds.length) return { ok: true, added: 0 };

    const ids = studentIds.map((x) => BigInt(x));

    const allowed = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT id
        FROM students
        WHERE tenant_id=${tenantId}
          ${groupId ? Prisma.sql`AND current_group_id=${groupId}` : Prisma.empty}
          AND id IN (${Prisma.join(ids)})
      `,
    );

    for (const r of allowed) {
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO event_participants (event_id, student_id, role)
          VALUES (${eventId}, ${r.id}, ${role})
        `,
      );
    }

    return { ok: true, added: allowed.length };
  }

  async participants(args: { tenantId: string; eventId: string }) {
    const tenantId = BigInt(args.tenantId);
    const eventId = BigInt(args.eventId);

    const e = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM events WHERE tenant_id=${tenantId} AND id=${eventId} LIMIT 1`,
    );
    if (!e.length) throw new BadRequestException('EVENT_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          ep.student_id::text AS student_id,
          st.full_name,
          st.current_group_id::text AS group_id,
          ep.role
        FROM event_participants ep
        JOIN students st ON st.id = ep.student_id
        WHERE ep.event_id=${eventId}
        ORDER BY st.id ASC
      `,
    );

    return { data: rows };
  }

  async guardianList(args: {
    studentAccountId: string;
    from?: string;
    to?: string;
  }) {
    const studentAccountId = BigInt(args.studentAccountId);
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
          e.id::text AS id,
          e.campus_id::text AS campus_id,
          e.title,
          e.event_type,
          e.starts_at,
          e.ends_at,
          e.description,
          ep.role
        FROM event_participants ep
        JOIN events e ON e.id = ep.event_id
        WHERE ep.student_id=${studentId}
          AND e.tenant_id=${tenantId}
          ${from ? Prisma.sql`AND e.starts_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND (COALESCE(e.ends_at, e.starts_at) <= ${to}::timestamptz)` : Prisma.empty}
        ORDER BY e.starts_at DESC, e.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }
}
