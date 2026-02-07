import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionDto } from './dto/create-session.dto';
import { UpsertAttendanceMarksDto } from './dto/upsert-marks.dto';

@ApiTags('Staff - Attendance')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @RequirePermissions('attendance.write')
  @Post('sessions')
  createSession(@Req() req: any, @Body() dto: CreateAttendanceSessionDto) {
    return this.attendance.createSession({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('attendance.read')
  @Get('sessions')
  listSessions(
    @Req() req: any,
    @Query('groupId') groupId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.attendance.listSessions({
      tenantId: String(req.user?.tenantId || ''),
      groupId,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermissions('attendance.write')
  @Post('sessions/:id/marks')
  upsertMarks(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpsertAttendanceMarksDto,
  ) {
    return this.attendance.upsertMarks({
      tenantId: String(req.user?.tenantId || ''),
      sessionId: id,
      dto,
    });
  }
}

@ApiTags('Guardian - Attendance')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/attendance')
export class GuardianAttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  myAttendance(
    @Req() req: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.attendance.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      dateFrom,
      dateTo,
    });
  }
}
