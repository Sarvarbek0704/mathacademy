// apps/api/src/modules/attendance/attendance.controller.ts
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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceSessionDto } from './dto/create-session.dto';
import { UpsertAttendanceMarksDto } from './dto/upsert-marks.dto';
import {
  AttendanceSessionListQueryDto,
  GuardianAttendanceQueryDto,
} from './dto/attendance-list.query.dto';

@ApiTags('Staff - Attendance')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

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

  @RequirePermissions('attendance.write')
  @Post('sessions')
  @ApiOperation({ summary: 'Create attendance session' })
  createSession(@Req() req: any, @Body() dto: CreateAttendanceSessionDto) {
    return this.attendance.createSession({
      tenantId: this.tenantId(req),
      createdByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @RequirePermissions('attendance.read')
  @Get('sessions')
  @ApiOperation({ summary: 'List attendance sessions' })
  listSessions(@Req() req: any, @Query() query: AttendanceSessionListQueryDto) {
    return this.attendance.listSessions({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @RequirePermissions('attendance.read')
  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session details with attendance list' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  getSessionDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.attendance.getSessionDetail({
      tenantId: this.tenantId(req),
      sessionId: id.toString(),
    });
  }

  @RequirePermissions('attendance.write')
  @Post('sessions/:id/marks')
  @ApiOperation({ summary: 'Upsert attendance marks' })
  upsertMarks(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpsertAttendanceMarksDto,
  ) {
    return this.attendance.upsertMarks({
      tenantId: this.tenantId(req),
      sessionId: id.toString(),
      enteredByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @RequirePermissions('attendance.read')
  @Get('statistics/group/:groupId')
  @ApiOperation({ summary: 'Get group attendance statistics' })
  @ApiParam({ name: 'groupId', description: 'Group ID' })
  getGroupStatistics(
    @Req() req: any,
    @Param('groupId', ParseBigIntPipe) groupId: bigint,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendance.getGroupStatistics({
      tenantId: this.tenantId(req),
      groupId: groupId.toString(),
      from,
      to,
    });
  }

  @RequirePermissions('attendance.read')
  @Get('stats')
  @ApiOperation({ summary: 'Get overall attendance statistics for dashboard' })
  getOverallStats(@Req() req: any) {
    return this.attendance.getOverallStats({
      tenantId: this.tenantId(req),
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
  @ApiOperation({ summary: 'Get my attendance records' })
  myAttendance(@Req() req: any, @Query() query: GuardianAttendanceQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');

    return this.attendance.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      query,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get attendance summary' })
  async getSummary(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');

    const result = await this.attendance.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      query: { limit: 1000 },
    });

    return {
      ok: true,
      summary: result.summary,
      monthlyStats: result.monthlyStats,
    };
  }
}
