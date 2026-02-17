// apps/api/src/modules/leaves/leaves.controller.ts
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

import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { UpdateLeaveDto } from './dto/update-leave.dto';
import { LeaveDecisionDto } from './dto/decision.dto';
import { LeaveListQueryDto } from './dto/leave-list.query.dto';
import { GuardianLeaveQueryDto } from './dto/guardian-leave.query.dto';

@ApiTags('Staff - Leaves')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/leaves')
export class LeavesController {
  constructor(private readonly svc: LeavesService) {}

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
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Create a new leave request' })
  @ApiResponse({ status: 201, description: 'Leave request created' })
  create(@Req() req: any, @Body() dto: CreateLeaveDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('leaves.read')
  @ApiOperation({ summary: 'List leave requests with pagination and filters' })
  list(@Req() req: any, @Query() query: LeaveListQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('leaves.read')
  @ApiOperation({ summary: 'Get leave request details' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  getDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDetail({
      tenantId: this.tenantId(req),
      leaveId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Update pending leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateLeaveDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      leaveId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Delete pending leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      leaveId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/approve')
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Approve leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  approve(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.approve({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      leaveId: id.toString(),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/reject')
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Reject leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  reject(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.reject({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      leaveId: id.toString(),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/close')
  @RequirePermissions('leaves.write')
  @ApiOperation({ summary: 'Close approved leave request' })
  @ApiParam({ name: 'id', description: 'Leave request ID' })
  close(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.svc.close({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      leaveId: id.toString(),
      dto,
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Leaves')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/leaves')
export class GuardianLeavesController {
  constructor(private readonly svc: LeavesService) {}

  @Get()
  @ApiOperation({ summary: 'Get leave requests for my child' })
  my(@Req() req: any, @Query() query: GuardianLeaveQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      query,
    });
  }
}
