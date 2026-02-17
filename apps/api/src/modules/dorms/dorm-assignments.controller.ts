import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { DormsService } from './dorms.service';
import { AssignRoomDto } from './dto/assign-room.dto';
import { ListAssignmentsQueryDto } from './dto/list-assignments.query.dto';

@ApiTags('Staff - Dorm Assignments')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/dorms/rooms/:roomId/assignments')
export class DormAssignmentsController {
  constructor(private readonly svc: DormsService) {}

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
  @RequirePermissions('dorms.assign')
  @ApiOperation({
    summary:
      'Assign a student to a room (creates new assignment, ends previous if any)',
  })
  assign(
    @Req() req: any,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
    @Body() dto: AssignRoomDto,
  ) {
    return this.svc.assignRoom({
      tenantId: this.tenantId(req),
      roomId: roomId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Patch(':assignmentId/end')
  @RequirePermissions('dorms.assign')
  @ApiOperation({ summary: 'End a specific assignment (set end_date to now)' })
  endAssignment(
    @Req() req: any,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
    @Param('assignmentId', ParseBigIntPipe) assignmentId: bigint,
  ) {
    return this.svc.endAssignment({
      tenantId: this.tenantId(req),
      roomId: roomId.toString(),
      assignmentId: assignmentId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('dorms.read')
  @ApiOperation({
    summary: 'List assignments (optionally filter by student/room/current)',
  })
  list(
    @Req() req: any,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
    @Query() query: ListAssignmentsQueryDto,
  ) {
    return this.svc.listAssignments({
      tenantId: this.tenantId(req),
      roomId: roomId.toString(),
      query,
    });
  }
}
