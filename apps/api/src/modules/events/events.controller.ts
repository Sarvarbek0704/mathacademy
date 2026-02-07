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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { SetParticipantsDto } from './dto/set-participants.dto';

@ApiTags('Staff - Events')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/events')
export class EventsController {
  constructor(private readonly svc: EventsService) {}

  @RequirePermissions('events.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateEventDto) {
    return this.svc.create({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('events.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'campusId', required: false })
  @ApiQuery({ name: 'eventType', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('campusId') campusId?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      tenantId: String(req.user?.tenantId || ''),
      from,
      to,
      q,
      campusId,
      eventType,
      limit,
      offset,
    });
  }

  @RequirePermissions('events.write')
  @Post(':id/participants')
  setParticipants(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetParticipantsDto,
  ) {
    return this.svc.setParticipants({
      tenantId: String(req.user?.tenantId || ''),
      eventId: id,
      dto,
    });
  }

  @RequirePermissions('events.read')
  @Get(':id/participants')
  participants(@Req() req: any, @Param('id') id: string) {
    return this.svc.participants({
      tenantId: String(req.user?.tenantId || ''),
      eventId: id,
    });
  }
}

@ApiTags('Guardian - Events')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/events')
export class GuardianEventsController {
  constructor(private readonly svc: EventsService) {}

  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get()
  my(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      from,
      to,
    });
  }
}
