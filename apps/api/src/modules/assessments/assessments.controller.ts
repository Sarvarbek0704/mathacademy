import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { AccessGuard } from '../../common/guards/access.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpsertAssessmentScoresDto } from './dto/upsert-scores.dto';

@ApiTags('Staff - Assessments')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/assessments')
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  @RequirePermissions('assessments.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateAssessmentDto) {
    return this.svc.create({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('assessments.read')
  @Get()
  list(
    @Req() req: any,
    @Query('groupId') groupId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      tenantId: String(req.user?.tenantId || ''),
      groupId,
      from,
      to,
    });
  }

  @RequirePermissions('assessments.write')
  @Post(':id/scores')
  upsertScores(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpsertAssessmentScoresDto,
  ) {
    return this.svc.upsertScores({
      tenantId: String(req.user?.tenantId || ''),
      assessmentId: id,
      enteredByUserId: String(req.user?.userId || ''),
      dto,
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
  myGrades(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianGrades({
      studentAccountId: String(user.studentAccountId || ''),
      from,
      to,
    });
  }
}
