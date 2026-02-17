// apps/api/src/modules/timetable/timetable.controller.ts
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
} from '@nestjs/swagger';

import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { TimetableService } from './timetable.service';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { ListTimetablesQueryDto } from './dto/list-timetables.query.dto';

@ApiTags('Staff - Timetable')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/timetables')
export class TimetableController {
  constructor(private readonly svc: TimetableService) {}

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

  // Timetables
  @Post()
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Create a new timetable' })
  createTimetable(@Req() req: any, @Body() dto: CreateTimetableDto) {
    return this.svc.createTimetable({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('timetable.read')
  @ApiOperation({ summary: 'List timetables' })
  listTimetables(@Req() req: any, @Query() query: ListTimetablesQueryDto) {
    return this.svc.listTimetables({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('timetable.read')
  @ApiOperation({ summary: 'Get timetable details with lessons' })
  getTimetable(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getTimetable({
      tenantId: this.tenantId(req),
      timetableId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Update timetable' })
  updateTimetable(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTimetableDto,
  ) {
    return this.svc.updateTimetable({
      tenantId: this.tenantId(req),
      timetableId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Delete timetable' })
  deleteTimetable(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteTimetable({
      tenantId: this.tenantId(req),
      timetableId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  // Lessons
  @Post(':timetableId/lessons')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Add a lesson to a timetable' })
  addLesson(
    @Req() req: any,
    @Param('timetableId', ParseBigIntPipe) timetableId: bigint,
    @Body() dto: CreateLessonDto,
  ) {
    return this.svc.addLesson({
      tenantId: this.tenantId(req),
      timetableId: timetableId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Patch(':timetableId/lessons/:lessonId')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Update a lesson' })
  updateLesson(
    @Req() req: any,
    @Param('timetableId', ParseBigIntPipe) timetableId: bigint,
    @Param('lessonId', ParseBigIntPipe) lessonId: bigint,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.svc.updateLesson({
      tenantId: this.tenantId(req),
      timetableId: timetableId.toString(),
      lessonId: lessonId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':timetableId/lessons/:lessonId')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Delete a lesson' })
  deleteLesson(
    @Req() req: any,
    @Param('timetableId', ParseBigIntPipe) timetableId: bigint,
    @Param('lessonId', ParseBigIntPipe) lessonId: bigint,
  ) {
    return this.svc.deleteLesson({
      tenantId: this.tenantId(req),
      timetableId: timetableId.toString(),
      lessonId: lessonId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  // Batch upsert lessons (replace all lessons for a timetable)
  @Post(':timetableId/lessons/batch')
  @RequirePermissions('timetable.write')
  @ApiOperation({ summary: 'Replace all lessons for a timetable' })
  batchUpsertLessons(
    @Req() req: any,
    @Param('timetableId', ParseBigIntPipe) timetableId: bigint,
    @Body() lessons: CreateLessonDto[],
  ) {
    return this.svc.batchUpsertLessons({
      tenantId: this.tenantId(req),
      timetableId: timetableId.toString(),
      userId: this.userId(req),
      lessons,
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Timetable')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/timetable')
export class GuardianTimetableController {
  constructor(private readonly svc: TimetableService) {}

  @Get()
  @ApiOperation({ summary: 'Get current timetable for my child' })
  async myTimetable(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianTimetable({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
