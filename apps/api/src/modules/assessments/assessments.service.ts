// apps/api/src/modules/assessments/assessments.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpsertAssessmentScoresDto } from './dto/upsert-scores.dto';
import {
  AssessmentListQueryDto,
  GuardianGradesQueryDto,
} from './dto/assessment-list.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class AssessmentsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  async create(args: {
    tenantId: string;
    createdByUserId: string;
    dto: CreateAssessmentDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const created_by_user_id = args.createdByUserId
      ? toBigInt(args.createdByUserId, 'createdByUserId')
      : null;
    const group_id = toBigInt(args.dto.groupId, 'groupId');
    const subject_id = toBigInt(args.dto.subjectId, 'subjectId');

    return await this.prisma.$transaction(async (tx) => {
      // 1. Group exists and belongs to tenant
      const group = await tx.groups.findFirst({
        where: {
          id: group_id,
          tenant_id,
        },
        select: {
          id: true,
          academic_year_id: true,
          group_subjects: {
            where: { subject_id },
            select: { subject_id: true },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('GROUP_NOT_FOUND');
      }

      // 2. Check if group studies this subject
      if (!group.group_subjects.length) {
        throw new BadRequestException('GROUP_DOES_NOT_STUDY_SUBJECT');
      }

      // 3. Subject exists and belongs to tenant
      const subject = await tx.subjects.findFirst({
        where: {
          id: subject_id,
          tenant_id,
        },
        select: { id: true, name: true },
      });

      if (!subject) {
        throw new NotFoundException('SUBJECT_NOT_FOUND');
      }

      // 4. Validate dates
      const held_at = new Date(args.dto.heldAt);
      if (isNaN(held_at.getTime())) {
        throw new BadRequestException('INVALID_HELD_AT_DATE');
      }

      if (held_at > new Date()) {
        throw new BadRequestException('HELD_AT_CANNOT_BE_IN_FUTURE');
      }

      // 5. Create assessment
      const assessment = await tx.assessments.create({
        data: {
          tenant_id,
          academic_year_id: group.academic_year_id,
          group_id,
          subject_id,
          type: args.dto.type,
          title: args.dto.title.trim(),
          max_score: args.dto.maxScore ?? 100,
          weight: args.dto.weight ?? 1.0,
          held_at,
          is_published_to_guardians: args.dto.publishToGuardians ?? false,
          created_by_user_id,
        },
        include: {
          groups: {
            select: { name: true },
          },
          subjects: {
            select: { name: true },
          },
        },
      });

      // 6. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: created_by_user_id,
        action: 'CREATE',
        entityType: 'assessments',
        entityId: assessment.id,
        afterData: {
          id: assessment.id.toString(),
          title: assessment.title,
          type: assessment.type,
          group: assessment.groups.name,
          subject: assessment.subjects.name,
          heldAt: assessment.held_at,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: assessment.id.toString(),
        title: assessment.title,
        type: assessment.type,
        group: assessment.groups.name,
        subject: assessment.subjects.name,
        heldAt: assessment.held_at,
        isPublished: assessment.is_published_to_guardians,
      };
    });
  }

  async list(args: { tenantId: string; query: AssessmentListQueryDto }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 20, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.assessmentsWhereInput = {
      tenant_id,
    };

    if (args.query.groupId) {
      where.group_id = toBigInt(args.query.groupId, 'groupId');
    }

    if (args.query.subjectId) {
      where.subject_id = toBigInt(args.query.subjectId, 'subjectId');
    }

    if (args.query.type) {
      where.type = args.query.type;
    }

    if (args.query.from || args.query.to) {
      where.held_at = {};
      if (args.query.from) {
        where.held_at.gte = new Date(args.query.from);
      }
      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        where.held_at.lte = toDate;
      }
    }

    const orderBy: Prisma.assessmentsOrderByWithRelationInput = {};
    if (args.query.sortBy === 'title') {
      orderBy.title = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'type') {
      orderBy.type = args.query.sortDir ?? 'desc';
    } else if (args.query.sortBy === 'created_at') {
      orderBy.created_at = args.query.sortDir ?? 'desc';
    } else {
      orderBy.held_at = args.query.sortDir ?? 'desc';
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.assessments.count({ where }),
      this.prisma.assessments.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          groups: {
            select: {
              id: true,
              name: true,
              grade: true,
            },
          },
          subjects: {
            select: {
              id: true,
              name: true,
              is_core: true,
            },
          },
          users: {
            select: {
              id: true,
              full_name: true,
            },
          },
          _count: {
            select: {
              assessment_scores: true,
            },
          },
        },
      }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id.toString(),
        title: item.title,
        type: item.type,
        weight: item.weight,
        maxScore: item.max_score,
        heldAt: item.held_at,
        isPublished: item.is_published_to_guardians,
        createdAt: item.created_at,
        group: {
          id: item.groups.id.toString(),
          name: item.groups.name,
          grade: item.groups.grade,
        },
        subject: {
          id: item.subjects.id.toString(),
          name: item.subjects.name,
          isCore: item.subjects.is_core,
        },
        createdBy: item.users
          ? {
              id: item.users.id.toString(),
              name: item.users.full_name,
            }
          : null,
        scoresCount: item._count.assessment_scores,
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

  async getDetail(args: { tenantId: string; assessmentId: string }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const assessment_id = toBigInt(args.assessmentId, 'assessmentId');

    const assessment = await this.prisma.assessments.findFirst({
      where: {
        id: assessment_id,
        tenant_id,
      },
      include: {
        groups: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            is_core: true,
          },
        },
        users: {
          select: {
            id: true,
            full_name: true,
          },
        },
        assessment_scores: {
          include: {
            students: {
              select: {
                id: true,
                full_name: true,
              },
            },
            users: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
          orderBy: {
            entered_at: 'desc',
          },
        },
      },
    });

    if (!assessment) {
      throw new NotFoundException('ASSESSMENT_NOT_FOUND');
    }

    const scores = assessment.assessment_scores.map((score) => ({
      studentId: score.student_id.toString(),
      studentName: score.students.full_name,
      score: score.score,
      teacherComment: score.teacher_comment,
      enteredBy: score.users
        ? {
            id: score.users.id.toString(),
            name: score.users.full_name,
          }
        : null,
      enteredAt: score.entered_at,
    }));

    const stats = {
      totalStudents: scores.length,
      averageScore: scores.length
        ? scores.reduce((sum, s) => sum + Number(s.score), 0) / scores.length
        : 0,
      maxScore: scores.length
        ? Math.max(...scores.map((s) => Number(s.score)))
        : 0,
      minScore: scores.length
        ? Math.min(...scores.map((s) => Number(s.score)))
        : 0,
      passedCount: scores.filter(
        (s) => Number(s.score) >= Number(assessment.max_score) * 0.6,
      ).length,
    };

    return {
      id: assessment.id.toString(),
      title: assessment.title,
      type: assessment.type,
      weight: assessment.weight,
      maxScore: assessment.max_score,
      heldAt: assessment.held_at,
      isPublished: assessment.is_published_to_guardians,
      createdAt: assessment.created_at,
      group: {
        id: assessment.groups.id.toString(),
        name: assessment.groups.name,
        grade: assessment.groups.grade,
      },
      subject: {
        id: assessment.subjects.id.toString(),
        name: assessment.subjects.name,
        isCore: assessment.subjects.is_core,
      },
      createdBy: assessment.users
        ? {
            id: assessment.users.id.toString(),
            name: assessment.users.full_name,
          }
        : null,
      scores,
      stats,
    };
  }

  async upsertScores(args: {
    tenantId: string;
    assessmentId: string;
    enteredByUserId: string;
    dto: UpsertAssessmentScoresDto;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const assessment_id = toBigInt(args.assessmentId, 'assessmentId');
    const entered_by_user_id = args.enteredByUserId
      ? toBigInt(args.enteredByUserId, 'enteredByUserId')
      : null;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Assessment exists and belongs to tenant
      const assessment = await tx.assessments.findFirst({
        where: {
          id: assessment_id,
          tenant_id,
        },
        select: {
          id: true,
          title: true,
          max_score: true,
          group_id: true,
        },
      });

      if (!assessment) {
        throw new NotFoundException('ASSESSMENT_NOT_FOUND');
      }

      // 2. Get all students in this group
      const groupStudents = await tx.students.findMany({
        where: {
          tenant_id,
          current_group_id: assessment.group_id,
          archived_at: null,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          full_name: true,
        },
      });

      const groupStudentIds = new Set(
        groupStudents.map((s) => s.id.toString()),
      );

      // 3. Validate all student IDs belong to this group
      for (const item of args.dto.scores) {
        if (!groupStudentIds.has(item.studentId)) {
          throw new BadRequestException(
            `STUDENT_NOT_IN_GROUP: ${item.studentId}`,
          );
        }

        // Validate score doesn't exceed max_score
        if (Number(item.score) > Number(assessment.max_score)) {
          throw new BadRequestException(
            `SCORE_EXCEEDS_MAX: ${item.score} > ${assessment.max_score}`,
          );
        }
      }

      // 4. Upsert scores
      const operations = args.dto.scores.map(async (item) => {
        const student_id = toBigInt(item.studentId, 'studentId');

        return tx.assessment_scores.upsert({
          where: {
            assessment_id_student_id: {
              assessment_id,
              student_id,
            },
          },
          update: {
            score: item.score,
            teacher_comment: item.teacherComment?.trim() || null,
            entered_by_user_id,
            entered_at: new Date(),
          },
          create: {
            assessment_id,
            student_id,
            score: item.score,
            teacher_comment: item.teacherComment?.trim() || null,
            entered_by_user_id,
            entered_at: new Date(),
          },
        });
      });

      await Promise.all(operations);

      // 5. Audit log
      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: entered_by_user_id,
        action: 'UPDATE',
        entityType: 'assessment_scores',
        entityId: assessment_id,
        afterData: {
          assessmentId: assessment_id.toString(),
          assessmentTitle: assessment.title,
          scoresCount: args.dto.scores.length,
          scores: args.dto.scores.map((s) => ({
            studentId: s.studentId,
            score: s.score,
          })),
        },
        ipAddress: args.ipAddress,
      });

      return {
        ok: true,
        count: operations.length,
        message: `Scores saved for ${operations.length} students`,
      };
    });
  }

  async publishResults(args: {
    tenantId: string;
    assessmentId: string;
    actorUserId: string;
    publish: boolean;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const assessment_id = toBigInt(args.assessmentId, 'assessmentId');
    const actor_user_id = toBigInt(args.actorUserId, 'actorUserId');

    const assessment = await this.prisma.assessments.findFirst({
      where: {
        id: assessment_id,
        tenant_id,
      },
      select: {
        id: true,
        title: true,
        is_published_to_guardians: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('ASSESSMENT_NOT_FOUND');
    }

    if (assessment.is_published_to_guardians === args.publish) {
      return {
        ok: true,
        alreadyInState: true,
        isPublished: assessment.is_published_to_guardians,
      };
    }

    const updated = await this.prisma.assessments.update({
      where: { id: assessment_id },
      data: { is_published_to_guardians: args.publish },
      select: {
        id: true,
        title: true,
        is_published_to_guardians: true,
      },
    });

    await this.auditLogger.log({
      tenantId: tenant_id,
      actorType: 'STAFF',
      actorUserId: actor_user_id,
      action: args.publish ? 'PUBLISH' : 'UNPUBLISH',
      entityType: 'assessments',
      entityId: assessment_id,
      beforeData: { isPublished: assessment.is_published_to_guardians },
      afterData: { isPublished: updated.is_published_to_guardians },
      ipAddress: args.ipAddress,
    });

    return {
      ok: true,
      isPublished: updated.is_published_to_guardians,
    };
  }

  async guardianGrades(args: {
    studentAccountId: string;
    query: GuardianGradesQueryDto;
  }) {
    const student_account_id = toBigInt(
      args.studentAccountId,
      'studentAccountId',
    );
    const page = args.query.page ?? 1;
    const limit = Math.min(args.query.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    // Get student info from guardian account
    const account = await this.prisma.student_accounts.findUnique({
      where: { id: student_account_id },
      select: {
        student_id: true,
        tenant_id: true,
        students: {
          select: {
            full_name: true,
            current_group_id: true,
            groups: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('ACCOUNT_NOT_FOUND');
    }

    const where: Prisma.assessment_scoresWhereInput = {
      student_id: account.student_id,
      assessments: {
        tenant_id: account.tenant_id,
        is_published_to_guardians: true,
      },
    };

    if (args.query.subjectId) {
      (where.assessments as Prisma.assessmentsWhereInput).subject_id = toBigInt(
        args.query.subjectId,
        'subjectId',
      );
    }

    if (args.query.from || args.query.to) {
      const heldAtFilter: Prisma.DateTimeFilter = {};

      if (args.query.from) {
        heldAtFilter.gte = new Date(args.query.from);
      }
      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        heldAtFilter.lte = toDate;
      }

      (where.assessments as Prisma.assessmentsWhereInput).held_at =
        heldAtFilter;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.assessment_scores.count({ where }),
      this.prisma.assessment_scores.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          assessments: {
            held_at: 'desc',
          },
        },
        include: {
          assessments: {
            include: {
              subjects: {
                select: {
                  id: true,
                  name: true,
                  is_core: true,
                },
              },
              groups: {
                select: {
                  id: true,
                  name: true,
                  grade: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate subject summaries
    const subjectSummaries = new Map();
    for (const item of items) {
      const subjectId = item.assessments.subjects.id.toString();
      const subjectName = item.assessments.subjects.name;

      if (!subjectSummaries.has(subjectId)) {
        subjectSummaries.set(subjectId, {
          subjectId,
          subjectName,
          totalScore: 0,
          count: 0,
          maxPossible: 0,
        });
      }

      const summary = subjectSummaries.get(subjectId);
      summary.totalScore += Number(item.score);
      summary.count += 1;
      summary.maxPossible +=
        Number(item.assessments.max_score) * Number(item.assessments.weight);
    }

    return {
      student: {
        id: account.student_id.toString(),
        fullName: account.students.full_name,
        group: account.students.groups?.name || null,
      },
      grades: items.map((item) => ({
        id: item.assessments.id.toString(),
        title: item.assessments.title,
        type: item.assessments.type,
        subject: {
          id: item.assessments.subjects.id.toString(),
          name: item.assessments.subjects.name,
          isCore: item.assessments.subjects.is_core,
        },
        group: {
          id: item.assessments.groups.id.toString(),
          name: item.assessments.groups.name,
          grade: item.assessments.groups.grade,
        },
        heldAt: item.assessments.held_at,
        score: item.score,
        maxScore: item.assessments.max_score,
        weight: item.assessments.weight,
        percentage:
          (Number(item.score) / Number(item.assessments.max_score)) * 100,
        teacherComment: item.teacher_comment,
        enteredAt: item.entered_at,
      })),
      subjectSummaries: Array.from(subjectSummaries.values()).map((s) => ({
        ...s,
        averageScore: s.count > 0 ? s.totalScore / s.count : 0,
        averagePercentage:
          s.maxPossible > 0 ? (s.totalScore / s.maxPossible) * 100 : 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getGroupStatistics(args: {
    tenantId: string;
    groupId: string;
    from?: string;
    to?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const group_id = toBigInt(args.groupId, 'groupId');

    // Get all assessments for this group
    const assessments = await this.prisma.assessments.findMany({
      where: {
        tenant_id,
        group_id,
        ...(args.from || args.to
          ? {
              held_at: {
                ...(args.from ? { gte: new Date(args.from) } : {}),
                ...(args.to
                  ? {
                      lte: new Date(
                        new Date(args.to).setHours(23, 59, 59, 999),
                      ),
                    }
                  : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        max_score: true,
        weight: true,
        type: true,
        subject_id: true,
        subjects: {
          select: {
            id: true,
            name: true,
          },
        },
        assessment_scores: {
          select: {
            student_id: true,
            score: true,
          },
        },
      },
    });

    // Group statistics by subject
    const subjectStats = new Map();
    const studentStats = new Map();

    for (const assessment of assessments) {
      const subjectId = assessment.subject_id.toString();
      const subjectName = assessment.subjects.name;

      // Initialize subject stats
      if (!subjectStats.has(subjectId)) {
        subjectStats.set(subjectId, {
          subjectId,
          subjectName,
          totalScore: 0,
          count: 0,
          sumPercentage: 0,
          assessmentsCount: 0,
        });
      }

      const sStat = subjectStats.get(subjectId);
      sStat.assessmentsCount += 1;

      for (const score of assessment.assessment_scores) {
        const studentId = score.student_id.toString();
        const percentage =
          (Number(score.score) / Number(assessment.max_score)) * 100;
        const weightedScore = Number(score.score) * Number(assessment.weight);

        // Subject stats
        sStat.totalScore += Number(score.score);
        sStat.count += 1;
        sStat.sumPercentage += percentage;

        // Student stats
        if (!studentStats.has(studentId)) {
          studentStats.set(studentId, {
            studentId,
            totalWeightedScore: 0,
            count: 0,
            scores: [],
          });
        }

        const stStat = studentStats.get(studentId);
        stStat.totalWeightedScore += weightedScore;
        stStat.count += 1;
        stStat.scores.push({
          assessmentId: assessment.id.toString(),
          assessmentTitle: assessment.title,
          score: score.score,
          percentage,
          weight: assessment.weight,
          subject: assessment.subjects.name,
        });
      }
    }

    return {
      overview: {
        totalAssessments: assessments.length,
        totalScores: assessments.reduce(
          (sum, a) => sum + a.assessment_scores.length,
          0,
        ),
        averageScore: assessments.length
          ? assessments.reduce(
              (sum, a) =>
                sum +
                a.assessment_scores.reduce((s, sc) => s + Number(sc.score), 0),
              0,
            ) /
            assessments.reduce((sum, a) => sum + a.assessment_scores.length, 0)
          : 0,
        averagePercentage: assessments.length
          ? assessments.reduce(
              (sum, a) =>
                sum +
                a.assessment_scores.reduce(
                  (s, sc) => s + (Number(sc.score) / Number(a.max_score)) * 100,
                  0,
                ),
              0,
            ) /
            assessments.reduce((sum, a) => sum + a.assessment_scores.length, 0)
          : 0,
      },
      bySubject: Array.from(subjectStats.values()).map((s) => ({
        ...s,
        averageScore: s.count > 0 ? s.totalScore / s.count : 0,
        averagePercentage: s.count > 0 ? s.sumPercentage / s.count : 0,
      })),
      byStudent: Array.from(studentStats.values()).map((s) => ({
        ...s,
        averageWeightedScore: s.count > 0 ? s.totalWeightedScore / s.count : 0,
      })),
    };
  }
}
