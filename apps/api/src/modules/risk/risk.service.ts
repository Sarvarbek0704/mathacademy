import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function levelFromScore(score: number) {
  if (score <= 33) return 'GREEN';
  if (score <= 66) return 'YELLOW';
  return 'RED';
}

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  async setRisk(args: { tenantId: string; createdByUserId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const createdByUserId = args.createdByUserId
      ? BigInt(args.createdByUserId)
      : null;

    const studentId = BigInt(args.dto.studentId);
    const score = Number(args.dto.score);
    const level = levelFromScore(score);
    const note = args.dto.note ? String(args.dto.note) : null;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    const signals = { manual: true, note };

    // ⚠️ agar DB’da column nomlari farq qilsa, error textni tashlaysiz — 1:1 moslayman
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
    INSERT INTO student_risk_scores (
      tenant_id, student_id, score, level, signals, calculated_at
    )
    VALUES (
      ${tenantId}, ${studentId}, ${score}, ${level},
      ${JSON.stringify(signals)}::jsonb, now()
    )
    RETURNING id
  `,
    );

    return { ok: true, id: rows[0].id.toString(), level };
  }

  async latestByGroup(args: { tenantId: string; groupId: string }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = BigInt(args.groupId);

    const g = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM groups WHERE tenant_id=${tenantId} AND id=${groupId} LIMIT 1`,
    );
    if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          st.id AS student_id,
          st.full_name,
          lr.score,
          lr.level,
          lr.calculated_at
        FROM students st
        LEFT JOIN LATERAL (
          SELECT score, level, calculated_at
          FROM student_risk_scores r
          WHERE r.tenant_id=${tenantId} AND r.student_id=st.id
          ORDER BY r.calculated_at DESC, r.id DESC
          LIMIT 1
        ) lr ON true
        WHERE st.tenant_id=${tenantId}
          AND st.current_group_id=${groupId}
          AND st.status='ACTIVE'
        ORDER BY COALESCE(lr.score, 0) DESC, st.id ASC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async guardianMe(args: { studentAccountId: string }) {
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
        SELECT score, level, signals, calculated_at
        FROM student_risk_scores r
        WHERE r.tenant_id=${tenantId} AND r.student_id=${studentId}
        ORDER BY r.calculated_at DESC, r.id DESC
        LIMIT 1
      `,
    );

    return { data: rows.length ? rows[0] : null };
  }
}
