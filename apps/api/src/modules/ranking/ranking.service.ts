// apps/api/src/modules/ranking/ranking.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateGradeSnapshotDto } from './dto/create-snapshot.dto';
import { ListSnapshotsQueryDto } from './dto/list-snapshots.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class RankingService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  /**
   * Raw SQL for calculating total scores and rank within a group and date range.
   */
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

  // ---------- Live ranking ----------

  async liveRanking(args: {
    tenantId: string;
    groupId: string;
    from: string;
    to: string;
  }) {
    try {
      const tenantId = toBigInt(args.tenantId, 'tenantId');
      const groupId = toBigInt(args.groupId, 'groupId');

      // Basic validation: group exists and belongs to tenant
      const group = await this.prisma.groups.findFirst({
        where: { id: groupId, tenant_id: tenantId },
      });
      if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

      const rows = await this.prisma.$queryRaw<any[]>(
        Prisma.sql`
          WITH ranked AS (${this.totalsSql(tenantId, groupId, args.from, args.to)})
          SELECT
            r.student_id,
            st.full_name,
            r.total_score,
            r.rank,
            r.risk_level
          FROM ranked r
          JOIN students st ON st.id = r.student_id
          ORDER BY r.rank ASC
        `,
      );

      return {
        data: rows.map((r) => ({
          studentId: r.student_id.toString(),
          studentName: r.full_name,
          totalScore: r.total_score,
          rank: r.rank,
          riskLevel: r.risk_level,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Snapshot creation ----------

  async createSnapshot(args: {
    tenantId: string;
    userId: string;
    dto: CreateGradeSnapshotDto;
    ipAddress?: string;
  }) {
    try {
      const tenantId = toBigInt(args.tenantId, 'tenantId');
      const groupId = toBigInt(args.dto.groupId, 'groupId');
      const userId = args.userId ? toBigInt(args.userId, 'userId') : null;

      // 1. Validate group
      const group = await this.prisma.groups.findFirst({
        where: { id: groupId, tenant_id: tenantId },
        select: { id: true, name: true },
      });
      if (!group) throw new NotFoundException('GROUP_NOT_FOUND');

      // 2. Validate date range
      const start = new Date(args.dto.periodStart);
      const end = new Date(args.dto.periodEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('INVALID_DATE');
      }
      if (end < start) {
        throw new BadRequestException('PERIOD_END_BEFORE_START');
      }

      // 3. Find existing snapshot for same period (to replace)
      const existing = await this.prisma.grade_snapshots.findFirst({
        where: {
          tenant_id: tenantId,
          group_id: groupId,
          period_type: args.dto.periodType,
          period_start: start,
          period_end: end,
        },
        select: { id: true },
      });

      // Transaction returns the snapshot ID
      const snapshotId = await this.prisma.$transaction(async (tx) => {
        let sid: bigint;

        if (existing) {
          sid = existing.id;
          await tx.grade_snapshots.update({
            where: { id: sid },
            data: { generated_at: new Date() },
          });
          await tx.grade_snapshot_rows.deleteMany({
            where: { snapshot_id: sid },
          });
        } else {
          const created = await tx.grade_snapshots.create({
            data: {
              tenant_id: tenantId,
              group_id: groupId,
              period_type: args.dto.periodType,
              period_start: start,
              period_end: end,
              generated_at: new Date(),
            },
            select: { id: true },
          });
          sid = created.id;
        }

        // Insert fresh rows using the ranking CTE
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO grade_snapshot_rows (snapshot_id, student_id, total_score, rank, risk_level)
            SELECT
              ${sid} AS snapshot_id,
              r.student_id,
              r.total_score,
              r.rank,
              r.risk_level
            FROM (${this.totalsSql(tenantId, groupId, args.dto.periodStart, args.dto.periodEnd)}) r
          `,
        );

        return sid;
      });

      // 4. Audit log
      await this.auditLogger.log({
        tenantId: tenantId,
        actorType: 'STAFF',
        actorUserId: userId,
        action: 'CREATE',
        entityType: 'grade_snapshots',
        entityId: snapshotId,
        afterData: {
          id: snapshotId.toString(),
          groupId: groupId.toString(),
          groupName: group.name,
          periodType: args.dto.periodType,
          periodStart: args.dto.periodStart,
          periodEnd: args.dto.periodEnd,
        },
        ipAddress: args.ipAddress,
      });

      return { id: snapshotId.toString() };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- List snapshots with pagination ----------

  async listSnapshots(args: {
    tenantId: string;
    query: ListSnapshotsQueryDto;
  }) {
    try {
      const tenantId = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.grade_snapshotsWhereInput = {
        tenant_id: tenantId,
      };

      if (args.query.groupId) {
        where.group_id = toBigInt(args.query.groupId, 'groupId');
      }
      if (args.query.periodType) {
        where.period_type = args.query.periodType;
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.grade_snapshots.count({ where }),
        this.prisma.grade_snapshots.findMany({
          where,
          skip,
          take: limit,
          orderBy: { generated_at: 'desc' },
          include: {
            groups: { select: { name: true } },
            _count: { select: { grade_snapshot_rows: true } },
          },
        }),
      ]);

      return {
        data: items.map((s) => ({
          id: s.id.toString(),
          groupId: s.group_id.toString(),
          groupName: s.groups.name,
          periodType: s.period_type,
          periodStart: s.period_start,
          periodEnd: s.period_end,
          generatedAt: s.generated_at,
          rowsCount: s._count.grade_snapshot_rows,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Snapshot rows ----------

  async snapshotRows(args: { tenantId: string; snapshotId: string }) {
    try {
      const tenantId = toBigInt(args.tenantId, 'tenantId');
      const snapshotId = toBigInt(args.snapshotId, 'snapshotId');

      const snapshot = await this.prisma.grade_snapshots.findFirst({
        where: { id: snapshotId, tenant_id: tenantId },
      });
      if (!snapshot) throw new NotFoundException('SNAPSHOT_NOT_FOUND');

      const rows = await this.prisma.grade_snapshot_rows.findMany({
        where: { snapshot_id: snapshotId },
        include: { students: { select: { full_name: true } } },
        orderBy: { rank: 'asc' },
      });

      return {
        snapshotId: snapshotId.toString(),
        rows: rows.map((r) => ({
          studentId: r.student_id.toString(),
          studentName: r.students.full_name,
          totalScore: r.total_score,
          rank: r.rank,
          riskLevel: r.risk_level,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Guardian: latest snapshot for student ----------

  async guardianLatest(args: { studentAccountId: string; periodType: string }) {
    try {
      const studentAccountId = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      // Get student info via guardian account
      const account = await this.prisma.student_accounts.findUnique({
        where: { id: studentAccountId },
        include: { students: { include: { groups: true } } },
      });
      if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

      const student = account.students;
      if (!student.current_group_id) {
        return { snapshot: null, me: null, top: [] };
      }

      const groupId = student.current_group_id;
      const tenantId = student.tenant_id;

      // Find latest snapshot for that group and period type
      const snapshot = await this.prisma.grade_snapshots.findFirst({
        where: {
          tenant_id: tenantId,
          group_id: groupId,
          period_type: args.periodType,
        },
        orderBy: { generated_at: 'desc' },
        select: {
          id: true,
          period_start: true,
          period_end: true,
          generated_at: true,
        },
      });

      if (!snapshot) {
        return { snapshot: null, me: null, top: [] };
      }

      // Get student's own row
      const myRow = await this.prisma.grade_snapshot_rows.findFirst({
        where: {
          snapshot_id: snapshot.id,
          student_id: student.id,
        },
        select: {
          total_score: true,
          rank: true,
          risk_level: true,
        },
      });

      // Get top 10
      const topRows = await this.prisma.grade_snapshot_rows.findMany({
        where: { snapshot_id: snapshot.id },
        orderBy: { rank: 'asc' },
        take: 10,
        include: { students: { select: { full_name: true } } },
      });

      return {
        snapshot: {
          id: snapshot.id.toString(),
          periodStart: snapshot.period_start,
          periodEnd: snapshot.period_end,
          generatedAt: snapshot.generated_at,
        },
        me: myRow
          ? {
              totalScore: myRow.total_score,
              rank: myRow.rank,
              riskLevel: myRow.risk_level,
            }
          : null,
        top: topRows.map((r) => ({
          rank: r.rank,
          totalScore: r.total_score,
          studentName: r.students.full_name,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
