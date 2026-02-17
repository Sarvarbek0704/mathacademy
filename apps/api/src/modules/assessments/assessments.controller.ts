// apps/api/src/modules/assessments/assessments.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpsertAssessmentScoresDto } from './dto/upsert-scores.dto';
import {
  AssessmentListQueryDto,
  GuardianGradesQueryDto,
} from './dto/assessment-list.query.dto';

@ApiTags('Staff - Assessments')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/assessments')
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  private tenantId(req: any): string {
    return String(req.user?.tenantId || '');
  }

  private userId(req: any): string {
    return String(req.user?.userId || '');
  }

  private ip(req: any): string | undefined {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || undefined;
  }

  @Post()
  @RequirePermissions('assessments.write')
  @ApiOperation({
    summary: 'Create assessment',
    description: 'Create a new assessment for a group and subject',
  })
  @ApiBody({ type: CreateAssessmentDto })
  @ApiResponse({
    status: 201,
    description: 'Assessment created successfully',
    schema: {
      example: {
        id: '123',
        title: 'Weekly Test #1 - Algebra',
        type: 'WEEKLY_TEST',
        group: '10-A',
        subject: 'Mathematics',
        heldAt: '2026-02-07T10:00:00+05:00',
        isPublished: false,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Group or subject not found' })
  create(@Req() req: any, @Body() dto: CreateAssessmentDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      createdByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('assessments.read')
  @ApiOperation({
    summary: 'List assessments',
    description: 'Get paginated list of assessments with filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Assessments list returned successfully',
  })
  list(@Req() req: any, @Query() query: AssessmentListQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('statistics/group/:groupId')
  @RequirePermissions('assessments.read')
  @ApiOperation({
    summary: 'Get group assessment statistics',
    description: 'Get assessment statistics for a specific group',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID', example: '1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31' })
  @ApiResponse({
    status: 200,
    description: 'Statistics returned successfully',
  })
  getGroupStatistics(
    @Req() req: any,
    @Param('groupId', ParseBigIntPipe) groupId: bigint,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getGroupStatistics({
      tenantId: this.tenantId(req),
      groupId: groupId.toString(),
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermissions('assessments.read')
  @ApiOperation({
    summary: 'Get assessment details',
    description:
      'Get detailed information about an assessment including scores',
  })
  @ApiParam({ name: 'id', description: 'Assessment ID', example: '123' })
  @ApiResponse({
    status: 200,
    description: 'Assessment details returned successfully',
  })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  getDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDetail({
      tenantId: this.tenantId(req),
      assessmentId: id.toString(),
    });
  }

  @Post(':id/scores')
  @RequirePermissions('assessments.write')
  @ApiOperation({
    summary: 'Upsert assessment scores',
    description: 'Add or update scores for students in this assessment',
  })
  @ApiParam({ name: 'id', description: 'Assessment ID', example: '123' })
  @ApiBody({ type: UpsertAssessmentScoresDto })
  @ApiResponse({
    status: 200,
    description: 'Scores saved successfully',
    schema: {
      example: {
        ok: true,
        count: 25,
        message: 'Scores saved for 25 students',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid score data' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  upsertScores(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpsertAssessmentScoresDto,
  ) {
    return this.svc.upsertScores({
      tenantId: this.tenantId(req),
      assessmentId: id.toString(),
      enteredByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Patch(':id/publish')
  @RequirePermissions('assessments.write')
  @ApiOperation({
    summary: 'Publish/unpublish assessment results',
    description: 'Make assessment scores visible to guardians',
  })
  @ApiParam({ name: 'id', description: 'Assessment ID', example: '123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        publish: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Assessment publication status updated',
  })
  publishResults(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body('publish') publish: boolean,
  ) {
    return this.svc.publishResults({
      tenantId: this.tenantId(req),
      assessmentId: id.toString(),
      actorUserId: this.userId(req),
      publish,
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Grades')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/grades')
export class GuardianGradesController {
  constructor(private readonly svc: AssessmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my grades',
    description: "Get assessment grades for the guardian's student",
  })
  @ApiResponse({
    status: 200,
    description: 'Grades returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated or not guardian',
  })
  myGrades(@Req() req: any, @Query() query: GuardianGradesQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }

    return this.svc.guardianGrades({
      studentAccountId: String(user.studentAccountId || ''),
      query,
    });
  }

  @Get('subjects')
  @ApiOperation({
    summary: 'Get subject summaries',
    description: 'Get average grades by subject',
  })
  async subjectSummaries(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }

    const result = await this.svc.guardianGrades({
      studentAccountId: String(user.studentAccountId || ''),
      query: { limit: 500 },
    });

    return {
      ok: true,
      subjects: result.subjectSummaries,
    };
  }

  @Get('recent')
  @ApiOperation({
    summary: 'Get recent grades',
    description: 'Get last 10 assessments with grades',
  })
  async recentGrades(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }

    const result = await this.svc.guardianGrades({
      studentAccountId: String(user.studentAccountId || ''),
      query: { limit: 10 },
    });

    return {
      ok: true,
      grades: result.grades,
    };
  }
}
