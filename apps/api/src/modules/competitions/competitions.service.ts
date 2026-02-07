import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);

    const title = String(args.dto.title || '').trim();
    const mode = String(args.dto.mode || '').trim();
    const startsAt = String(args.dto.startsAt);
    const endsAt = args.dto.endsAt ? String(args.dto.endsAt) : null;
    const rules = args.dto.rules ? String(args.dto.rules) : null;

    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO competitions (tenant_id, title, mode, starts_at, ends_at, rules)
        VALUES (
          ${tenantId}, ${title}, ${mode},
          ${startsAt}::timestamptz,
          ${endsAt ? Prisma.sql`${endsAt}::timestamptz` : Prisma.sql`NULL`},
          ${rules}
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
    mode?: string;
    limit?: string;
    offset?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    const q = args.q ? String(args.q).trim() : null;
    const mode = args.mode ? String(args.mode).trim() : null;

    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const offset = Math.max(Number(args.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          c.id::text AS id,
          c.title,
          c.mode,
          c.starts_at,
          c.ends_at,
          c.rules,
          c.created_at
        FROM competitions c
        WHERE c.tenant_id=${tenantId}
          ${mode ? Prisma.sql`AND c.mode=${mode}` : Prisma.empty}
          ${from ? Prisma.sql`AND c.starts_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND (COALESCE(c.ends_at, c.starts_at) <= ${to}::timestamptz)` : Prisma.empty}
          ${q ? Prisma.sql`AND (c.title ILIKE ${'%' + q + '%'} OR COALESCE(c.rules,'') ILIKE ${'%' + q + '%'})` : Prisma.empty}
        ORDER BY c.starts_at DESC, c.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async setEntries(args: {
    tenantId: string;
    competitionId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const competitionId = BigInt(args.competitionId);
    const entries = Array.isArray(args.dto.entries) ? args.dto.entries : [];

    const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM competitions WHERE tenant_id=${tenantId} AND id=${competitionId} LIMIT 1`,
    );
    if (!c.length) throw new BadRequestException('COMPETITION_NOT_FOUND');

    // replace
    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM competition_entries WHERE competition_id=${competitionId}`,
    );

    let added = 0;

    for (const e of entries) {
      const entryType = String(e.entryType || '').trim();
      const studentId = e.studentId ? BigInt(e.studentId) : null;
      const groupId = e.groupId ? BigInt(e.groupId) : null;

      let nameDisplay = e.nameDisplay ? String(e.nameDisplay).trim() : '';

      if (entryType === 'STUDENT') {
        if (!studentId) throw new BadRequestException('STUDENT_ID_REQUIRED');
        const s = await this.prisma.$queryRaw<
          { full_name: string; current_group_id: bigint | null }[]
        >(
          Prisma.sql`SELECT full_name, current_group_id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
        );
        if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');
        if (!nameDisplay) nameDisplay = s[0].full_name;
        const g = s[0].current_group_id;

        await this.prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO competition_entries (competition_id, entry_type, student_id, group_id, name_display)
            VALUES (${competitionId}, ${entryType}, ${studentId}, ${g}, ${nameDisplay})
          `,
        );
        added++;
        continue;
      }

      if (entryType === 'GROUP') {
        if (!groupId) throw new BadRequestException('GROUP_ID_REQUIRED');
        const g = await this.prisma.$queryRaw<{ name: string }[]>(
          Prisma.sql`SELECT name FROM groups WHERE tenant_id=${tenantId} AND id=${groupId} LIMIT 1`,
        );
        if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');
        if (!nameDisplay) nameDisplay = g[0].name;

        await this.prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO competition_entries (competition_id, entry_type, student_id, group_id, name_display)
            VALUES (${competitionId}, ${entryType}, NULL, ${groupId}, ${nameDisplay})
          `,
        );
        added++;
        continue;
      }

      // TEAM / DORM
      if (!nameDisplay) throw new BadRequestException('NAME_DISPLAY_REQUIRED');
      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO competition_entries (competition_id, entry_type, student_id, group_id, name_display)
          VALUES (${competitionId}, ${entryType}, ${studentId}, ${groupId}, ${nameDisplay})
        `,
      );
      added++;
    }

    return { ok: true, added };
  }

  async entries(args: { tenantId: string; competitionId: string }) {
    const tenantId = BigInt(args.tenantId);
    const competitionId = BigInt(args.competitionId);

    const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM competitions WHERE tenant_id=${tenantId} AND id=${competitionId} LIMIT 1`,
    );
    if (!c.length) throw new BadRequestException('COMPETITION_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          entry_type,
          student_id::text AS student_id,
          group_id::text AS group_id,
          name_display,
          created_at
        FROM competition_entries
        WHERE competition_id=${competitionId}
        ORDER BY id ASC
      `,
    );

    return { data: rows };
  }

  async setResults(args: {
    tenantId: string;
    competitionId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const competitionId = BigInt(args.competitionId);
    const results = Array.isArray(args.dto.results) ? args.dto.results : [];

    const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM competitions WHERE tenant_id=${tenantId} AND id=${competitionId} LIMIT 1`,
    );
    if (!c.length) throw new BadRequestException('COMPETITION_NOT_FOUND');

    let upserts = 0;

    for (const r of results) {
      const entryId = BigInt(r.entryId);
      const rank = Number(r.rank);
      const prize = r.prize ? String(r.prize) : null;
      const score = r.score ? String(r.score) : null;

      // entry belongs to competition
      const e = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM competition_entries WHERE competition_id=${competitionId} AND id=${entryId} LIMIT 1`,
      );
      if (!e.length) throw new BadRequestException('ENTRY_NOT_FOUND');

      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO competition_results (competition_id, entry_id, rank, score, prize)
          VALUES (
            ${competitionId}, ${entryId}, ${rank},
            ${score ? Prisma.sql`${score}::decimal` : Prisma.sql`NULL`},
            ${prize}
          )
          ON CONFLICT (competition_id, entry_id)
          DO UPDATE SET
            rank = EXCLUDED.rank,
            score = EXCLUDED.score,
            prize = EXCLUDED.prize
        `,
      );
      upserts++;
    }

    return { ok: true, upserts };
  }

  async results(args: { tenantId: string; competitionId: string }) {
    const tenantId = BigInt(args.tenantId);
    const competitionId = BigInt(args.competitionId);

    const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM competitions WHERE tenant_id=${tenantId} AND id=${competitionId} LIMIT 1`,
    );
    if (!c.length) throw new BadRequestException('COMPETITION_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          cr.entry_id::text AS entry_id,
          ce.name_display,
          ce.entry_type,
          ce.student_id::text AS student_id,
          ce.group_id::text AS group_id,
          cr.rank,
          cr.score,
          cr.prize
        FROM competition_results cr
        JOIN competition_entries ce ON ce.id = cr.entry_id
        WHERE cr.competition_id=${competitionId}
        ORDER BY cr.rank ASC, cr.entry_id ASC
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
      {
        student_id: bigint;
        tenant_id: bigint;
        current_group_id: bigint | null;
      }[]
    >(
      Prisma.sql`
        SELECT sa.student_id, s.tenant_id, s.current_group_id
        FROM student_accounts sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const studentId = base[0].student_id;
    const tenantId = base[0].tenant_id;
    const groupId = base[0].current_group_id;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT DISTINCT
          c.id::text AS id,
          c.title,
          c.mode,
          c.starts_at,
          c.ends_at,
          c.rules
        FROM competitions c
        JOIN competition_entries ce ON ce.competition_id = c.id
        WHERE c.tenant_id=${tenantId}
          AND (
            (ce.entry_type='STUDENT' AND ce.student_id=${studentId})
            ${groupId ? Prisma.sql`OR (ce.entry_type='GROUP' AND ce.group_id=${groupId})` : Prisma.empty}
          )
          ${from ? Prisma.sql`AND c.starts_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND (COALESCE(c.ends_at, c.starts_at) <= ${to}::timestamptz)` : Prisma.empty}
        ORDER BY c.starts_at DESC, c.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async guardianResult(args: {
    studentAccountId: string;
    competitionId: string;
  }) {
    const studentAccountId = BigInt(args.studentAccountId);
    const competitionId = BigInt(args.competitionId);

    const base = await this.prisma.$queryRaw<
      {
        student_id: bigint;
        tenant_id: bigint;
        current_group_id: bigint | null;
      }[]
    >(
      Prisma.sql`
        SELECT sa.student_id, s.tenant_id, s.current_group_id
        FROM student_accounts sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const studentId = base[0].student_id;
    const tenantId = base[0].tenant_id;
    const groupId = base[0].current_group_id;

    // student entry first, else group entry
    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          ce.id::text AS entry_id,
          ce.name_display,
          ce.entry_type,
          cr.rank,
          cr.score,
          cr.prize
        FROM competitions c
        JOIN competition_entries ce ON ce.competition_id=c.id
        LEFT JOIN competition_results cr ON cr.competition_id=c.id AND cr.entry_id=ce.id
        WHERE c.tenant_id=${tenantId} AND c.id=${competitionId}
          AND (
            (ce.entry_type='STUDENT' AND ce.student_id=${studentId})
            ${groupId ? Prisma.sql`OR (ce.entry_type='GROUP' AND ce.group_id=${groupId})` : Prisma.empty}
          )
        ORDER BY (ce.entry_type='STUDENT') DESC, ce.id ASC
        LIMIT 1
      `,
    );

    return { data: rows.length ? rows[0] : null };
  }
}
