import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  private totalsSql(
    tenantId: bigint,
    groupId: bigint,
    start: string,
    end: string,
  ) {
    return Prisma.sql`
      WITH totals AS (
        SELECT
          s.id AS student_id,
          COALESCE(
            SUM(
              COALESCE(
                (sc.score / NULLIF(a.max_score, 0)) * 100 * a.weight,
                0
              )
            ),
            0
          )::numeric(12,2) AS total_score
        FROM students s
        LEFT JOIN assessment_scores sc
          ON sc.student_id = s.id
        LEFT JOIN assessments a
          ON a.id = sc.assessment_id
         AND a.tenant_id = ${tenantId}
         AND a.group_id = ${groupId}
         AND a.held_at::date >= ${start}::date
         AND a.held_at::date <= ${end}::date
        WHERE s.tenant_id = ${tenantId}
          AND s.current_group_id = ${groupId}
          AND s.status = 'ACTIVE'
        GROUP BY s.id
      ),
      latest_risk AS (
        SELECT DISTINCT ON (student_id)
          student_id,
          level
        FROM student_risk_scores
        WHERE tenant_id = ${tenantId}
        ORDER BY student_id, calculated_at DESC, id DESC
      ),
      ranked AS (
        SELECT
          t.student_id,
          t.total_score,
          DENSE_RANK() OVER (ORDER BY t.total_score DESC) AS rank,
          COALESCE(lr.level, 'GREEN') AS risk_level
        FROM totals t
        LEFT JOIN latest_risk lr ON lr.student_id = t.student_id
      )
      SELECT * FROM ranked
      ORDER BY rank ASC, student_id ASC
    `;
  }

  async liveRanking(args: {
    tenantId: string;
    groupId: string;
    from: string;
    to: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = BigInt(args.groupId);
    const from = String(args.from);
    const to = String(args.to);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        WITH ranked AS (${this.totalsSql(tenantId, groupId, from, to)})
        SELECT
          r.student_id,
          st.full_name,
          r.total_score,
          r.rank,
          r.risk_level
        FROM ranked r
        JOIN students st ON st.id = r.student_id
        ORDER BY r.rank ASC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async createSnapshot(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = BigInt(args.dto.groupId);
    const periodType = String(args.dto.periodType);
    const start = String(args.dto.periodStart);
    const end = String(args.dto.periodEnd);

    const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM groups WHERE tenant_id=${tenantId} AND id=${groupId} LIMIT 1`,
    );
    if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

    // same period snapshot bo‘lsa — qayta generate (id o‘zgarmaydi)
    const ex = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT id
        FROM grade_snapshots
        WHERE tenant_id=${tenantId}
          AND group_id=${groupId}
          AND period_type=${periodType}
          AND period_start=${start}::date
          AND period_end=${end}::date
        LIMIT 1
      `,
    );

    let snapshotId: bigint;

    if (ex.length) {
      snapshotId = ex[0].id;

      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE grade_snapshots SET generated_at=now() WHERE id=${snapshotId}`,
      );
      await this.prisma.$executeRaw(
        Prisma.sql`DELETE FROM grade_snapshot_rows WHERE snapshot_id=${snapshotId}`,
      );
    } else {
      const ins = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`
          INSERT INTO grade_snapshots (tenant_id, group_id, period_type, period_start, period_end, generated_at)
          VALUES (${tenantId}, ${groupId}, ${periodType}, ${start}::date, ${end}::date, now())
          RETURNING id
        `,
      );
      snapshotId = ins[0].id;
    }

    // rows insert
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO grade_snapshot_rows (snapshot_id, student_id, total_score, rank, risk_level)
        SELECT
          ${snapshotId} AS snapshot_id,
          r.student_id,
          r.total_score,
          r.rank,
          r.risk_level
        FROM (${this.totalsSql(tenantId, groupId, start, end)}) r
      `,
    );

    return { id: snapshotId.toString() };
  }

  async listSnapshots(args: {
    tenantId: string;
    groupId?: string;
    periodType?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const periodType = args.periodType ? String(args.periodType) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          gs.id, gs.group_id, g.name AS group_name,
          gs.period_type, gs.period_start, gs.period_end, gs.generated_at
        FROM grade_snapshots gs
        JOIN groups g ON g.id = gs.group_id
        WHERE gs.tenant_id=${tenantId}
          ${groupId ? Prisma.sql`AND gs.group_id=${groupId}` : Prisma.empty}
          ${periodType ? Prisma.sql`AND gs.period_type=${periodType}` : Prisma.empty}
        ORDER BY gs.generated_at DESC, gs.id DESC
        LIMIT 50
      `,
    );

    return { data: rows };
  }

  async snapshotRows(args: { tenantId: string; snapshotId: string }) {
    const tenantId = BigInt(args.tenantId);
    const snapshotId = BigInt(args.snapshotId);

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM grade_snapshots WHERE tenant_id=${tenantId} AND id=${snapshotId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('SNAPSHOT_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          r.student_id,
          st.full_name,
          r.total_score,
          r.rank,
          r.risk_level
        FROM grade_snapshot_rows r
        JOIN students st ON st.id = r.student_id
        WHERE r.snapshot_id=${snapshotId}
        ORDER BY r.rank ASC
        LIMIT 300
      `,
    );

    return { data: rows };
  }

  async guardianLatest(args: { studentAccountId: string; periodType: string }) {
    const studentAccountId = BigInt(args.studentAccountId);
    const periodType = String(args.periodType || 'WEEK');

    const base = await this.prisma.$queryRaw<
      {
        student_id: bigint;
        tenant_id: bigint;
        current_group_id: bigint | null;
      }[]
    >(
      Prisma.sql`
        SELECT s.id AS student_id, s.tenant_id, s.current_group_id
        FROM student_accounts sa
        JOIN students s ON s.id = sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');
    if (!base[0].current_group_id) return { snapshot: null, me: null, top: [] };

    const tenantId = base[0].tenant_id;
    const studentId = base[0].student_id;
    const groupId = base[0].current_group_id;

    const snap = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT id, period_start, period_end, generated_at
        FROM grade_snapshots
        WHERE tenant_id=${tenantId} AND group_id=${groupId} AND period_type=${periodType}
        ORDER BY generated_at DESC, id DESC
        LIMIT 1
      `,
    );
    if (!snap.length) return { snapshot: null, me: null, top: [] };

    const snapshotId = snap[0].id;

    const me = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT total_score, rank, risk_level
        FROM grade_snapshot_rows
        WHERE snapshot_id=${snapshotId} AND student_id=${studentId}
        LIMIT 1
      `,
    );

    const top = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT r.rank, r.total_score, st.full_name
        FROM grade_snapshot_rows r
        JOIN students st ON st.id=r.student_id
        WHERE r.snapshot_id=${snapshotId}
        ORDER BY r.rank ASC
        LIMIT 10
      `,
    );

    return {
      snapshot: {
        id: snapshotId.toString(),
        periodStart: String(snap[0].period_start),
        periodEnd: String(snap[0].period_end),
        generatedAt: String(snap[0].generated_at),
      },
      me: me.length ? me[0] : null,
      top,
    };
  }
}
