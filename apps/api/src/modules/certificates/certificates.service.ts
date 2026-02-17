import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { SetOutcomeDto } from './dto/set-outcome.dto';
import {
  CertificateListQueryDto,
  OutcomeListQueryDto,
} from './dto/certificate-list.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

@Injectable()
export class CertificatesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async createCertificate(args: {
    tenantId: string;
    userId: string;
    dto: CreateCertificateDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.dto.studentId, 'studentId');
    const created_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Student exists and belongs to tenant
      const student = await tx.students.findFirst({
        where: { id: student_id, tenant_id },
        select: { id: true, full_name: true },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      // 2. Subject exists if provided
      let subject_id: bigint | null = null;
      if (args.dto.subjectId) {
        subject_id = toBigInt(args.dto.subjectId, 'subjectId');
        const subject = await tx.subjects.findFirst({
          where: { id: subject_id, tenant_id },
          select: { id: true },
        });
        if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');
      }

      // 3. File exists if provided
      let file_id: bigint | null = null;
      if (args.dto.fileId) {
        file_id = toBigInt(args.dto.fileId, 'fileId');
        const file = await tx.files.findFirst({
          where: { id: file_id, tenant_id },
          select: { id: true },
        });
        if (!file) throw new NotFoundException('FILE_NOT_FOUND');
      }

      // 4. Create certificate
      const certificate = await tx.certificates.create({
        data: {
          tenant_id,
          student_id,
          title: args.dto.title.trim(),
          subject_id,
          issuer: args.dto.issuer?.trim() || null,
          score: args.dto.score?.trim() || null,
          issued_at: args.dto.issuedAt ? new Date(args.dto.issuedAt) : null,
          file_id,
          notes: args.dto.notes?.trim() || null,
        },
        include: {
          students: { select: { full_name: true } },
          subjects: { select: { name: true } },
          // ✅ ID ni ham select qilish kerak
          files: { select: { id: true, file_name: true, url: true } },
        },
      });

      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'certificates',
        entityId: certificate.id,
        afterData: {
          id: certificate.id.toString(),
          studentId: student_id.toString(),
          studentName: certificate.students.full_name,
          title: certificate.title,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: certificate.id.toString(),
        studentId: certificate.student_id.toString(),
        studentName: certificate.students.full_name,
        title: certificate.title,
        subject: certificate.subjects?.name || null,
        issuer: certificate.issuer,
        score: certificate.score,
        issuedAt: certificate.issued_at,
        file: certificate.files
          ? {
              id: certificate.files.id.toString(),
              name: certificate.files.file_name,
              url: certificate.files.url,
            }
          : null,
        notes: certificate.notes,
        createdAt: certificate.created_at,
      };
    });
  }

  async updateCertificate(args: {
    tenantId: string;
    certificateId: string;
    userId: string;
    dto: UpdateCertificateDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const certificate_id = toBigInt(args.certificateId, 'certificateId');
    const updated_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Certificate exists and belongs to tenant
      const existing = await tx.certificates.findFirst({
        where: { id: certificate_id, tenant_id },
        include: { students: { select: { full_name: true } } },
      });
      if (!existing) throw new NotFoundException('CERTIFICATE_NOT_FOUND');

      const updateData: Prisma.certificatesUpdateInput = {};

      if (args.dto.title !== undefined) {
        updateData.title = args.dto.title.trim();
      }
      if (args.dto.subjectId !== undefined) {
        if (args.dto.subjectId) {
          const subject_id = toBigInt(args.dto.subjectId, 'subjectId');
          const subject = await tx.subjects.findFirst({
            where: { id: subject_id, tenant_id },
            select: { id: true },
          });
          if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');
          updateData.subjects = { connect: { id: subject_id } };
        } else {
          updateData.subjects = { disconnect: true };
        }
      }
      if (args.dto.issuer !== undefined) {
        updateData.issuer = args.dto.issuer?.trim() || null;
      }
      if (args.dto.score !== undefined) {
        updateData.score = args.dto.score?.trim() || null;
      }
      if (args.dto.issuedAt !== undefined) {
        updateData.issued_at = args.dto.issuedAt
          ? new Date(args.dto.issuedAt)
          : null;
      }
      if (args.dto.fileId !== undefined) {
        if (args.dto.fileId) {
          const file_id = toBigInt(args.dto.fileId, 'fileId');
          const file = await tx.files.findFirst({
            where: { id: file_id, tenant_id },
            select: { id: true },
          });
          if (!file) throw new NotFoundException('FILE_NOT_FOUND');
          updateData.files = { connect: { id: file_id } };
        } else {
          updateData.files = { disconnect: true };
        }
      }
      if (args.dto.notes !== undefined) {
        updateData.notes = args.dto.notes?.trim() || null;
      }

      const updated = await tx.certificates.update({
        where: { id: certificate_id },
        data: updateData,
        include: {
          students: { select: { full_name: true } },
          subjects: { select: { name: true } },
          files: { select: { id: true, file_name: true, url: true } },
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'certificates',
        entityId: certificate_id,
        beforeData: {
          id: existing.id.toString(),
          title: existing.title,
        },
        afterData: {
          id: updated.id.toString(),
          title: updated.title,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        studentId: updated.student_id.toString(),
        studentName: updated.students.full_name,
        title: updated.title,
        subject: updated.subjects?.name || null,
        issuer: updated.issuer,
        score: updated.score,
        issuedAt: updated.issued_at,
        file: updated.files
          ? {
              id: updated.files.id.toString(),
              name: updated.files.file_name,
              url: updated.files.url,
            }
          : null,
        notes: updated.notes,
        createdAt: updated.created_at,
      };
    });
  }

  async listCertificates(args: {
    tenantId: string;
    query: CertificateListQueryDto;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.certificatesWhereInput = {
      tenant_id,
    };

    if (args.query.studentId) {
      where.student_id = toBigInt(args.query.studentId, 'studentId');
    }

    if (args.query.groupId) {
      where.students = {
        current_group_id: toBigInt(args.query.groupId, 'groupId'),
      };
    }

    if (args.query.q) {
      const search = args.query.q.trim();
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { issuer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.certificatesOrderByWithRelationInput = {};
    if (args.query.sortBy === 'issuedAt') {
      orderBy.issued_at = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'createdAt') {
      orderBy.created_at = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'title') {
      orderBy.title = args.query.sortDir ?? 'desc';
    } else {
      orderBy.issued_at = 'desc';
      orderBy.created_at = 'desc';
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.certificates.count({ where }),
      this.prisma.certificates.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              current_group_id: true,
              groups: { select: { name: true } },
            },
          },
          subjects: { select: { id: true, name: true } },
          files: { select: { id: true, file_name: true, url: true } },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        studentId: item.student_id.toString(),
        studentName: item.students.full_name,
        groupId: item.students.current_group_id?.toString() || null,
        groupName: item.students.groups?.name || null,
        title: item.title,
        issuer: item.issuer,
        score: item.score,
        issuedAt: item.issued_at,
        subject: item.subjects
          ? {
              id: item.subjects.id.toString(),
              name: item.subjects.name,
            }
          : null,
        file: item.files
          ? {
              id: item.files.id.toString(),
              name: item.files.file_name,
              url: item.files.url,
            }
          : null,
        notes: item.notes,
        createdAt: item.created_at,
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
  }

  async getCertificateById(args: { tenantId: string; certificateId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const certificate_id = toBigInt(args.certificateId, 'certificateId');

    const certificate = await this.prisma.certificates.findFirst({
      where: { id: certificate_id, tenant_id },
      include: {
        students: {
          select: {
            id: true,
            full_name: true,
            current_group_id: true,
            groups: { select: { name: true } },
          },
        },
        subjects: { select: { id: true, name: true } },
        files: { select: { id: true, file_name: true, url: true } },
      },
    });

    if (!certificate) {
      throw new NotFoundException('CERTIFICATE_NOT_FOUND');
    }

    return {
      id: certificate.id.toString(),
      studentId: certificate.student_id.toString(),
      studentName: certificate.students.full_name,
      groupId: certificate.students.current_group_id?.toString() || null,
      groupName: certificate.students.groups?.name || null,
      title: certificate.title,
      issuer: certificate.issuer,
      score: certificate.score,
      issuedAt: certificate.issued_at,
      subject: certificate.subjects
        ? {
            id: certificate.subjects.id.toString(),
            name: certificate.subjects.name,
          }
        : null,
      file: certificate.files
        ? {
            id: certificate.files.id.toString(),
            name: certificate.files.file_name,
            url: certificate.files.url,
          }
        : null,
      notes: certificate.notes,
      createdAt: certificate.created_at,
    };
  }

  async deleteCertificate(args: {
    tenantId: string;
    certificateId: string;
    userId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const certificate_id = toBigInt(args.certificateId, 'certificateId');
    const deleted_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      const certificate = await tx.certificates.findFirst({
        where: { id: certificate_id, tenant_id },
        select: { id: true, title: true, student_id: true },
      });
      if (!certificate) throw new NotFoundException('CERTIFICATE_NOT_FOUND');

      await tx.certificates.delete({ where: { id: certificate_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'certificates',
        entityId: certificate_id,
        beforeData: {
          id: certificate.id.toString(),
          title: certificate.title,
        },
        ipAddress: args.ipAddress,
      });

      return { ok: true, id: certificate_id.toString() };
    });
  }

  // ==================== OUTCOMES ====================

  async setOutcome(args: {
    tenantId: string;
    userId: string;
    dto: SetOutcomeDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.dto.studentId, 'studentId');
    const created_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Student exists and belongs to tenant
      const student = await tx.students.findFirst({
        where: { id: student_id, tenant_id },
        select: { id: true, full_name: true },
      });
      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      // 2. Upsert outcome
      const outcome = await tx.student_outcomes.upsert({
        where: { student_id },
        update: {
          outcome_status: args.dto.outcomeStatus,
          institution_name: args.dto.institutionName?.trim() || null,
          faculty_or_program: args.dto.facultyOrProgram?.trim() || null,
          decision_date: args.dto.decisionDate
            ? new Date(args.dto.decisionDate)
            : null,
          source: args.dto.source?.trim() || null,
          notes: args.dto.notes?.trim() || null,
          created_by_user_id,
        },
        create: {
          tenant_id,
          student_id,
          outcome_status: args.dto.outcomeStatus,
          institution_name: args.dto.institutionName?.trim() || null,
          faculty_or_program: args.dto.facultyOrProgram?.trim() || null,
          decision_date: args.dto.decisionDate
            ? new Date(args.dto.decisionDate)
            : null,
          source: args.dto.source?.trim() || null,
          notes: args.dto.notes?.trim() || null,
          created_by_user_id,
        },
        include: {
          students: { select: { full_name: true } },
        },
      });

      // 3. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'UPDATE',
        entityType: 'student_outcomes',
        entityId: outcome.id,
        afterData: {
          id: outcome.id.toString(),
          studentId: student_id.toString(),
          studentName: outcome.students.full_name,
          outcomeStatus: outcome.outcome_status,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: outcome.id.toString(),
        studentId: outcome.student_id.toString(),
        studentName: outcome.students.full_name,
        outcomeStatus: outcome.outcome_status,
        institutionName: outcome.institution_name,
        facultyOrProgram: outcome.faculty_or_program,
        decisionDate: outcome.decision_date,
        source: outcome.source,
        notes: outcome.notes,
        createdAt: outcome.created_at,
      };
    });
  }

  async listOutcomes(args: { tenantId: string; query: OutcomeListQueryDto }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');

    const where: Prisma.student_outcomesWhereInput = {
      tenant_id,
    };

    if (args.query.studentId) {
      where.student_id = toBigInt(args.query.studentId, 'studentId');
    }

    if (args.query.groupId) {
      where.students = {
        current_group_id: toBigInt(args.query.groupId, 'groupId'),
      };
    }

    if (args.query.outcomeStatus) {
      where.outcome_status = args.query.outcomeStatus;
    }

    const outcomes = await this.prisma.student_outcomes.findMany({
      where,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      include: {
        students: {
          select: {
            id: true,
            full_name: true,
            current_group_id: true,
            groups: { select: { name: true } },
          },
        },
      },
    });

    return {
      data: outcomes.map((item) => ({
        id: item.id.toString(),
        studentId: item.student_id.toString(),
        studentName: item.students.full_name,
        groupId: item.students.current_group_id?.toString() || null,
        groupName: item.students.groups?.name || null,
        outcomeStatus: item.outcome_status,
        institutionName: item.institution_name,
        facultyOrProgram: item.faculty_or_program,
        decisionDate: item.decision_date,
        source: item.source,
        notes: item.notes,
        createdAt: item.created_at,
      })),
    };
  }

  async getOutcomeByStudentId(args: { tenantId: string; studentId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');

    const outcome = await this.prisma.student_outcomes.findFirst({
      where: { student_id, tenant_id },
      include: {
        students: {
          select: {
            id: true,
            full_name: true,
            current_group_id: true,
            groups: { select: { name: true } },
          },
        },
      },
    });

    if (!outcome) {
      return { data: null };
    }

    return {
      data: {
        id: outcome.id.toString(),
        studentId: outcome.student_id.toString(),
        studentName: outcome.students.full_name,
        groupId: outcome.students.current_group_id?.toString() || null,
        groupName: outcome.students.groups?.name || null,
        outcomeStatus: outcome.outcome_status,
        institutionName: outcome.institution_name,
        facultyOrProgram: outcome.faculty_or_program,
        decisionDate: outcome.decision_date,
        source: outcome.source,
        notes: outcome.notes,
        createdAt: outcome.created_at,
      },
    };
  }

  async deleteOutcome(args: {
    tenantId: string;
    studentId: string;
    userId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const deleted_by_user_id = args.userId
      ? toBigInt(args.userId, 'userId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      const outcome = await tx.student_outcomes.findFirst({
        where: { student_id, tenant_id },
        select: { id: true, outcome_status: true },
      });
      if (!outcome) throw new NotFoundException('OUTCOME_NOT_FOUND');

      await tx.student_outcomes.delete({ where: { student_id } });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'student_outcomes',
        entityId: outcome.id,
        beforeData: {
          id: outcome.id.toString(),
          outcomeStatus: outcome.outcome_status,
        },
        ipAddress: args.ipAddress,
      });

      return { ok: true, studentId: student_id.toString() };
    });
  }

  // ==================== STATISTICS ====================

  async getStatistics(args: { tenantId: string; groupId?: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const group_id = args.groupId ? toBigInt(args.groupId, 'groupId') : null;

    const studentWhere: Prisma.studentsWhereInput = {
      tenant_id,
      ...(group_id ? { current_group_id: group_id } : {}),
      archived_at: null,
    };

    // Certificates count
    const certificatesCount = await this.prisma.certificates.count({
      where: {
        tenant_id,
        ...(group_id ? { students: { current_group_id: group_id } } : {}),
      },
    });

    // Outcomes statistics
    const outcomeStats = await this.prisma.student_outcomes.groupBy({
      by: ['outcome_status'],
      where: {
        tenant_id,
        ...(group_id ? { students: { current_group_id: group_id } } : {}),
      },
      _count: { outcome_status: true },
    });

    // Top certificates by student count
    const topCertificates = await this.prisma.certificates.groupBy({
      by: ['title'],
      where: {
        tenant_id,
        ...(group_id ? { students: { current_group_id: group_id } } : {}),
      },
      _count: { title: true },
      orderBy: { _count: { title: 'desc' } },
      take: 5,
    });

    return {
      certificates: {
        total: certificatesCount,
        topTitles: topCertificates.map((item) => ({
          title: item.title,
          count: item._count.title,
        })),
      },
      outcomes: {
        total: outcomeStats.reduce(
          (sum, item) => sum + item._count.outcome_status,
          0,
        ),
        byStatus: outcomeStats.reduce(
          (acc, item) => {
            acc[item.outcome_status] = item._count.outcome_status;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }

  // ==================== GUARDIAN ENDPOINTS ====================

  async guardianCertificates(args: { studentAccountId: string }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );

    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: { select: { full_name: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');
    }

    const certificates = await this.prisma.certificates.findMany({
      where: {
        tenant_id: account.tenant_id,
        student_id: account.student_id,
      },
      orderBy: [{ issued_at: 'desc' }, { created_at: 'desc' }],
      include: {
        subjects: { select: { name: true } },
        files: { select: { file_name: true, url: true } },
      },
    });

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
      },
      certificates: certificates.map((c) => ({
        id: c.id.toString(),
        title: c.title,
        issuer: c.issuer,
        score: c.score,
        issuedAt: c.issued_at,
        subject: c.subjects?.name || null,
        file: c.files
          ? {
              name: c.files.file_name,
              url: c.files.url,
            }
          : null,
        notes: c.notes,
      })),
    };
  }

  async guardianOutcome(args: { studentAccountId: string }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );

    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: { select: { full_name: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');
    }

    const outcome = await this.prisma.student_outcomes.findUnique({
      where: { student_id: account.student_id },
    });

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
      },
      outcome: outcome
        ? {
            id: outcome.id.toString(),
            outcomeStatus: outcome.outcome_status,
            institutionName: outcome.institution_name,
            facultyOrProgram: outcome.faculty_or_program,
            decisionDate: outcome.decision_date,
            source: outcome.source,
            notes: outcome.notes,
          }
        : null,
    };
  }
}
