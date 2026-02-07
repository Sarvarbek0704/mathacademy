import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { NotificationsService } from './notifications.service';
import { UpsertNotificationTemplateDto } from './dto/upsert-template.dto';
import { ListNotificationTemplatesQueryDto } from './dto/list-templates.query.dto';
import { UpsertNotificationPreferenceDto } from './dto/upsert-preference.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';

@ApiTags('Staff - Notifications')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/notifications')
export class StaffNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  // Templates
  @RequirePermissions('notifications.write')
  @Post('templates')
  upsertTemplate(@Req() req: any, @Body() dto: UpsertNotificationTemplateDto) {
    return this.svc.upsertTemplate({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }

  @RequirePermissions('notifications.read')
  @Get('templates')
  listTemplates(
    @Req() req: any,
    @Query() q: ListNotificationTemplatesQueryDto,
  ) {
    return this.svc.listTemplates({
      tenantId: String(req.user?.tenantId || ''),
      q,
    });
  }

  // Preferences (staff can set for any staff user / guardian account)
  @RequirePermissions('notifications.write')
  @Post('preferences/user/:userId')
  upsertPrefForUser(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() dto: UpsertNotificationPreferenceDto,
  ) {
    return this.svc.upsertPreferenceForUser({
      tenantId: String(req.user?.tenantId || ''),
      userId,
      dto,
    });
  }

  @RequirePermissions('notifications.write')
  @Post('preferences/student-account/:studentAccountId')
  upsertPrefForStudentAccount(
    @Req() req: any,
    @Param('studentAccountId') studentAccountId: string,
    @Body() dto: UpsertNotificationPreferenceDto,
  ) {
    return this.svc.upsertPreferenceForStudentAccount({
      tenantId: String(req.user?.tenantId || ''),
      studentAccountId,
      dto,
    });
  }

  // Send (queue) notification
  @RequirePermissions('notifications.write')
  @Post('send')
  send(@Req() req: any, @Body() dto: SendNotificationDto) {
    return this.svc.send({ tenantId: String(req.user?.tenantId || ''), dto });
  }

  // List
  @RequirePermissions('notifications.read')
  @Get()
  list(@Req() req: any, @Query() q: ListNotificationsQueryDto) {
    return this.svc.listAll({ tenantId: String(req.user?.tenantId || ''), q });
  }

  // Mark status (test uchun)
  @RequirePermissions('notifications.write')
  @Patch(':id/mark-sent')
  markSent(@Req() req: any, @Param('id') id: string) {
    return this.svc.markSent({
      tenantId: String(req.user?.tenantId || ''),
      id,
    });
  }

  @RequirePermissions('notifications.write')
  @Patch(':id/mark-failed')
  markFailed(@Req() req: any, @Param('id') id: string) {
    return this.svc.markFailed({
      tenantId: String(req.user?.tenantId || ''),
      id,
    });
  }
}

@ApiTags('Guardian - Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/notifications')
export class GuardianNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('preferences')
  myPref(@Req() req: any) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.getOrCreateGuardianPref({
      studentAccountId: String(u.studentAccountId || ''),
    });
  }

  @Post('preferences')
  updateMyPref(@Req() req: any, @Body() dto: UpsertNotificationPreferenceDto) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.updateGuardianPref({
      studentAccountId: String(u.studentAccountId || ''),
      dto,
    });
  }

  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['QUEUED', 'SENT', 'FAILED', 'READ'],
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: ['IN_APP', 'TELEGRAM_BOT', 'SMS'],
  })
  @Get()
  myNotifications(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
  ) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.listGuardian({
      studentAccountId: String(u.studentAccountId || ''),
      from,
      to,
      status,
      channel,
    });
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianMarkRead({
      studentAccountId: String(u.studentAccountId || ''),
      id,
    });
  }
}
