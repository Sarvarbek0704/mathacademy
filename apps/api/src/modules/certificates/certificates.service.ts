import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createCertificate(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = BigInt(args.dto.studentId);

    const title = String(args.dto.title || '').trim();
    if (!title) throw new BadRequestException('TITLE_REQUIRED');

    const subjectId = args.dto.subjectId ? BigInt(args.dto.subjectId) : null;
    const issuer = args.dto.issuer ? String(args.dto.issuer) : null;
    const score = args.dto.score ? String(args.dto.score) : null;
    const issuedAt = args.dto.issuedAt ? String(args.dto.issuedAt) : null;
    const fileId = args.dto.fileId ? BigInt(args.dto.fileId) : null;
    const notes = args.dto.notes ? String(args.dto.notes) : null;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    if (subjectId) {
      const sub = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM subjects WHERE tenant_id=${tenantId} AND id=${subjectId} LIMIT 1`,
      );
      if (!sub.length) throw new BadRequestException('SUBJECT_NOT_FOUND');
    }

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO certificates (
          tenant_id, student_id, title, subject_id, issuer, score, issued_at, file_id, notes
        )
        VALUES (
          ${tenantId}, ${studentId}, ${title}, ${subjectId}, ${issuer}, ${score},
          ${issuedAt ? Prisma.sql`${issuedAt}::date` : Prisma.sql`NULL`},
          ${fileId}, ${notes}
        )
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async listCertificates(args: {
    tenantId: string;
    studentId?: string;
    groupId?: string;
    q?: string;
    limit?: string;
    offset?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = args.studentId ? BigInt(args.studentId) : null;
    const groupId = args.groupId ? BigInt(args.groupId) : null;
    const q = args.q ? String(args.q).trim() : null;

    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const offset = Math.max(Number(args.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          c.id::text AS id,
          c.student_id::text AS student_id,
          st.full_name,
          st.current_group_id::text AS group_id,
          g.name AS group_name,
          c.title,
          c.issuer,
          c.score,
          c.issued_at,
          c.subject_id::text AS subject_id,
          sb.name AS subject_name,
          c.file_id::text AS file_id,
          c.notes,
          c.created_at
        FROM certificates c
        JOIN students st ON st.id = c.student_id
        LEFT JOIN groups g ON g.id = st.current_group_id
        LEFT JOIN subjects sb ON sb.id = c.subject_id
        WHERE c.tenant_id=${tenantId}
          ${studentId ? Prisma.sql`AND c.student_id=${studentId}` : Prisma.empty}
          ${groupId ? Prisma.sql`AND st.current_group_id=${groupId}` : Prisma.empty}
          ${
            q
              ? Prisma.sql`AND (c.title ILIKE ${'%' + q + '%'} OR COALESCE(c.issuer,'') ILIKE ${'%' + q + '%'})`
              : Prisma.empty
          }
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async setOutcome(args: { tenantId: string; userId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const userId = args.userId ? BigInt(args.userId) : null;

    const studentId = BigInt(args.dto.studentId);
    const outcomeStatus = String(args.dto.outcomeStatus || 'UNKNOWN');
    const institutionName = args.dto.institutionName
      ? String(args.dto.institutionName)
      : null;
    const facultyOrProgram = args.dto.facultyOrProgram
      ? String(args.dto.facultyOrProgram)
      : null;
    const decisionDate = args.dto.decisionDate
      ? String(args.dto.decisionDate)
      : null;
    const source = args.dto.source ? String(args.dto.source) : null;
    const notes = args.dto.notes ? String(args.dto.notes) : null;

    const s = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM students WHERE tenant_id=${tenantId} AND id=${studentId} LIMIT 1`,
    );
    if (!s.length) throw new BadRequestException('STUDENT_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO student_outcomes (
          tenant_id, student_id, outcome_status, institution_name, faculty_or_program,
          decision_date, source, notes, created_by_user_id
        )
        VALUES (
          ${tenantId}, ${studentId}, ${outcomeStatus}, ${institutionName}, ${facultyOrProgram},
          ${decisionDate ? Prisma.sql`${decisionDate}::date` : Prisma.sql`NULL`},
          ${source}, ${notes}, ${userId}
        )
        ON CONFLICT (student_id)
        DO UPDATE SET
          outcome_status = EXCLUDED.outcome_status,
          institution_name = EXCLUDED.institution_name,
          faculty_or_program = EXCLUDED.faculty_or_program,
          decision_date = EXCLUDED.decision_date,
          source = EXCLUDED.source,
          notes = EXCLUDED.notes,
          created_by_user_id = EXCLUDED.created_by_user_id
        RETURNING id
      `,
    );

    return { ok: true, id: rows[0].id.toString() };
  }

  async listOutcomes(args: {
    tenantId: string;
    studentId?: string;
    groupId?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentId = args.studentId ? BigInt(args.studentId) : null;
    const groupId = args.groupId ? BigInt(args.groupId) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          o.id::text AS id,
          o.student_id::text AS student_id,
          st.full_name,
          st.current_group_id::text AS group_id,
          g.name AS group_name,
          o.outcome_status,
          o.institution_name,
          o.faculty_or_program,
          o.decision_date,
          o.source,
          o.notes,
          o.created_at
        FROM student_outcomes o
        JOIN students st ON st.id = o.student_id
        LEFT JOIN groups g ON g.id = st.current_group_id
        WHERE o.tenant_id=${tenantId}
          ${studentId ? Prisma.sql`AND o.student_id=${studentId}` : Prisma.empty}
          ${groupId ? Prisma.sql`AND st.current_group_id=${groupId}` : Prisma.empty}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async guardianCertificates(args: { studentAccountId: string }) {
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
          c.id::text AS id,
          c.title,
          c.issuer,
          c.score,
          c.issued_at,
          c.subject_id::text AS subject_id,
          sb.name AS subject_name,
          c.file_id::text AS file_id,
          c.notes,
          c.created_at
        FROM certificates c
        LEFT JOIN subjects sb ON sb.id = c.subject_id
        WHERE c.tenant_id=${tenantId} AND c.student_id=${studentId}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  async guardianOutcome(args: { studentAccountId: string }) {
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
          id::text AS id,
          outcome_status,
          institution_name,
          faculty_or_program,
          decision_date,
          source,
          notes,
          created_at
        FROM student_outcomes
        WHERE tenant_id=${tenantId} AND student_id=${studentId}
        LIMIT 1
      `,
    );

    return { data: rows.length ? rows[0] : null };
  }
}
