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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { LeaveDecisionDto } from './dto/decision.dto';

@ApiTags('Staff - Leaves')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/leaves')
export class LeavesController {
  constructor(private readonly svc: LeavesService) {}

  @RequirePermissions('leaves.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateLeaveDto) {
    return this.svc.create({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }

  @RequirePermissions('leaves.read')
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      tenantId: String(req.user?.tenantId || ''),
      studentId,
      groupId,
      status,
      from,
      to,
    });
  }

  @RequirePermissions('leaves.write')
  @Post(':id/approve')
  approve(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.approve({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      id,
      notes: dto?.notes,
    });
  }

  @RequirePermissions('leaves.write')
  @Post(':id/reject')
  reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.reject({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      id,
      notes: dto?.notes,
    });
  }

  @RequirePermissions('leaves.write')
  @Post(':id/close')
  close(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.close({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      id,
      notes: dto?.notes,
    });
  }
}

@ApiTags('Guardian - Leaves')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/leaves')
export class GuardianLeavesController {
  constructor(private readonly svc: LeavesService) {}

  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get()
  my(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      status,
      from,
      to,
    });
  }
}
