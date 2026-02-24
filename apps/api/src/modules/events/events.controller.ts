// apps/api/src/modules/events/events.controller.ts
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

import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';
import { EventListQueryDto } from './dto/event-list.query.dto';
import { GuardianEventQueryDto } from './dto/guardian-event.query.dto';

@ApiTags('Staff - Events')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}

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
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Create new event' })
  @ApiResponse({ status: 201, description: 'Event created' })
  create(@Req() req: any, @Body() dto: CreateEventDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'List events with pagination and filters' })
  list(@Req() req: any, @Query() query: EventListQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('summary')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Get event summary for dashboard' })
  getSummary(@Req() req: any) {
    return this.svc.getEventSummary(this.tenantId(req));
  }

  @Get('summary/upcoming')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Get upcoming events for dashboard' })
  getUpcoming(@Req() req: any) {
    return this.svc.getUpcomingEvents(this.tenantId(req));
  }

  @Get(':id')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Get event details' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  getDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDetail({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Update event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateEventDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Delete event' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/participants')
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Replace all participants' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  setParticipants(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SetParticipantsDto,
  ) {
    return this.svc.setParticipants({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':id/participants')
  @RequirePermissions('events.read')
  @ApiOperation({ summary: 'Get event participants' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  getParticipants(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getParticipants({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
    });
  }

  @Post(':id/participants/add')
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Add participants to existing ones' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  addParticipants(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SetParticipantsDto,
  ) {
    return this.svc.addParticipants({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id/participants')
  @RequirePermissions('events.write')
  @ApiOperation({ summary: 'Remove specific participants' })
  @ApiParam({ name: 'id', description: 'Event ID' })
  @ApiQuery({ name: 'studentIds', type: [String], required: true })
  removeParticipants(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query('studentIds') studentIds: string[],
  ) {
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    return this.svc.removeParticipants({
      tenantId: this.tenantId(req),
      eventId: id.toString(),
      userId: this.userId(req),
      studentIds: ids,
    });
  }

}

@ApiTags('Guardian - Events')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/events')
export class GuardianEventsController {
  constructor(private readonly svc: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Get events for my child' })
  my(@Req() req: any, @Query() query: GuardianEventQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      query,
    });
  }
}
