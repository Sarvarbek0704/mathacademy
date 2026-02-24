// apps/api/src/modules/discipline/discipline.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { DisciplineService } from './discipline.service';
import { CreateViolationDto } from './dto/create-violation.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';
import { CreateDisciplineActionDto } from './dto/create-action.dto';
import { UpdateDisciplineActionDto } from './dto/update-action.dto';
import { ListViolationsQueryDto } from './dto/list-violations.query.dto';
import { ListActionsQueryDto } from './dto/list-actions.query.dto';
import { GuardianDisciplineQueryDto } from './dto/guardian-discipline.query.dto';

@ApiTags('Staff - Discipline')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/discipline')
export class DisciplineController {
  constructor(private readonly svc: DisciplineService) {}

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

  // ==================== VIOLATIONS ====================

  @Post('violations')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Create a new violation record' })
  @ApiResponse({ status: 201, description: 'Violation created' })
  createViolation(@Req() req: any, @Body() dto: CreateViolationDto) {
    return this.svc.createViolation({
      tenantId: this.tenantId(req),
      recordedByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get('violations')
  @RequirePermissions('discipline.read')
  @ApiOperation({ summary: 'List violations with pagination and filters' })
  listViolations(@Req() req: any, @Query() query: ListViolationsQueryDto) {
    return this.svc.listViolations({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('violations/:id')
  @RequirePermissions('discipline.read')
  @ApiOperation({ summary: 'Get violation details by ID' })
  @ApiParam({ name: 'id', description: 'Violation ID' })
  getViolationById(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getViolationById({
      tenantId: this.tenantId(req),
      violationId: id.toString(),
    });
  }

  @Patch('violations/:id')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Update violation' })
  @ApiParam({ name: 'id', description: 'Violation ID' })
  updateViolation(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateViolationDto,
  ) {
    return this.svc.updateViolation({
      tenantId: this.tenantId(req),
      violationId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete('violations/:id')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Delete violation' })
  @ApiParam({ name: 'id', description: 'Violation ID' })
  deleteViolation(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteViolation({
      tenantId: this.tenantId(req),
      violationId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  // ==================== DISCIPLINE ACTIONS ====================

  @Post('actions')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Create a new discipline action' })
  @ApiResponse({ status: 201, description: 'Action created' })
  createAction(@Req() req: any, @Body() dto: CreateDisciplineActionDto) {
    return this.svc.createAction({
      tenantId: this.tenantId(req),
      issuedByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get('actions')
  @RequirePermissions('discipline.read')
  @ApiOperation({
    summary: 'List discipline actions with pagination and filters',
  })
  listActions(@Req() req: any, @Query() query: ListActionsQueryDto) {
    return this.svc.listActions({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('actions/:id')
  @RequirePermissions('discipline.read')
  @ApiOperation({ summary: 'Get discipline action details by ID' })
  @ApiParam({ name: 'id', description: 'Action ID' })
  getActionById(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getActionById({
      tenantId: this.tenantId(req),
      actionId: id.toString(),
    });
  }

  @Patch('actions/:id')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Update discipline action' })
  @ApiParam({ name: 'id', description: 'Action ID' })
  updateAction(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateDisciplineActionDto,
  ) {
    return this.svc.updateAction({
      tenantId: this.tenantId(req),
      actionId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete('actions/:id')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Delete discipline action' })
  @ApiParam({ name: 'id', description: 'Action ID' })
  deleteAction(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteAction({
      tenantId: this.tenantId(req),
      actionId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Patch('actions/:id/toggle')
  @RequirePermissions('discipline.write')
  @ApiOperation({ summary: 'Activate/deactivate discipline action' })
  @ApiParam({ name: 'id', description: 'Action ID' })
  @ApiQuery({ name: 'active', required: true, type: Boolean })
  toggleActionStatus(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query('active') active: string,
  ) {
    const isActive = active === 'true';
    return this.svc.toggleActionStatus({
      tenantId: this.tenantId(req),
      actionId: id.toString(),
      userId: this.userId(req),
      isActive,
      ipAddress: this.ip(req),
    });
  }

  @Get('summary')
  @RequirePermissions('discipline.read')
  @ApiOperation({ summary: 'Get discipline summary for dashboard' })
  getSummary(@Req() req: any) {
    return this.svc.getDisciplineSummary(this.tenantId(req));
  }
}

@ApiTags('Guardian - Discipline')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/discipline')
export class GuardianDisciplineController {
  constructor(private readonly svc: DisciplineService) {}

  @Get()
  @ApiOperation({ summary: 'Get discipline records for my child' })
  me(@Req() req: any, @Query() query: GuardianDisciplineQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianDiscipline({
      studentAccountId: String(user.studentAccountId || ''),
      query,
    });
  }
}
