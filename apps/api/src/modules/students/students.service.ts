// apps/api/src/modules/students/students.service.ts - YANGILANGAN VERSIYA
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  parseDateOnlyOrNow,
  parseDateOnly,
  toDateOnly,
} from '../../common/utils/date.util';
import { AuditLogger } from '../../common/utils/audit.util';

// Helper functions...
function toBigInt(v: unknown, field: string): bigint {
  const s = String(v ?? '').trim();
  if (!s || !/^\d+$/.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function prismaErrorToHttp(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') throw new ConflictException('ALREADY_EXISTS');
    if (e.code === 'P2003') throw new BadRequestException('INVALID_REFERENCE');
    if (e.code === 'P2025') throw new NotFoundException('NOT_FOUND');
  }
  throw e;
}

function generateTemporaryPassword(): string {
  // 12 character password with mix of letters, numbers, symbols
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateStudentLoginId(lastSeq: number): string {
  return String(lastSeq).padStart(6, '0');
}

function calculateGraduationYear(
  admissionGrade: number,
  admissionDate: Date,
): number {
  const admissionYear = admissionDate.getFullYear();
  const yearsToGraduate = 11 - admissionGrade; // Assuming 11th grade is final
  return admissionYear + yearsToGraduate;
}

@Injectable()
export class StudentsService {
  private auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== LIST STUDENTS ====================
  async list(args: {
    tenantId: string;
    q?: string;
    campusId?: string;
    groupId?: string;
    trackName?: string;
    status?: string;
    livingType?: string;
    admissionGrade?: number;
    admissionYear?: string;
    guardianProfileCompleted?: boolean;
    includeArchived?: boolean;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    limit: number;
    offset: number;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const q = String(args.q || '').trim();
      const limit = Math.max(1, Math.min(200, Number(args.limit || 50)));
      const offset = Math.max(0, Number(args.offset || 0));
      const sortBy = args.sortBy || 'id';
      const sortDir = args.sortDir || 'desc';

      // Build where clause
      const where: Prisma.studentsWhereInput = {
        tenant_id,
        ...(args.campusId
          ? { campus_id: toBigInt(args.campusId, 'campusId') }
          : {}),
        ...(args.groupId
          ? { current_group_id: toBigInt(args.groupId, 'groupId') }
          : {}),
        ...(args.status ? { status: String(args.status) } : {}),
        ...(args.livingType
          ? {
              living_types: { code: args.livingType },
            }
          : {}),
        ...(args.admissionGrade
          ? { admission_grade: args.admissionGrade }
          : {}),
        ...(args.includeArchived !== true ? { archived_at: null } : {}),
      };

      // Track filter
      if (args.trackName) {
        where.student_tracks = { name: args.trackName };
      }

      // Admission year filter
      if (args.admissionYear) {
        where.admission_date = {
          gte: new Date(`${args.admissionYear}-01-01`),
          lt: new Date(`${parseInt(args.admissionYear) + 1}-01-01`),
        };
      }

      // Guardian profile completion filter
      if (args.guardianProfileCompleted !== undefined) {
        where.student_accounts = args.guardianProfileCompleted
          ? { profile_completed_at: { not: null } }
          : { profile_completed_at: null };
      }

      // Search query
      if (q) {
        where.OR = [
          { full_name: { contains: q, mode: 'insensitive' } },
          {
            student_accounts: {
              is: { student_login_id: { contains: q, mode: 'insensitive' } },
            },
          },
          {
            student_accounts: {
              is: { profile_full_name: { contains: q, mode: 'insensitive' } },
            },
          },
        ];
      }

      // Order by
      const orderBy: any = {};
      if (sortBy === 'full_name') orderBy.full_name = sortDir;
      else if (sortBy === 'admission_date') orderBy.admission_date = sortDir;
      else if (sortBy === 'created_at') orderBy.created_at = sortDir;
      else orderBy.id = sortDir;

      const [rows, total] = await this.prisma.$transaction([
        this.prisma.students.findMany({
          where,
          orderBy,
          skip: offset,
          take: limit,
          include: {
            groups: { select: { id: true, name: true } },
            campuses: { select: { id: true, name: true } },
            student_tracks: { select: { id: true, name: true } },
            living_types: { select: { id: true, name: true, code: true } },
            student_accounts: {
              select: {
                student_login_id: true,
                profile_full_name: true,
                profile_completed_at: true,
                must_change_password: true,
              },
            },
          },
        }),
        this.prisma.students.count({ where }),
      ]);

      return {
        data: rows.map((r) => ({
          id: r.id.toString(),
          fullName: r.full_name,
          status: r.status,
          gender: r.gender,
          birthDate: r.birth_date,
          admissionGrade: r.admission_grade,
          admissionDate: r.admission_date,
          expectedGraduationYear: r.expected_graduation_year,
          createdAt: r.created_at,
          archivedAt: r.archived_at,
          notes: r.notes,
          campus: r.campuses
            ? {
                id: r.campuses.id.toString(),
                name: r.campuses.name,
              }
            : null,
          group: r.groups
            ? {
                id: r.groups.id.toString(),
                name: r.groups.name,
              }
            : null,
          track: r.student_tracks
            ? {
                id: r.student_tracks.id.toString(),
                name: r.student_tracks.name,
              }
            : null,
          livingType: r.living_types
            ? {
                id: r.living_types.id.toString(),
                name: r.living_types.name,
                code: r.living_types.code,
              }
            : null,
          guardianAccount: r.student_accounts
            ? {
                studentLoginId: r.student_accounts.student_login_id,
                profileFullName: r.student_accounts.profile_full_name,
                profileCompleted:
                  r.student_accounts.profile_completed_at !== null,
                mustChangePassword: r.student_accounts.must_change_password,
              }
            : null,
        })),
        meta: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  // ==================== CREATE STUDENT ====================
  async create(args: {
    tenantId: string;
    createdByUserId: string;
    dto: any;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const created_by_user_id = toBigInt(
      args.createdByUserId,
      'createdByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Validate and prepare data
        const full_name = String(args.dto.fullName || '').trim();
        if (!full_name) throw new BadRequestException('FULL_NAME_REQUIRED');

        const gender = args.dto.gender || null;
        const birth_date = args.dto.birthDate
          ? parseDateOnly(args.dto.birthDate, 'birthDate')
          : null;
        const admission_date = parseDateOnlyOrNow(
          args.dto.admissionDate,
          'admissionDate',
        );
        const admission_grade = Number(args.dto.admissionGrade ?? 10);

        if (![8, 9, 10, 11].includes(admission_grade)) {
          throw new BadRequestException('INVALID_ADMISSION_GRADE');
        }

        // Calculate expected graduation year if not provided
        let expected_graduation_year = args.dto.expectedGraduationYear;
        if (!expected_graduation_year) {
          expected_graduation_year = calculateGraduationYear(
            admission_grade,
            admission_date,
          );
        }

        // Get tenant slug for student ID generation
        const tenant = await tx.tenants.findUnique({
          where: { id: tenant_id },
          select: { slug: true, name: true },
        });
        if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');

        // Handle campus
        let campus_id: bigint | null = null;
        if (args.dto.campusId) {
          const campus = await tx.campuses.findFirst({
            where: {
              id: toBigInt(args.dto.campusId, 'campusId'),
              tenant_id,
              is_active: true,
            },
          });
          if (!campus) throw new BadRequestException('CAMPUS_NOT_FOUND');
          campus_id = campus.id;
        }

        // Handle group
        let current_group_id: bigint | null = null;
        if (args.dto.groupId) {
          const group = await tx.groups.findFirst({
            where: {
              id: toBigInt(args.dto.groupId, 'groupId'),
              tenant_id,
            },
          });
          if (!group) throw new BadRequestException('GROUP_NOT_FOUND');
          current_group_id = group.id;
        }

        // Handle track
        let track_id: bigint | null = null;
        if (args.dto.trackName) {
          let track = await tx.student_tracks.findFirst({
            where: {
              name: args.dto.trackName,
              tenant_id,
            },
          });

          if (!track) {
            // Create track if it doesn't exist
            track = await tx.student_tracks.create({
              data: {
                tenant_id,
                name: args.dto.trackName,
                description: `Track for ${args.dto.trackName}`,
              },
            });
          }
          track_id = track.id;
        }

        // Handle living type
        let living_type_id: bigint | null = null;
        if (args.dto.livingTypeCode) {
          const livingType = await tx.living_types.findFirst({
            where: {
              code: args.dto.livingTypeCode,
              tenant_id,
              is_active: true,
            },
          });
          if (!livingType)
            throw new BadRequestException('LIVING_TYPE_NOT_FOUND');
          living_type_id = livingType.id;
        }

        // Generate student login ID
        const seq = await tx.student_id_sequences.upsert({
          where: { tenant_id },
          create: { tenant_id, last_seq: 1 },
          update: { last_seq: { increment: 1 } },
          select: { last_seq: true },
        });

        const student_login_id = generateStudentLoginId(seq.last_seq);

        // Generate temporary password for guardian account
        const tempPassword = generateTemporaryPassword();
        const password_hash = await bcrypt.hash(tempPassword, 12);

        // Create student
        const student = await tx.students.create({
          data: {
            tenant_id,
            campus_id,
            current_group_id,
            track_id,
            living_type_id,
            full_name,
            gender,
            birth_date,
            admission_grade,
            admission_date,
            expected_graduation_year,
            status: args.dto.status || 'ACTIVE',
            notes: args.dto.notes,
            created_by_user_id,
          },
          select: { id: true, full_name: true },
        });

        // Create guardian account
        const guardianAccount = await tx.student_accounts.create({
          data: {
            tenant_id,
            student_id: student.id,
            student_login_id,
            password_hash,
            is_active: true,
            must_change_password: true,
            profile_full_name: args.dto.guardianFullName,
            profile_phone: args.dto.guardianPhone,
            profile_relation: args.dto.guardianRelation,
            telegram_username: args.dto.guardianTelegramUsername,
            profile_completed_at: args.dto.guardianFullName ? new Date() : null,
            created_by_user_id,
          },
        });

        // Record group history if group assigned
        if (current_group_id) {
          await tx.student_group_history.create({
            data: {
              tenant_id,
              student_id: student.id,
              group_id: current_group_id,
              start_date: new Date(), // yoki new Date(toDateOnly(new Date()))
              changed_by_user_id: created_by_user_id,
            },
          });
        }

        // Record living type history if living type assigned
        if (living_type_id) {
          await tx.student_living_history.create({
            data: {
              tenant_id,
              student_id: student.id,
              living_type_id,
              start_date: new Date(), // ✅ toDateOnly(new Date()) -> new Date()
              changed_by_user_id: created_by_user_id,
            },
          });
        }

        // Assign cohort if specified
        if (args.dto.cohortLabel) {
          let cohort = await tx.cohorts.findFirst({
            where: {
              label: args.dto.cohortLabel,
              tenant_id,
            },
          });

          if (!cohort) {
            // Create cohort if it doesn't exist
            const graduationYear = expected_graduation_year;
            cohort = await tx.cohorts.create({
              data: {
                tenant_id,
                label: args.dto.cohortLabel,
                graduation_year: graduationYear,
              },
            });
          }

          await tx.student_cohort.create({
            data: {
              student_id: student.id,
              cohort_id: cohort.id,
              assigned_by_user_id: created_by_user_id,
            },
          });
        }

        // Create timeline event
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id: student.id,
            event_type: 'STUDENT_CREATED',
            title: 'Student Created',
            details: `Student ${full_name} was created and assigned ID ${student_login_id}`,
            created_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          created_by_user_id,
          'CREATE',
          'students',
          student.id,
          {
            before: null,
            after: {
              fullName: full_name,
              studentLoginId: student_login_id,
              admissionGrade: admission_grade,
              admissionDate: admission_date,
            },
          },
          args.ipAddress,
        );

        return {
          success: true,
          student: {
            id: student.id.toString(),
            fullName: student.full_name,
            studentLoginId: student_login_id,
            guardianLogin: `${tenant.slug}-${student_login_id}`,
            temporaryPassword: tempPassword,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
          },
          guardianAccount: {
            studentLoginId: guardianAccount.student_login_id,
            mustChangePassword: guardianAccount.must_change_password,
            profileCompleted: guardianAccount.profile_completed_at !== null,
          },
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== GET STUDENT DETAILS ====================
  async detail(args: { tenantId: string; studentId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.studentId, 'studentId');

      const student = await this.prisma.students.findFirst({
        where: { id, tenant_id },
        include: {
          groups: {
            select: {
              id: true,
              name: true,
              academic_years: { select: { name: true } },
            },
          },
          campuses: { select: { id: true, name: true, address: true } },
          student_tracks: {
            select: { id: true, name: true, description: true },
          },
          living_types: {
            select: { id: true, name: true, code: true, description: true },
          },
          student_accounts: {
            select: {
              id: true,
              student_login_id: true,
              is_active: true,
              must_change_password: true,
              profile_full_name: true,
              profile_phone: true,
              profile_relation: true,
              telegram_username: true,
              telegram_chat_id: true,
              profile_completed_at: true,
              last_login_at: true,
              created_at: true,
            },
          },
          student_cohort: {
            include: {
              cohorts: {
                select: { id: true, label: true, graduation_year: true },
              },
            },
          },
          student_outcomes: {
            select: {
              outcome_status: true,
              institution_name: true,
              faculty_or_program: true,
              decision_date: true,
              source: true,
              notes: true,
            },
          },
          student_risk_scores: {
            orderBy: { calculated_at: 'desc' },
            take: 1,
            select: {
              score: true,
              level: true,
              signals: true,
              calculated_at: true,
              note: true,
            },
          },
        },
      });

      if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

      // Get group history
      const groupHistory = await this.prisma.student_group_history.findMany({
        where: { student_id: id, tenant_id },
        include: {
          groups: { select: { id: true, name: true } },
          users: { select: { id: true, full_name: true } },
        },
        orderBy: { start_date: 'desc' },
      });

      // Get living history
      const livingHistory = await this.prisma.student_living_history.findMany({
        where: { student_id: id, tenant_id },
        include: {
          living_types: { select: { id: true, name: true, code: true } },
          users: { select: { id: true, full_name: true } },
        },
        orderBy: { start_date: 'desc' },
      });

      // Get timeline events
      const timeline = await this.prisma.student_timeline.findMany({
        where: { student_id: id, tenant_id },
        include: {
          users: { select: { id: true, full_name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      });

      // Get recent assessments
      const recentAssessments = await this.prisma.assessment_scores.findMany({
        where: { student_id: id },
        include: {
          assessments: {
            select: {
              id: true,
              title: true,
              type: true,
              held_at: true,
              max_score: true,
              weight: true,
              subjects: { select: { name: true } },
              groups: { select: { name: true } },
            },
          },
        },
        orderBy: { assessments: { held_at: 'desc' } },
        take: 10,
      });

      // Get attendance summary
      const attendanceSummary = await this.prisma.attendance_marks.groupBy({
        by: ['status'],
        where: {
          students: { id: student.id },
          attendance_sessions: {
            session_date: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        _count: { status: true },
      });

      return {
        ...student,
        id: student.id.toString(),
        groupHistory: groupHistory.map((h) => ({
          id: h.id.toString(),
          groupId: h.group_id.toString(),
          groupName: h.groups.name,
          startDate: h.start_date,
          endDate: h.end_date,
          changedBy: h.users
            ? {
                id: h.users.id.toString(),
                name: h.users.full_name,
              }
            : null,
          createdAt: h.created_at,
        })),
        livingHistory: livingHistory.map((h) => ({
          id: h.id.toString(),
          livingTypeId: h.living_type_id.toString(),
          livingTypeName: h.living_types.name,
          livingTypeCode: h.living_types.code,
          startDate: h.start_date,
          endDate: h.end_date,
          note: h.note,
          changedBy: h.users
            ? {
                id: h.users.id.toString(),
                name: h.users.full_name,
              }
            : null,
          createdAt: h.created_at,
        })),
        timeline: timeline.map((t) => ({
          id: t.id.toString(),
          eventType: t.event_type,
          title: t.title,
          details: t.details,
          createdAt: t.created_at,
          createdBy: t.users
            ? {
                id: t.users.id.toString(),
                name: t.users.full_name,
              }
            : null,
        })),
        recentAssessments: recentAssessments.map((a) => ({
          id: a.assessment_id.toString(),
          title: a.assessments.title,
          type: a.assessments.type,
          subject: a.assessments.subjects.name,
          group: a.assessments.groups.name,
          heldAt: a.assessments.held_at,
          score: a.score,
          maxScore: a.assessments.max_score,
          weight: a.assessments.weight,
          teacherComment: a.teacher_comment,
          enteredAt: a.entered_at,
        })),
        attendanceSummary: attendanceSummary.reduce((acc, curr) => {
          acc[curr.status] = curr._count.status;
          return acc;
        }, {}),
        hasGuardianAccount: !!student.student_accounts,
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  // ==================== UPDATE STUDENT ====================
  async update(args: {
    tenantId: string;
    studentId: string;
    dto: any;
    changedByUserId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const changed_by_user_id = toBigInt(
      args.changedByUserId,
      'changedByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Get existing student for audit
        const existingStudent = await tx.students.findFirst({
          where: { id: student_id, tenant_id },
          select: {
            id: true,
            full_name: true,
            status: true,
            archived_at: true,
            current_group_id: true,
            campus_id: true,
            track_id: true,
            living_type_id: true,
            admission_grade: true,
            admission_date: true,
            expected_graduation_year: true,
            notes: true,
          },
        });

        if (!existingStudent) throw new NotFoundException('STUDENT_NOT_FOUND');

        const updateData: any = {};

        // Update basic info
        if (args.dto.fullName) updateData.full_name = args.dto.fullName.trim();
        if (args.dto.gender) updateData.gender = args.dto.gender;
        if (args.dto.birthDate)
          updateData.birth_date = parseDateOnly(
            args.dto.birthDate,
            'birthDate',
          );
        if (args.dto.notes !== undefined) updateData.notes = args.dto.notes;

        // Update status with timestamp
        if (args.dto.status && args.dto.status !== existingStudent.status) {
          updateData.status = args.dto.status;
          updateData.status_changed_at = new Date();

          // If archiving (WITHDRAWN, EXPELLED, GRADUATED), set archived_at
          if (
            ['WITHDRAWN', 'EXPELLED', 'GRADUATED'].includes(args.dto.status)
          ) {
            updateData.archived_at = new Date();
          } else if (existingStudent.archived_at) {
            // If reactivating, clear archived_at
            updateData.archived_at = null;
          }
        }

        // Update admission info
        if (args.dto.admissionGrade) {
          updateData.admission_grade = args.dto.admissionGrade;
        }
        if (args.dto.admissionDate) {
          updateData.admission_date = parseDateOnly(
            args.dto.admissionDate,
            'admissionDate',
          );
        }
        if (args.dto.expectedGraduationYear) {
          updateData.expected_graduation_year = args.dto.expectedGraduationYear;
        }

        // Update campus
        if (args.dto.campusId !== undefined) {
          if (args.dto.campusId) {
            const campus = await tx.campuses.findFirst({
              where: {
                id: toBigInt(args.dto.campusId, 'campusId'),
                tenant_id,
                is_active: true,
              },
            });
            if (!campus) throw new BadRequestException('CAMPUS_NOT_FOUND');
            updateData.campus_id = campus.id;
          } else {
            updateData.campus_id = null;
          }
        }

        // Update track
        if (args.dto.trackName !== undefined) {
          if (args.dto.trackName) {
            let track = await tx.student_tracks.findFirst({
              where: {
                name: args.dto.trackName,
                tenant_id,
              },
            });

            if (!track) {
              track = await tx.student_tracks.create({
                data: {
                  tenant_id,
                  name: args.dto.trackName,
                  description: `Track for ${args.dto.trackName}`,
                },
              });
            }
            updateData.track_id = track.id;
          } else {
            updateData.track_id = null;
          }
        }

        // Update living type (handle through separate endpoint)
        // Group assignment (handle through separate endpoint)

        // Update student
        const updatedStudent = await tx.students.update({
          where: { id: student_id },
          data: updateData,
          select: {
            id: true,
            full_name: true,
            status: true,
            status_changed_at: true,
            archived_at: true,
          },
        });

        // Create timeline event for update
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id,
            event_type: 'STUDENT_UPDATED',
            title: 'Student Information Updated',
            details: `Student information was updated`,
            created_by_user_id: changed_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          changed_by_user_id,
          'UPDATE',
          'students',
          student_id,
          {
            before: existingStudent,
            after: updatedStudent,
          },
          args.ipAddress,
        );

        return {
          success: true,
          student: updatedStudent,
          changes: Object.keys(updateData),
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== ASSIGN GROUP ====================
  async assignGroup(args: {
    tenantId: string;
    studentId: string;
    groupId: string;
    changedByUserId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const group_id = toBigInt(args.groupId, 'groupId');
    const changed_by_user_id = toBigInt(
      args.changedByUserId,
      'changedByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Check student exists
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id },
          select: { id: true, current_group_id: true, full_name: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // Check group exists and belongs to tenant
        const group = await tx.groups.findFirst({
          where: { id: group_id, tenant_id },
          select: { id: true, name: true },
        });
        if (!group) throw new BadRequestException('GROUP_NOT_FOUND');

        // If already in this group, return
        if (student.current_group_id?.toString() === group_id.toString()) {
          return {
            success: true,
            message: 'Student already in this group',
            noChange: true,
          };
        }

        // End previous group assignment if exists
        if (student.current_group_id) {
          await tx.student_group_history.updateMany({
            where: {
              student_id,
              group_id: student.current_group_id,
              end_date: null,
            },
            data: { end_date: new Date() },
          });
        }

        // Update current group
        await tx.students.update({
          where: { id: student_id },
          data: { current_group_id: group_id },
        });

        // Record new group assignment
        await tx.student_group_history.create({
          data: {
            tenant_id,
            student_id,
            group_id,
            start_date: new Date(),
            changed_by_user_id,
          },
        });

        // Create timeline event
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id,
            event_type: 'GROUP_ASSIGNED',
            title: 'Group Assignment',
            details: `Assigned to group: ${group.name}`,
            created_by_user_id: changed_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          changed_by_user_id,
          'UPDATE',
          'students',
          student_id,
          {
            before: { groupId: student.current_group_id?.toString() },
            after: { groupId: group_id.toString(), groupName: group.name },
          },
          args.ipAddress,
        );

        return {
          success: true,
          studentId: student_id.toString(),
          groupId: group_id.toString(),
          groupName: group.name,
          previousGroupId: student.current_group_id?.toString(),
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== CHANGE LIVING TYPE ====================
  async changeLivingType(args: {
    tenantId: string;
    studentId: string;
    livingTypeCode: string;
    effectiveDate?: string;
    note?: string;
    changedByUserId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const changed_by_user_id = toBigInt(
      args.changedByUserId,
      'changedByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Check student exists
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id },
          select: { id: true, living_type_id: true, full_name: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // Get living type
        const livingType = await tx.living_types.findFirst({
          where: {
            code: args.livingTypeCode,
            tenant_id,
            is_active: true,
          },
          select: { id: true, name: true, code: true },
        });
        if (!livingType) throw new BadRequestException('LIVING_TYPE_NOT_FOUND');

        // If already has this living type, return
        if (student.living_type_id?.toString() === livingType.id.toString()) {
          return {
            success: true,
            message: 'Student already has this living type',
            noChange: true,
          };
        }

        const effective_date = args.effectiveDate
          ? parseDateOnly(args.effectiveDate, 'effectiveDate')
          : new Date();

        // End previous living type assignment if exists
        if (student.living_type_id) {
          await tx.student_living_history.updateMany({
            where: {
              student_id,
              living_type_id: student.living_type_id,
              end_date: null,
            },
            data: {
              end_date: new Date(
                effective_date.getTime() - 24 * 60 * 60 * 1000,
              ),
              note: args.note || 'Changed to new living type',
            },
          });
        }

        // Update current living type
        await tx.students.update({
          where: { id: student_id },
          data: { living_type_id: livingType.id },
        });

        // Record new living type assignment
        await tx.student_living_history.create({
          data: {
            tenant_id,
            student_id,
            living_type_id: livingType.id,
            start_date: effective_date,
            changed_by_user_id,
            note: args.note,
          },
        });

        // Create timeline event
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id,
            event_type: 'LIVING_TYPE_CHANGED',
            title: 'Living Type Changed',
            details: `Changed to: ${livingType.name} (${livingType.code})${args.note ? ` - ${args.note}` : ''}`,
            created_by_user_id: changed_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          changed_by_user_id,
          'UPDATE',
          'students',
          student_id,
          {
            before: { livingTypeId: student.living_type_id?.toString() },
            after: {
              livingTypeId: livingType.id.toString(),
              livingTypeName: livingType.name,
              livingTypeCode: livingType.code,
            },
          },
          args.ipAddress,
        );

        return {
          success: true,
          studentId: student_id.toString(),
          livingType: {
            id: livingType.id.toString(),
            name: livingType.name,
            code: livingType.code,
          },
          effectiveDate: effective_date,
          previousLivingTypeId: student.living_type_id?.toString(),
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== ASSIGN COHORT ====================
  async assignCohort(args: {
    tenantId: string;
    studentId: string;
    cohortLabel: string;
    note?: string;
    changedByUserId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const changed_by_user_id = toBigInt(
      args.changedByUserId,
      'changedByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Check student exists
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id },
          select: { id: true, full_name: true, expected_graduation_year: true },
        });
        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');

        // Find or create cohort
        let cohort = await tx.cohorts.findFirst({
          where: {
            label: args.cohortLabel,
            tenant_id,
          },
        });

        if (!cohort) {
          // Create cohort with graduation year from student
          cohort = await tx.cohorts.create({
            data: {
              tenant_id,
              label: args.cohortLabel,
              graduation_year: student.expected_graduation_year,
            },
          });
        }

        // Check if already in this cohort
        const existingAssignment = await tx.student_cohort.findUnique({
          where: { student_id },
        });

        if (
          existingAssignment &&
          existingAssignment.cohort_id.toString() === cohort.id.toString()
        ) {
          return {
            success: true,
            message: 'Student already in this cohort',
            noChange: true,
          };
        }

        // Update or create cohort assignment
        await tx.student_cohort.upsert({
          where: { student_id },
          update: {
            cohort_id: cohort.id,
            assigned_by_user_id: changed_by_user_id,
            assigned_at: new Date(),
          },
          create: {
            student_id,
            cohort_id: cohort.id,
            assigned_by_user_id: changed_by_user_id,
          },
        });

        // Create timeline event
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id,
            event_type: 'COHORT_ASSIGNED',
            title: 'Cohort Assignment',
            details: `Assigned to cohort: ${cohort.label} (Graduation: ${cohort.graduation_year})`,
            created_by_user_id: changed_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          changed_by_user_id,
          'UPDATE',
          'student_cohort',
          student_id,
          {
            before: existingAssignment
              ? { cohortId: existingAssignment.cohort_id.toString() }
              : null,
            after: {
              cohortId: cohort.id.toString(),
              cohortLabel: cohort.label,
            },
          },
          args.ipAddress,
        );

        return {
          success: true,
          studentId: student_id.toString(),
          cohort: {
            id: cohort.id.toString(),
            label: cohort.label,
            graduationYear: cohort.graduation_year,
          },
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== RESET GUARDIAN PASSWORD ====================
  async resetGuardianPassword(args: {
    tenantId: string;
    studentId: string;
    changedByUserId: string;
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const student_id = toBigInt(args.studentId, 'studentId');
    const changed_by_user_id = toBigInt(
      args.changedByUserId,
      'changedByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        // Check student exists and has guardian account
        const student = await tx.students.findFirst({
          where: { id: student_id, tenant_id },
          include: {
            student_accounts: {
              select: { id: true, student_login_id: true },
            },
          },
        });

        if (!student) throw new NotFoundException('STUDENT_NOT_FOUND');
        if (!student.student_accounts)
          throw new BadRequestException('NO_GUARDIAN_ACCOUNT');

        // Generate new password
        const newPassword = generateTemporaryPassword();
        const password_hash = await bcrypt.hash(newPassword, 12);

        // Update guardian account
        await tx.student_accounts.update({
          where: { id: student.student_accounts.id },
          data: {
            password_hash,
            must_change_password: true,
            password_changed_at: null,
          },
        });

        // Revoke all active sessions
        await tx.auth_sessions.updateMany({
          where: {
            student_account_id: student.student_accounts.id,
            revoked_at: null,
          },
          data: { revoked_at: new Date() },
        });

        // Create timeline event
        await tx.student_timeline.create({
          data: {
            tenant_id,
            student_id,
            event_type: 'GUARDIAN_PASSWORD_RESET',
            title: 'Guardian Password Reset',
            details: 'Guardian account password was reset by administrator',
            created_by_user_id: changed_by_user_id,
          },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          changed_by_user_id,
          'RESET_PASSWORD',
          'student_accounts',
          student.student_accounts.id,
          {
            before: { passwordReset: false },
            after: { passwordReset: true, resetAt: new Date() },
          },
          args.ipAddress,
        );

        return {
          success: true,
          studentId: student_id.toString(),
          guardianAccountId: student.student_accounts.id.toString(),
          studentLoginId: student.student_accounts.student_login_id,
          newPassword,
          mustChangePassword: true,
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== BULK IMPORT STUDENTS ====================
  async bulkImport(args: {
    tenantId: string;
    createdByUserId: string;
    students: any[];
    ipAddress?: string;
  }) {
    const tenant_id = toBigInt(args.tenantId, 'tenantId');
    const created_by_user_id = toBigInt(
      args.createdByUserId,
      'createdByUserId',
    );

    return await this.prisma.$transaction(async (tx) => {
      try {
        if (!args.students || args.students.length === 0) {
          throw new BadRequestException('NO_STUDENTS_TO_IMPORT');
        }

        if (args.students.length > 100) {
          throw new BadRequestException('MAX_100_STUDENTS_PER_IMPORT');
        }

        const results = {
          success: [] as any[],
          errors: [] as any[],
          total: args.students.length,
        };

        // Get tenant slug
        const tenant = await tx.tenants.findUnique({
          where: { id: tenant_id },
          select: { slug: true },
        });
        if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');

        // Get current sequence
        const seqRecord = await tx.student_id_sequences.findUnique({
          where: { tenant_id },
        });
        let currentSeq = seqRecord ? seqRecord.last_seq : 0;

        for (let i = 0; i < args.students.length; i++) {
          const studentData = args.students[i];

          try {
            // Validate required fields
            if (!studentData.fullName?.trim()) {
              results.errors.push({
                index: i,
                error: 'FULL_NAME_REQUIRED',
                data: studentData,
              });
              continue;
            }

            // Process this student
            currentSeq++;
            const student_login_id = generateStudentLoginId(currentSeq);
            const tempPassword = generateTemporaryPassword();
            const password_hash = await bcrypt.hash(tempPassword, 12);

            // Create student
            const student = await tx.students.create({
              data: {
                tenant_id,
                full_name: studentData.fullName.trim(),
                gender: studentData.gender || null,
                birth_date: studentData.birthDate
                  ? parseDateOnly(studentData.birthDate, 'birthDate')
                  : null,
                admission_grade: studentData.admissionGrade || 10,
                admission_date: parseDateOnlyOrNow(
                  studentData.admissionDate,
                  'admissionDate',
                ),
                expected_graduation_year:
                  studentData.expectedGraduationYear ||
                  calculateGraduationYear(
                    studentData.admissionGrade || 10,
                    new Date(),
                  ),
                status: studentData.status || 'ACTIVE',
                notes: studentData.notes,
                created_by_user_id,
              },
            });

            // Create guardian account
            await tx.student_accounts.create({
              data: {
                tenant_id,
                student_id: student.id,
                student_login_id,
                password_hash,
                is_active: true,
                must_change_password: true,
                profile_full_name: studentData.guardianFullName,
                profile_phone: studentData.guardianPhone,
                profile_relation: studentData.guardianRelation,
                telegram_username: studentData.guardianTelegramUsername,
                profile_completed_at: studentData.guardianFullName
                  ? new Date()
                  : null,
                created_by_user_id,
              },
            });

            results.success.push({
              index: i,
              studentId: student.id.toString(),
              fullName: studentData.fullName,
              studentLoginId: student_login_id,
              guardianLogin: `${tenant.slug}-${student_login_id}`,
              temporaryPassword: tempPassword,
            });
          } catch (error) {
            results.errors.push({
              index: i,
              error: error.message || 'UNKNOWN_ERROR',
              data: studentData,
            });
          }
        }

        // Update sequence
        await tx.student_id_sequences.upsert({
          where: { tenant_id },
          create: { tenant_id, last_seq: currentSeq },
          update: { last_seq: currentSeq },
        });

        // Audit log
        await this.auditLogger.logStaffAction(
          tenant_id,
          created_by_user_id,
          'IMPORT',
          'students',
          undefined,
          {
            before: null,
            after: {
              importedCount: results.success.length,
              errorCount: results.errors.length,
              totalCount: results.total,
            },
          },
          args.ipAddress,
        );

        return {
          success: true,
          summary: {
            total: results.total,
            success: results.success.length,
            errors: results.errors.length,
          },
          successfulImports: results.success,
          failedImports: results.errors,
        };
      } catch (error) {
        prismaErrorToHttp(error);
      }
    });
  }

  // ==================== GET STUDENT STATISTICS ====================
  async getStatistics(args: { tenantId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');

      // Get counts by status
      const statusCounts = await this.prisma.students.groupBy({
        by: ['status'],
        where: {
          tenant_id,
          archived_at: null,
        },
        _count: { status: true },
      });

      // Get counts by admission grade
      const gradeCounts = await this.prisma.students.groupBy({
        by: ['admission_grade'],
        where: {
          tenant_id,
          archived_at: null,
          status: 'ACTIVE',
        },
        _count: { admission_grade: true },
      });

      // Get counts by living type
      const livingTypeCounts = await this.prisma.students.groupBy({
        by: ['living_type_id'] as const,
        where: {
          tenant_id,
          archived_at: null,
          status: 'ACTIVE',
        },
        _count: { _all: true },
        orderBy: { living_type_id: 'asc' },
      });

      const livingTypeIds = livingTypeCounts
        .map((x) => x.living_type_id)
        .filter((x): x is bigint => x !== null);

      const livingTypes = await this.prisma.living_types.findMany({
        where: { tenant_id, id: { in: livingTypeIds } },
        select: { id: true, code: true, name: true },
      });

      const livingTypeMap = new Map(livingTypes.map((x) => [x.id, x]));

      // Get guardian profile completion stats (no raw SQL)
      const [guardianCompleted, guardianPending] = await Promise.all([
        this.prisma.student_accounts.count({
          where: {
            tenant_id,
            profile_completed_at: { not: null },
            students: { tenant_id, archived_at: null, status: 'ACTIVE' },
          },
        }),
        this.prisma.student_accounts.count({
          where: {
            tenant_id,
            profile_completed_at: null,
            students: { tenant_id, archived_at: null, status: 'ACTIVE' },
          },
        }),
      ]);

      // Get recent activity (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentActivity = await this.prisma.students.count({
        where: {
          tenant_id,
          created_at: { gte: weekAgo },
        },
      });

      // Get group count
      const groupCount = await this.prisma.groups.count({
        where: { tenant_id },
      });

      // Get counts by track
      const trackCounts = await this.prisma.students.groupBy({
        by: ['track_id'],
        where: {
          tenant_id,
          archived_at: null,
          status: 'ACTIVE',
        },
        _count: { _all: true },
      });

      const trackIds = trackCounts
        .map((x) => x.track_id)
        .filter((x): x is bigint => x !== null);

      const tracks = await this.prisma.student_tracks.findMany({
        where: { id: { in: trackIds } },
        select: { id: true, name: true },
      });

      const trackMap = new Map(tracks.map((x) => [x.id, x.name]));

      return {
        byStatus: statusCounts.map((s) => ({
          status: s.status,
          count: s._count.status,
        })),
        byAdmissionGrade: gradeCounts.map((g) => ({
          grade: g.admission_grade,
          count: g._count.admission_grade,
        })),
        byTrack: trackCounts.map((t) => ({
          trackId: t.track_id?.toString(),
          trackName: t.track_id ? trackMap.get(t.track_id) : 'Not Assigned',
          count: t._count._all,
        })),
        livingTypeDistribution: livingTypeCounts.reduce(
          (acc, curr) => {
            const id = curr.living_type_id;
            const meta = id ? livingTypeMap.get(id) : null;
            acc[id?.toString() || 'none'] = {
              count: curr._count._all,
              name: meta?.name || 'Not Assigned',
              code: meta?.code || null,
            };
            return acc;
          },
          {} as Record<
            string,
            { count: number; name: string; code: string | null }
          >,
        ),

        guardianProfiles: {
          completed: guardianCompleted,
          pending: guardianPending,
        },

        recentActivity: {
          last7Days: recentActivity,
          weekAgo: weekAgo.toISOString(),
        },
        totalActive:
          statusCounts.find((s) => s.status === 'ACTIVE')?._count.status || 0,
        groupCount: groupCount.toString(),
        totalArchived: await this.prisma.students.count({
          where: {
            tenant_id,
            archived_at: { not: null },
          },
        }),
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  // ==================== GUARDIAN ME ====================
  async guardianMe(args: { studentAccountId: string }) {
    try {
      const studentAccountId = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findFirst({
        where: { id: studentAccountId },
        include: {
          students: {
            include: {
              groups: {
                select: {
                  id: true,
                  name: true,
                  academic_years: { select: { name: true } },
                },
              },
              campuses: { select: { id: true, name: true } },
              student_tracks: { select: { id: true, name: true } },
              living_types: { select: { id: true, name: true, code: true } },
              student_cohort: {
                include: {
                  cohorts: {
                    select: { id: true, label: true, graduation_year: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!account?.students) return null;

      return {
        student: {
          id: account.students.id.toString(),
          fullName: account.students.full_name,
          status: account.students.status,
          admissionGrade: account.students.admission_grade,
          admissionDate: account.students.admission_date,
          expectedGraduationYear: account.students.expected_graduation_year,
          createdAt: account.students.created_at,
          campus: account.students.campuses
            ? {
                id: account.students.campuses.id.toString(),
                name: account.students.campuses.name,
              }
            : null,
          group: account.students.groups
            ? {
                id: account.students.groups.id.toString(),
                name: account.students.groups.name,
                academicYear: account.students.groups.academic_years?.name,
              }
            : null,
          track: account.students.student_tracks
            ? {
                id: account.students.student_tracks.id.toString(),
                name: account.students.student_tracks.name,
              }
            : null,
          livingType: account.students.living_types
            ? {
                id: account.students.living_types.id.toString(),
                name: account.students.living_types.name,
                code: account.students.living_types.code,
              }
            : null,
          cohort: account.students.student_cohort?.cohorts
            ? {
                id: account.students.student_cohort.cohorts.id.toString(),
                label: account.students.student_cohort.cohorts.label,
                graduationYear:
                  account.students.student_cohort.cohorts.graduation_year,
              }
            : null,
        },
        guardianAccount: {
          id: account.id.toString(),
          studentLoginId: account.student_login_id,
          profileFullName: account.profile_full_name,
          profilePhone: account.profile_phone,
          profileRelation: account.profile_relation,
          telegramUsername: account.telegram_username,
          profileCompleted: account.profile_completed_at !== null,
          mustChangePassword: account.must_change_password,
          lastLoginAt: account.last_login_at,
        },
      };
    } catch (e) {
      prismaErrorToHttp(e);
    }
  }

  async getRegistrationTrend(tenantId: string) {
    const tenant_id = toBigInt(tenantId, 'tenantId');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await this.prisma.students.findMany({
      where: {
        tenant_id,
        created_at: { gte: thirtyDaysAgo },
      },
      select: { created_at: true },
    });

    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyCounts[key] = 0;
    }

    rows.forEach((r) => {
      const key = r.created_at.toISOString().split('T')[0];
      if (dailyCounts[key] !== undefined) dailyCounts[key]++;
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
