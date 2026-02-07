import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DisciplineService {
  constructor(private readonly prisma: PrismaService) {}

  async createViolation(args: {
    tenantId: string;
    recordedByUserId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const recordedByUserId = args.recordedByUserId
      ? BigInt(args.recordedByUserId)
      : null;

    const studentId = BigInt(args.dto.studentId);
    const ruleCode = String(args.dto.ruleCode || '').trim();
    const description = String(args.dto.description || '').trim();
    const severity = String(args.dto.severity || 'LOW');
    const evidenceFileId = args.dto.evidenceFileId
      ? BigInt(args.dto.evidenceFileId)
      : null;
    const linkedActionId = args.dto.linkedDisciplineActionId
      ? BigInt(args.dto.linkedDisciplineActionId)
      : null;

    const detectedAtSql = args.dto.detectedAt
      ? Prisma.sql`${String(args.dto.detectedAt)}::timestamptz`
      : Prisma.sql`now()`;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    if (linkedActionId) {
      const a = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM discipline_actions WHERE tenant_id=${tenantId} AND id=${linkedActionId} LIMIT 1`,
      );
      if (!a.length)
        throw new BadRequestException('DISCIPLINE_ACTION_NOT_FOUND');
    }

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO violations (
          tenant_id, student_id, rule_code, description, severity,
          evidence_file_id, detected_at, recorded_by_user_id, linked_discipline_action_id
        )
        VALUES (
          ${tenantId}, ${studentId}, ${ruleCode}, ${description}, ${severity},
          ${evidenceFileId}, ${detectedAtSql}, ${recordedByUserId}, ${linkedActionId}
        )
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async listViolations(args: {
    tenantId: string;
    studentId?: string;
    groupId?: string;
    from?: string;
    to?: string;
    severity?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = args.studentId ? BigInt(args.studentId) : null;
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    const severity = args.severity ? String(args.severity) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          v.id,
          v.rule_code,
          v.description,
          v.severity,
          v.detected_at,
          v.linked_discipline_action_id,
          st.id AS student_id,
          st.full_name,
          g.name AS group_name
        FROM violations v
        JOIN students st ON st.id = v.student_id
        LEFT JOIN groups g ON g.id = st.current_group_id
        WHERE v.tenant_id=${tenantId}
          ${studentId ? Prisma.sql`AND v.student_id=${studentId}` : Prisma.empty}
          ${groupId ? Prisma.sql`AND st.current_group_id=${groupId}` : Prisma.empty}
          ${severity ? Prisma.sql`AND v.severity=${severity}` : Prisma.empty}
          ${from ? Prisma.sql`AND v.detected_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND v.detected_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY v.detected_at DESC, v.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async createAction(args: {
    tenantId: string;
    issuedByUserId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const issuedByUserId = args.issuedByUserId
      ? BigInt(args.issuedByUserId)
      : null;

    const studentId = BigInt(args.dto.studentId);
    const actionType = String(args.dto.actionType || '').trim();
    const reason = String(args.dto.reason || '').trim();
    const relatedAssessmentId = args.dto.relatedAssessmentId
      ? BigInt(args.dto.relatedAssessmentId)
      : null;
    const isActive =
      args.dto.isActive == null ? true : Boolean(args.dto.isActive);

    const issuedAtSql = args.dto.issuedAt
      ? Prisma.sql`${String(args.dto.issuedAt)}::timestamptz`
      : Prisma.sql`now()`;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    const ins = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO discipline_actions (
          tenant_id, student_id, action_type, reason,
          issued_by_user_id, issued_at, related_assessment_id, is_active
        )
        VALUES (
          ${tenantId}, ${studentId}, ${actionType}, ${reason},
          ${issuedByUserId}, ${issuedAtSql}, ${relatedAssessmentId}, ${isActive}
        )
        RETURNING id
      `,
    );

    const actionId = ins[0].id;

    const violationIds: string[] = Array.isArray(args.dto.violationIds)
      ? args.dto.violationIds
      : [];
    if (violationIds.length) {
      const ids = violationIds.map((x) => BigInt(x));
      await this.prisma.$executeRaw(
        Prisma.sql`
          UPDATE violations
          SET linked_discipline_action_id = ${actionId}
          WHERE tenant_id = ${tenantId}
            AND id IN (${Prisma.join(ids)})
        `,
      );
    }

    return { id: actionId.toString() };
  }

  async listActions(args: {
    tenantId: string;
    studentId?: string;
    groupId?: string;
    active?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = args.studentId ? BigInt(args.studentId) : null;
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const active = args.active == null ? null : args.active === 'true';

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          a.id,
          a.action_type,
          a.reason,
          a.issued_at,
          a.is_active,
          st.id AS student_id,
          st.full_name,
          g.name AS group_name
        FROM discipline_actions a
        JOIN students st ON st.id = a.student_id
        LEFT JOIN groups g ON g.id = st.current_group_id
        WHERE a.tenant_id=${tenantId}
          ${studentId ? Prisma.sql`AND a.student_id=${studentId}` : Prisma.empty}
          ${groupId ? Prisma.sql`AND st.current_group_id=${groupId}` : Prisma.empty}
          ${active === null ? Prisma.empty : Prisma.sql`AND a.is_active=${active}`}
        ORDER BY a.issued_at DESC, a.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async guardianMe(args: {
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

    const actions = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT id, action_type, reason, issued_at, is_active
        FROM discipline_actions
        WHERE tenant_id=${tenantId} AND student_id=${studentId}
          ${from ? Prisma.sql`AND issued_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND issued_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY issued_at DESC, id DESC
        LIMIT 100
      `,
    );

    const violations = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT id, rule_code, description, severity, detected_at, linked_discipline_action_id
        FROM violations
        WHERE tenant_id=${tenantId} AND student_id=${studentId}
          ${from ? Prisma.sql`AND detected_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND detected_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY detected_at DESC, id DESC
        LIMIT 100
      `,
    );

    return { actions, violations };
  }
}
