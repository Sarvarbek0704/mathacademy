// apps/api/src/modules/discipline/discipline.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateViolationDto } from './dto/create-violation.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';
import { CreateDisciplineActionDto } from './dto/create-action.dto';
import { UpdateDisciplineActionDto } from './dto/update-action.dto';
import { ListViolationsQueryDto } from './dto/list-violations.query.dto';
import { ListActionsQueryDto } from './dto/list-actions.query.dto';
import { GuardianDisciplineQueryDto } from './dto/guardian-discipline.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class DisciplineService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== VIOLATIONS ====================

  async createViolation(args: {
    tenantId: string;
    recordedByUserId: string;
    dto: CreateViolationDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const recorded_by_user_id = args.recordedByUserId
        ? toBigInt(args.recordedByUserId, 'recordedByUserId')
        : null;
      const student_id = toBigInt(args.dto.studentId, 'studentId');

      return await this.prisma.$transaction(async (tx) => {
        // 1. Student exists and belongs to tenant
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id, archived_at: null },
          select: { id: true, full_name: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // 2. Evidence file exists if provided
        let evidence_file_id: bigint | null = null;
        if (args.dto.evidenceFileId) {
          evidence_file_id = toBigInt(
            args.dto.evidenceFileId,
            'evidenceFileId',
          );
          const file = await tx.files.findFirst({
            where: { id: evidence_file_id, tenant_id },
            select: { id: true },
          });
          if (!file) throw new NotFoundException('FILE_NOT_FOUND');
        }

        // 3. Linked discipline action exists if provided
        let linked_action_id: bigint | null = null;
        if (args.dto.linkedDisciplineActionId) {
          linked_action_id = toBigInt(
            args.dto.linkedDisciplineActionId,
            'linkedDisciplineActionId',
          );
          const action = await tx.discipline_actions.findFirst({
            where: { id: linked_action_id, tenant_id },
            select: { id: true },
          });
          if (!action)
            throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');
        }

        // 4. Create violation
        const violation = await tx.violations.create({
          data: {
            tenant_id,
            student_id,
            rule_code: args.dto.ruleCode.trim(),
            description: args.dto.description.trim(),
            severity: args.dto.severity || 'LOW',
            evidence_file_id,
            detected_at: args.dto.detectedAt
              ? new Date(args.dto.detectedAt)
              : new Date(),
            recorded_by_user_id,
            linked_discipline_action_id: linked_action_id,
          },
          include: {
            students: { select: { full_name: true } },
            files: { select: { id: true, file_name: true, url: true } },
          },
        });

        // 5. Audit log
        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: recorded_by_user_id,
          action: 'CREATE',
          entityType: 'violations',
          entityId: violation.id,
          afterData: {
            id: violation.id.toString(),
            studentId: student_id.toString(),
            studentName: violation.students.full_name,
            ruleCode: violation.rule_code,
            severity: violation.severity,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: violation.id.toString(),
          studentId: violation.student_id.toString(),
          studentName: violation.students.full_name,
          ruleCode: violation.rule_code,
          description: violation.description,
          severity: violation.severity,
          detectedAt: violation.detected_at,
          evidenceFile: violation.files
            ? {
                id: violation.files.id.toString(),
                name: violation.files.file_name,
                url: violation.files.url,
              }
            : null,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listViolations(args: {
    tenantId: string;
    query: ListViolationsQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.violationsWhereInput = {
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

      if (args.query.severity) {
        where.severity = args.query.severity;
      }

      if (args.query.from || args.query.to) {
        where.detected_at = {};
        if (args.query.from) {
          where.detected_at.gte = new Date(args.query.from);
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          where.detected_at.lte = toDate;
        }
      }

      const orderBy: Prisma.violationsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'detectedAt') {
        orderBy.detected_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'severity') {
        orderBy.severity = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'ruleCode') {
        orderBy.rule_code = args.query.sortDir ?? 'desc';
      } else {
        orderBy.detected_at = 'desc';
        orderBy.id = 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.violations.count({ where }),
        this.prisma.violations.findMany({
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
            files: { select: { id: true, file_name: true, url: true } },
            discipline_actions: {
              select: {
                id: true,
                action_type: true,
                is_active: true,
              },
            },
          },
        }),
      ]);

      return {
        data: items.map((v) => ({
          id: v.id.toString(),
          studentId: v.student_id.toString(),
          studentName: v.students.full_name,
          groupId: v.students.current_group_id?.toString() || null,
          groupName: v.students.groups?.name || null,
          ruleCode: v.rule_code,
          description: v.description,
          severity: v.severity,
          detectedAt: v.detected_at,
          evidenceFile: v.files
            ? {
                id: v.files.id.toString(),
                name: v.files.file_name,
                url: v.files.url,
              }
            : null,
          linkedAction: v.discipline_actions
            ? {
                id: v.discipline_actions.id.toString(),
                actionType: v.discipline_actions.action_type,
                isActive: v.discipline_actions.is_active,
              }
            : null,
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

  async getViolationById(args: { tenantId: string; violationId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const violation_id = toBigInt(args.violationId, 'violationId');

      const violation = await this.prisma.violations.findFirst({
        where: { id: violation_id, tenant_id },
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              current_group_id: true,
              groups: { select: { name: true } },
            },
          },
          files: { select: { id: true, file_name: true, url: true } },
          discipline_actions: {
            select: {
              id: true,
              action_type: true,
              reason: true,
              issued_at: true,
              is_active: true,
            },
          },
          users: { select: { id: true, full_name: true } },
        },
      });

      if (!violation) {
        throw new NotFoundException('VIOLATION_NOT_FOUND');
      }

      return {
        id: violation.id.toString(),
        studentId: violation.student_id.toString(),
        studentName: violation.students.full_name,
        groupId: violation.students.current_group_id?.toString() || null,
        groupName: violation.students.groups?.name || null,
        ruleCode: violation.rule_code,
        description: violation.description,
        severity: violation.severity,
        detectedAt: violation.detected_at,
        evidenceFile: violation.files
          ? {
              id: violation.files.id.toString(),
              name: violation.files.file_name,
              url: violation.files.url,
            }
          : null,
        linkedAction: violation.discipline_actions
          ? {
              id: violation.discipline_actions.id.toString(),
              actionType: violation.discipline_actions.action_type,
              reason: violation.discipline_actions.reason,
              issuedAt: violation.discipline_actions.issued_at,
              isActive: violation.discipline_actions.is_active,
            }
          : null,
        recordedBy: violation.users
          ? {
              id: violation.users.id.toString(),
              name: violation.users.full_name,
            }
          : null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateViolation(args: {
    tenantId: string;
    violationId: string;
    userId: string;
    dto: UpdateViolationDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const violation_id = toBigInt(args.violationId, 'violationId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.violations.findFirst({
          where: { id: violation_id, tenant_id },
          include: { students: { select: { full_name: true } } },
        });
        if (!existing) throw new NotFoundException('VIOLATION_NOT_FOUND');

        const updateData: Prisma.violationsUpdateInput = {};

        if (args.dto.ruleCode !== undefined) {
          updateData.rule_code = args.dto.ruleCode.trim();
        }
        if (args.dto.description !== undefined) {
          updateData.description = args.dto.description.trim();
        }
        if (args.dto.severity !== undefined) {
          updateData.severity = args.dto.severity;
        }
        if (args.dto.detectedAt !== undefined) {
          if (args.dto.detectedAt && args.dto.detectedAt.trim() !== '') {
            updateData.detected_at = new Date(args.dto.detectedAt);
          }
        }
        if (args.dto.evidenceFileId !== undefined) {
          if (args.dto.evidenceFileId) {
            const file_id = toBigInt(args.dto.evidenceFileId, 'evidenceFileId');
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
        if (args.dto.linkedDisciplineActionId !== undefined) {
          if (args.dto.linkedDisciplineActionId) {
            const action_id = toBigInt(
              args.dto.linkedDisciplineActionId,
              'linkedDisciplineActionId',
            );
            const action = await tx.discipline_actions.findFirst({
              where: { id: action_id, tenant_id },
              select: { id: true },
            });
            if (!action)
              throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');
            updateData.discipline_actions = { connect: { id: action_id } };
          } else {
            updateData.discipline_actions = { disconnect: true };
          }
        }

        const updated = await tx.violations.update({
          where: { id: violation_id },
          data: updateData,
          include: {
            students: { select: { full_name: true } },
            files: { select: { file_name: true, url: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'violations',
          entityId: violation_id,
          beforeData: {
            id: existing.id.toString(),
            ruleCode: existing.rule_code,
          },
          afterData: {
            id: updated.id.toString(),
            ruleCode: updated.rule_code,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          studentId: updated.student_id.toString(),
          studentName: updated.students.full_name,
          ruleCode: updated.rule_code,
          description: updated.description,
          severity: updated.severity,
          detectedAt: updated.detected_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteViolation(args: {
    tenantId: string;
    violationId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const violation_id = toBigInt(args.violationId, 'violationId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const violation = await tx.violations.findFirst({
          where: { id: violation_id, tenant_id },
          select: { id: true, rule_code: true, student_id: true },
        });
        if (!violation) throw new NotFoundException('VIOLATION_NOT_FOUND');

        await tx.violations.delete({ where: { id: violation_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'violations',
          entityId: violation_id,
          beforeData: {
            id: violation.id.toString(),
            ruleCode: violation.rule_code,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: violation_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== DISCIPLINE ACTIONS ====================

  async createAction(args: {
    tenantId: string;
    issuedByUserId: string;
    dto: CreateDisciplineActionDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const issued_by_user_id = args.issuedByUserId
        ? toBigInt(args.issuedByUserId, 'issuedByUserId')
        : null;
      const student_id = toBigInt(args.dto.studentId, 'studentId');

      return await this.prisma.$transaction(async (tx) => {
        // 1. Student exists and belongs to tenant
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id, archived_at: null },
          select: { id: true, full_name: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // 2. Related assessment exists if provided
        let related_assessment_id: bigint | null = null;
        if (args.dto.relatedAssessmentId) {
          related_assessment_id = toBigInt(
            args.dto.relatedAssessmentId,
            'relatedAssessmentId',
          );
          const assessment = await tx.assessments.findFirst({
            where: { id: related_assessment_id, tenant_id },
            select: { id: true },
          });
          if (!assessment) throw new NotFoundException('ASSESSMENT_NOT_FOUND');
        }

        // 3. Create discipline action
        const action = await tx.discipline_actions.create({
          data: {
            tenant_id,
            student_id,
            action_type: args.dto.actionType,
            reason: args.dto.reason.trim(),
            issued_by_user_id,
            issued_at: args.dto.issuedAt
              ? new Date(args.dto.issuedAt)
              : new Date(),
            related_assessment_id,
            is_active: args.dto.isActive ?? true,
          },
          include: {
            students: { select: { full_name: true } },
            users: { select: { full_name: true } },
          },
        });

        // 4. Link violations if provided
        if (args.dto.violationIds?.length) {
          const violationIds = args.dto.violationIds.map((id) =>
            toBigInt(id, 'violationId'),
          );

          // Verify violations belong to this student and tenant
          const violations = await tx.violations.findMany({
            where: {
              id: { in: violationIds },
              tenant_id,
              student_id,
            },
            select: { id: true },
          });

          if (violations.length !== violationIds.length) {
            throw new BadRequestException(
              'SOME_VIOLATIONS_NOT_FOUND_OR_NOT_BELONG_TO_STUDENT',
            );
          }

          await tx.violations.updateMany({
            where: { id: { in: violationIds } },
            data: { linked_discipline_action_id: action.id },
          });
        }

        // 5. Audit log
        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: issued_by_user_id,
          action: 'CREATE',
          entityType: 'discipline_actions',
          entityId: action.id,
          afterData: {
            id: action.id.toString(),
            studentId: student_id.toString(),
            studentName: student.full_name,
            actionType: action.action_type,
            reason: action.reason,
            isActive: action.is_active,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: action.id.toString(),
          studentId: action.student_id.toString(),
          studentName: action.students.full_name,
          actionType: action.action_type,
          reason: action.reason,
          issuedAt: action.issued_at,
          isActive: action.is_active,
          issuedBy: action.users?.full_name || null,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listActions(args: { tenantId: string; query: ListActionsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.discipline_actionsWhereInput = {
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

      if (args.query.active !== undefined) {
        where.is_active = args.query.active;
      }

      const orderBy: Prisma.discipline_actionsOrderByWithRelationInput = {};
      if (args.query.sortBy === 'issuedAt') {
        orderBy.issued_at = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'actionType') {
        orderBy.action_type = args.query.sortDir ?? 'desc';
      } else {
        orderBy.issued_at = 'desc';
        orderBy.id = 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.discipline_actions.count({ where }),
        this.prisma.discipline_actions.findMany({
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
            users: { select: { id: true, full_name: true } },
            assessments: { select: { id: true, title: true } },
            _count: {
              select: { violations: true },
            },
          },
        }),
      ]);

      return {
        data: items.map((a) => ({
          id: a.id.toString(),
          studentId: a.student_id.toString(),
          studentName: a.students.full_name,
          groupId: a.students.current_group_id?.toString() || null,
          groupName: a.students.groups?.name || null,
          actionType: a.action_type,
          reason: a.reason,
          issuedAt: a.issued_at,
          isActive: a.is_active,
          issuedBy: a.users?.full_name || null,
          relatedAssessment: a.assessments
            ? {
                id: a.assessments.id.toString(),
                title: a.assessments.title,
              }
            : null,
          violationsCount: a._count.violations,
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

  async getActionById(args: { tenantId: string; actionId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const action_id = toBigInt(args.actionId, 'actionId');

      const action = await this.prisma.discipline_actions.findFirst({
        where: { id: action_id, tenant_id },
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              current_group_id: true,
              groups: { select: { name: true } },
            },
          },
          users: { select: { id: true, full_name: true } },
          assessments: { select: { id: true, title: true } },
          violations: {
            select: {
              id: true,
              rule_code: true,
              description: true,
              severity: true,
              detected_at: true,
            },
          },
        },
      });

      if (!action) {
        throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');
      }

      return {
        id: action.id.toString(),
        studentId: action.student_id.toString(),
        studentName: action.students.full_name,
        groupId: action.students.current_group_id?.toString() || null,
        groupName: action.students.groups?.name || null,
        actionType: action.action_type,
        reason: action.reason,
        issuedAt: action.issued_at,
        isActive: action.is_active,
        issuedBy: action.users
          ? {
              id: action.users.id.toString(),
              name: action.users.full_name,
            }
          : null,
        relatedAssessment: action.assessments
          ? {
              id: action.assessments.id.toString(),
              title: action.assessments.title,
            }
          : null,
        violations: action.violations.map((v) => ({
          id: v.id.toString(),
          ruleCode: v.rule_code,
          description: v.description,
          severity: v.severity,
          detectedAt: v.detected_at,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateAction(args: {
    tenantId: string;
    actionId: string;
    userId: string;
    dto: UpdateDisciplineActionDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const action_id = toBigInt(args.actionId, 'actionId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.discipline_actions.findFirst({
          where: { id: action_id, tenant_id },
          include: { students: { select: { full_name: true } } },
        });
        if (!existing)
          throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');

        const updateData: Prisma.discipline_actionsUpdateInput = {};

        if (args.dto.actionType !== undefined) {
          updateData.action_type = args.dto.actionType;
        }
        if (args.dto.reason !== undefined) {
          updateData.reason = args.dto.reason.trim();
        }
        if (args.dto.issuedAt !== undefined) {
          if (args.dto.issuedAt && args.dto.issuedAt.trim() !== '') {
            updateData.issued_at = new Date(args.dto.issuedAt);
          }
        }
        if (args.dto.relatedAssessmentId !== undefined) {
          if (args.dto.relatedAssessmentId) {
            const assessment_id = toBigInt(
              args.dto.relatedAssessmentId,
              'relatedAssessmentId',
            );
            const assessment = await tx.assessments.findFirst({
              where: { id: assessment_id, tenant_id },
              select: { id: true },
            });
            if (!assessment)
              throw new NotFoundException('ASSESSMENT_NOT_FOUND');
            updateData.assessments = { connect: { id: assessment_id } };
          } else {
            updateData.assessments = { disconnect: true };
          }
        }
        if (args.dto.isActive !== undefined) {
          updateData.is_active = args.dto.isActive;
        }

        const updated = await tx.discipline_actions.update({
          where: { id: action_id },
          data: updateData,
          include: {
            students: { select: { full_name: true } },
            users: { select: { full_name: true } },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'discipline_actions',
          entityId: action_id,
          beforeData: {
            id: existing.id.toString(),
            actionType: existing.action_type,
            isActive: existing.is_active,
          },
          afterData: {
            id: updated.id.toString(),
            actionType: updated.action_type,
            isActive: updated.is_active,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          actionType: updated.action_type,
          reason: updated.reason,
          issuedAt: updated.issued_at,
          isActive: updated.is_active,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteAction(args: {
    tenantId: string;
    actionId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const action_id = toBigInt(args.actionId, 'actionId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const action = await tx.discipline_actions.findFirst({
          where: { id: action_id, tenant_id },
          select: { id: true, action_type: true },
        });
        if (!action) throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');

        // Unlink violations
        await tx.violations.updateMany({
          where: { linked_discipline_action_id: action_id },
          data: { linked_discipline_action_id: null },
        });

        await tx.discipline_actions.delete({ where: { id: action_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'discipline_actions',
          entityId: action_id,
          beforeData: {
            id: action.id.toString(),
            actionType: action.action_type,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: action_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async toggleActionStatus(args: {
    tenantId: string;
    actionId: string;
    userId: string;
    isActive: boolean;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const action_id = toBigInt(args.actionId, 'actionId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const action = await tx.discipline_actions.findFirst({
          where: { id: action_id, tenant_id },
          select: { id: true, action_type: true, is_active: true },
        });
        if (!action) throw new NotFoundException('DISCIPLINE_ACTION_NOT_FOUND');

        if (action.is_active === args.isActive) {
          return {
            ok: true,
            alreadyInState: true,
            isActive: action.is_active,
          };
        }

        const updated = await tx.discipline_actions.update({
          where: { id: action_id },
          data: { is_active: args.isActive },
          select: { id: true, is_active: true },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'discipline_actions',
          entityId: action_id,
          beforeData: { isActive: action.is_active },
          afterData: { isActive: updated.is_active },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          isActive: updated.is_active,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== GUARDIAN ====================

  async guardianDiscipline(args: {
    studentAccountId: string;
    query: GuardianDisciplineQueryDto;
  }) {
    try {
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
      if (!account) throw new NotFoundException('GUARDIAN_ACCOUNT_NOT_FOUND');

      const studentId = account.student_id;
      const tenantId = account.tenant_id;

      const dateFilter: Prisma.DateTimeFilter = {};
      if (args.query.from) dateFilter.gte = new Date(args.query.from);
      if (args.query.to) {
        const toDate = new Date(args.query.to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }

      const hasDateFilter = args.query.from || args.query.to;

      const [actions, violations] = await Promise.all([
        this.prisma.discipline_actions.findMany({
          where: {
            tenant_id: tenantId,
            student_id: studentId,
            ...(hasDateFilter ? { issued_at: dateFilter } : {}),
          },
          orderBy: [{ issued_at: 'desc' }, { id: 'desc' }],
          include: {
            users: { select: { full_name: true } },
            assessments: { select: { title: true } },
          },
        }),
        this.prisma.violations.findMany({
          where: {
            tenant_id: tenantId,
            student_id: studentId,
            ...(hasDateFilter ? { detected_at: dateFilter } : {}),
          },
          orderBy: [{ detected_at: 'desc' }, { id: 'desc' }],
          include: {
            files: { select: { file_name: true, url: true } },
            discipline_actions: { select: { action_type: true } },
          },
        }),
      ]);

      return {
        student: {
          id: studentId.toString(),
          fullName: account.students.full_name,
        },
        summary: {
          totalActions: actions.length,
          activeActions: actions.filter((a) => a.is_active).length,
          totalViolations: violations.length,
          bySeverity: violations.reduce(
            (acc, v) => {
              acc[v.severity] = (acc[v.severity] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>,
          ),
        },
        actions: actions.map((a) => ({
          id: a.id.toString(),
          actionType: a.action_type,
          reason: a.reason,
          issuedAt: a.issued_at,
          isActive: a.is_active,
          issuedBy: a.users?.full_name || null,
          relatedAssessment: a.assessments?.title || null,
        })),
        violations: violations.map((v) => ({
          id: v.id.toString(),
          ruleCode: v.rule_code,
          description: v.description,
          severity: v.severity,
          detectedAt: v.detected_at,
          evidenceFile: v.files
            ? {
                name: v.files.file_name,
                url: v.files.url,
              }
            : null,
          linkedAction: v.discipline_actions?.action_type || null,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getDisciplineSummary(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [violationCount, lastViolations] = await Promise.all([
      this.prisma.violations.count({
        where: {
          tenant_id,
          detected_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.violations.findMany({
        where: { tenant_id },
        take: 5,
        orderBy: { detected_at: 'desc' },
        include: {
          students: { select: { full_name: true } },
          users: { select: { full_name: true } },
        },
      }),
    ]);

    return {
      violationCount,
      lastViolations: lastViolations.map((v) => ({
        id: v.id.toString(),
        studentName: v.students.full_name,
        ruleCode: v.rule_code,
        severity: v.severity,
        detectedAt: v.detected_at,
        recordedBy: v.users?.full_name || 'System',
      })),
    };
  }
}
