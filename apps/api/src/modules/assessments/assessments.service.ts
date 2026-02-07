import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(args: { tenantId: string; createdByUserId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const createdByUserId = args.createdByUserId
      ? BigInt(args.createdByUserId)
      : null;

    const groupId = BigInt(args.dto.groupId);
    const subjectId = BigInt(args.dto.subjectId);

    const title = String(args.dto.title || '').trim();
    const type = String(args.dto.type || '').trim();

    const weight = args.dto.weight == null ? 1 : Number(args.dto.weight);
    const maxScore =
      args.dto.maxScore == null ? 100 : Number(args.dto.maxScore);

    const heldAt = String(args.dto.heldAt);
    const publish =
      args.dto.publishToGuardians == null
        ? true
        : Boolean(args.dto.publishToGuardians);

    // group -> academic_year_id ni olib beramiz (majburiy)
    const g = await this.prisma.$queryRaw<{ academic_year_id: bigint }[]>(
      Prisma.sql`
        SELECT academic_year_id
        FROM groups
        WHERE tenant_id = ${tenantId} AND id = ${groupId}
        LIMIT 1
      `,
    );
    if (!g.length) throw new BadRequestException('GROUP_NOT_FOUND');

    // subject tenant ichidami?
    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT id FROM subjects
        WHERE tenant_id = ${tenantId} AND id = ${subjectId}
        LIMIT 1
      `,
    );
    if (!s.length) throw new BadRequestException('SUBJECT_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO assessments (
          tenant_id, academic_year_id, group_id, subject_id,
          type, title, max_score, weight, held_at,
          created_by_user_id, is_published_to_guardians, created_at
        )
        VALUES (
          ${tenantId}, ${g[0].academic_year_id}, ${groupId}, ${subjectId},
          ${type}, ${title}, ${maxScore}, ${weight}, ${heldAt}::timestamptz,
          ${createdByUserId}, ${publish}, now()
        )
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async list(args: {
    tenantId: string;
    groupId?: string;
    from?: string;
    to?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          a.id, a.title, a.type, a.weight, a.max_score, a.held_at,
          a.is_published_to_guardians,
          g.name AS group_name,
          sub.name AS subject_name
        FROM assessments a
        JOIN groups g ON g.id = a.group_id
        JOIN subjects sub ON sub.id = a.subject_id
        WHERE a.tenant_id = ${tenantId}
          ${groupId ? Prisma.sql`AND a.group_id = ${groupId}` : Prisma.empty}
          ${from ? Prisma.sql`AND a.held_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND a.held_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY a.held_at DESC, a.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async upsertScores(args: {
    tenantId: string;
    assessmentId: string;
    enteredByUserId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const assessmentId = BigInt(args.assessmentId);
    const enteredByUserId = args.enteredByUserId
      ? BigInt(args.enteredByUserId)
      : null;

    const a = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM assessments WHERE tenant_id=${tenantId} AND id=${assessmentId} LIMIT 1`,
    );
    if (!a.length) throw new BadRequestException('ASSESSMENT_NOT_FOUND');

    const scores: { studentId: string; score: number }[] =
      args.dto.scores || [];

    for (const it of scores) {
      const studentId = BigInt(it.studentId);
      const score = Number(it.score);

      await this.prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO assessment_scores (assessment_id, student_id, score, entered_by_user_id, entered_at)
          VALUES (${assessmentId}, ${studentId}, ${score}, ${enteredByUserId}, now())
          ON CONFLICT (assessment_id, student_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            entered_by_user_id = EXCLUDED.entered_by_user_id,
            entered_at = now()
        `,
      );
    }

    return { ok: true };
  }

  async guardianGrades(args: {
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
          a.held_at,
          a.type,
          a.title,
          a.weight,
          a.max_score,
          g.name AS group_name,
          sub.name AS subject_name,
          sc.score
        FROM assessment_scores sc
        JOIN assessments a ON a.id = sc.assessment_id
        JOIN groups g ON g.id = a.group_id
        JOIN subjects sub ON sub.id = a.subject_id
        WHERE sc.student_id = ${studentId}
          AND a.tenant_id = ${tenantId}
          AND a.is_published_to_guardians = true
          ${from ? Prisma.sql`AND a.held_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND a.held_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY a.held_at DESC, a.id DESC
        LIMIT 300
      `,
    );

    return { data: rows };
  }
}
