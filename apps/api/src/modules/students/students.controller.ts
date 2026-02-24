// apps/api/src/modules/students/students.controller.ts - YANGILANGAN VERSIYA
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { StudentsService } from './students.service';
import { StudentListQuery } from './dto/student-list.query';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { AssignGroupDto } from './dto/assign-group.dto';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { ResetGuardianPasswordDto } from './dto/reset-guardian-password.dto';
import { BulkImportStudentsDto } from './dto/bulk-import.dto';
import { ChangeLivingTypeDto } from './dto/change-living-type.dto';
import { AssignCohortDto } from './dto/assign-cohort.dto';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

@ApiTags('Staff - Students')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  // ==================== LIST STUDENTS ====================
  @RequirePermissions('students.read')
  @Get()
  @ApiOperation({
    summary: 'List students with filtering and pagination',
    description:
      'Get paginated list of students with advanced filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'List of students returned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
  })
  list(@Req() req: any, @Query() query: StudentListQuery) {
    return this.studentsService.list({
      tenantId: String(req.user?.tenantId || ''),
      q: query.q,
      campusId: query.campusId,
      groupId: query.groupId,
      trackName: query.trackName,
      status: query.status,
      livingType: query.livingType,
      admissionGrade: query.admissionGrade,
      admissionYear: query.admissionYear,
      guardianProfileCompleted: query.guardianProfileCompleted,
      includeArchived: query.includeArchived,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  // ==================== GET STUDENT DETAILS ====================
  @RequirePermissions('students.read')
  @Get(':id')
  @ApiOperation({
    summary: 'Get student details',
    description:
      'Get comprehensive details about a specific student including history, timeline, and related data',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Student details returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  detail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.studentsService.detail({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
    });
  }

  // ==================== CREATE STUDENT ====================
  @RequirePermissions('students.write')
  @Post()
  @ApiOperation({
    summary: 'Create new student',
    description:
      'Create a new student with guardian account. Generates student ID and temporary password.',
  })
  @ApiBody({ type: CreateStudentDto })
  @ApiResponse({
    status: 201,
    description: 'Student created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  create(@Req() req: any, @Body() dto: CreateStudentDto) {
    return this.studentsService.create({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      dto,
      ipAddress: req.ip,
    });
  }

  // ==================== UPDATE STUDENT ====================
  @RequirePermissions('students.write')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update student information',
    description: 'Update basic student information (name, notes, etc.)',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiBody({ type: UpdateStudentDto })
  @ApiResponse({
    status: 200,
    description: 'Student updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      dto,
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  // ==================== UPDATE STUDENT STATUS ====================
  @RequirePermissions('students.write')
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update student status',
    description:
      'Change student status (ACTIVE, GRADUATED, EXPELLED, WITHDRAWN)',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiBody({ type: UpdateStudentStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Student status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  updateStatus(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateStudentStatusDto,
  ) {
    return this.studentsService.update({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      dto: { status: dto.status, notes: dto.note },
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  // ==================== ASSIGN GROUP ====================
  @RequirePermissions('students.write')
  @Post(':id/group')
  @ApiOperation({
    summary: 'Assign student to group',
    description: 'Assign student to a group. Creates history record.',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiBody({ type: AssignGroupDto })
  @ApiResponse({
    status: 200,
    description: 'Student assigned to group successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Group not found',
  })
  assignGroup(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: AssignGroupDto,
  ) {
    return this.studentsService.assignGroup({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      groupId: dto.groupId,
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  // ==================== CHANGE LIVING TYPE ====================
  @RequirePermissions('students.write')
  @Post(':id/living-type')
  @ApiOperation({
    summary: 'Change student living type',
    description:
      'Change student living accommodation type (DAY_ONLY, WEEKDAYS_ONLY, FULL_BOARD)',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiBody({ type: ChangeLivingTypeDto })
  @ApiResponse({
    status: 200,
    description: 'Living type changed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid living type',
  })
  changeLivingType(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: ChangeLivingTypeDto,
  ) {
    return this.studentsService.changeLivingType({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      livingTypeCode: dto.livingTypeCode,
      effectiveDate: dto.effectiveDate,
      note: dto.note,
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  @RequirePermissions('students.write')
  @Post(':id/cohort')
  @ApiOperation({
    summary: 'Assign student to cohort',
    description: 'Assign student to graduation cohort (e.g., Bitiruvchi-2025)',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiBody({ type: AssignCohortDto })
  @ApiResponse({
    status: 200,
    description: 'Student assigned to cohort successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid cohort data',
  })
  assignCohort(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: AssignCohortDto,
  ) {
    return this.studentsService.assignCohort({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      cohortLabel: dto.cohortLabel,
      note: dto.note,
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  // ==================== RESET GUARDIAN PASSWORD ====================
  @RequirePermissions('students.write')
  @Post(':id/reset-guardian-password')
  @ApiOperation({
    summary: 'Reset guardian password',
    description:
      'Reset guardian account password and generate new temporary password',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Guardian password reset successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'No guardian account found',
  })
  resetGuardianPassword(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
  ) {
    return this.studentsService.resetGuardianPassword({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }

  // ==================== BULK IMPORT STUDENTS ====================
  @RequirePermissions('students.write')
  @Post('bulk-import')
  @ApiOperation({
    summary: 'Bulk import students',
    description: 'Import multiple students at once (max 100 per request)',
  })
  @ApiBody({ type: BulkImportStudentsDto })
  @ApiResponse({
    status: 201,
    description: 'Students imported successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid import data or too many students',
  })
  bulkImport(@Req() req: any, @Body() dto: BulkImportStudentsDto) {
    return this.studentsService.bulkImport({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      students: dto.students,
      ipAddress: req.ip,
    });
  }

  @RequirePermissions('students.read')
  @Get('statistics/summary')
  @ApiOperation({
    summary: 'Get student statistics',
    description:
      'Get statistics about students (counts by status, grade, living type, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics returned successfully',
  })
  getStatistics(@Req() req: any) {
    return this.studentsService.getStatistics({
      tenantId: String(req.user?.tenantId || ''),
    });
  }

  @RequirePermissions('students.read')
  @Get('summary/registrations')
  @ApiOperation({ summary: 'Get student registration trend for dashboard' })
  getRegistrationTrend(@Req() req: any) {
    return this.studentsService.getRegistrationTrend(
      String(req.user?.tenantId || ''),
    );
  }

  // ==================== GET STUDENT TIMELINE ====================
  @RequirePermissions('students.read')
  @Get(':id/timeline')
  @ApiOperation({
    summary: 'Get student timeline',
    description: 'Get timeline of events for a student',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiResponse({
    status: 200,
    description: 'Timeline returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  getTimeline(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    // This is included in the detail endpoint, but could be separate
    return this.studentsService.detail({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
    });
  }

  // ==================== ARCHIVE STUDENT ====================
  @RequirePermissions('students.write')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Archive student',
    description: 'Archive a student (soft delete). Sets archived_at timestamp.',
  })
  @ApiParam({ name: 'id', description: 'Student ID', example: '1' })
  @ApiResponse({
    status: 204,
    description: 'Student archived successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  async archive(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    await this.studentsService.update({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id.toString(),
      dto: {
        status: 'WITHDRAWN',
        notes: 'Archived by administrator',
      },
      changedByUserId: String(req.user?.userId || ''),
      ipAddress: req.ip,
    });
  }
}
