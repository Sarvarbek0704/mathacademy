import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { DisciplineService } from './discipline.service';
import { CreateViolationDto } from './dto/create-violation.dto';
import { CreateDisciplineActionDto } from './dto/create-action.dto';

@ApiTags('Staff - Discipline')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/discipline')
export class DisciplineController {
  constructor(private readonly svc: DisciplineService) {}

  @RequirePermissions('discipline.write')
  @Post('violations')
  createViolation(@Req() req: any, @Body() dto: CreateViolationDto) {
    return this.svc.createViolation({
      tenantId: String(req.user?.tenantId || ''),
      recordedByUserId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('discipline.read')
  @Get('violations')
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'severity', required: false })
  listViolations(
    @Req() req: any,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('severity') severity?: string,
  ) {
    return this.svc.listViolations({
      tenantId: String(req.user?.tenantId || ''),
      studentId,
      groupId,
      from,
      to,
      severity,
    });
  }

  @RequirePermissions('discipline.write')
  @Post('actions')
  createAction(@Req() req: any, @Body() dto: CreateDisciplineActionDto) {
    return this.svc.createAction({
      tenantId: String(req.user?.tenantId || ''),
      issuedByUserId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('discipline.read')
  @Get('actions')
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'active', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  listActions(
    @Req() req: any,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
    @Query('active') active?: string,
  ) {
    return this.svc.listActions({
      tenantId: String(req.user?.tenantId || ''),
      studentId,
      groupId,
      active,
    });
  }
}

@ApiTags('Guardian - Discipline')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/discipline')
export class GuardianDisciplineController {
  constructor(private readonly svc: DisciplineService) {}

  @Get()
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  me(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianMe({
      studentAccountId: String(user.studentAccountId || ''),
      from,
      to,
    });
  }
}
