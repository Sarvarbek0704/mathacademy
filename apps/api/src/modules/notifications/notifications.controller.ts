// apps/api/src/modules/notifications/notifications.controller.ts
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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

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

  // Templates
  @Post('templates')
  @RequirePermissions('notifications.write')
  @ApiOperation({ summary: 'Create or update a notification template' })
  upsertTemplate(@Req() req: any, @Body() dto: UpsertNotificationTemplateDto) {
    return this.svc.upsertTemplate({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get('templates')
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'List notification templates' })
  listTemplates(
    @Req() req: any,
    @Query() query: ListNotificationTemplatesQueryDto,
  ) {
    return this.svc.listTemplates({
      tenantId: this.tenantId(req),
      query,
    });
  }

  // Preferences (staff can set for any staff user / guardian account)
  @Post('preferences/user/:userId')
  @RequirePermissions('notifications.write')
  @ApiOperation({ summary: 'Upsert notification preferences for a staff user' })
  upsertPrefForUser(
    @Req() req: any,
    @Param('userId', ParseBigIntPipe) userId: bigint,
    @Body() dto: UpsertNotificationPreferenceDto,
  ) {
    return this.svc.upsertPreferenceForUser({
      tenantId: this.tenantId(req),
      userId: userId.toString(),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Post('preferences/student-account/:studentAccountId')
  @RequirePermissions('notifications.write')
  @ApiOperation({
    summary: 'Upsert notification preferences for a guardian account',
  })
  upsertPrefForStudentAccount(
    @Req() req: any,
    @Param('studentAccountId', ParseBigIntPipe) studentAccountId: bigint,
    @Body() dto: UpsertNotificationPreferenceDto,
  ) {
    return this.svc.upsertPreferenceForStudentAccount({
      tenantId: this.tenantId(req),
      studentAccountId: studentAccountId.toString(),
      dto,
      ipAddress: this.ip(req),
    });
  }

  // Send (queue) notification
  @Post('send')
  @RequirePermissions('notifications.write')
  @ApiOperation({ summary: 'Queue a notification to be sent' })
  send(@Req() req: any, @Body() dto: SendNotificationDto) {
    return this.svc.send({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  // List all notifications (staff)
  @Get()
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'List all notifications' })
  list(@Req() req: any, @Query() query: ListNotificationsQueryDto) {
    return this.svc.listAll({
      tenantId: this.tenantId(req),
      query,
    });
  }

  // Mark status (for testing)
  @Patch(':id/mark-sent')
  @RequirePermissions('notifications.write')
  @ApiOperation({ summary: 'Mark notification as sent (for testing)' })
  markSent(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.markSent({
      tenantId: this.tenantId(req),
      notificationId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Patch(':id/mark-failed')
  @RequirePermissions('notifications.write')
  @ApiOperation({ summary: 'Mark notification as failed (for testing)' })
  markFailed(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.markFailed({
      tenantId: this.tenantId(req),
      notificationId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Notifications')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/notifications')
export class GuardianNotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  private tenantId(req: any): string {
    return String(req.user?.tenantId || '');
  }

  private studentAccountId(req: any): string {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return String(user.studentAccountId || '');
  }

  private ip(req: any): string | undefined {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || undefined;
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get my notification preferences' })
  myPref(@Req() req: any) {
    return this.svc.getOrCreateGuardianPref({
      studentAccountId: this.studentAccountId(req),
    });
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update my notification preferences' })
  updateMyPref(@Req() req: any, @Body() dto: UpsertNotificationPreferenceDto) {
    return this.svc.updateGuardianPref({
      studentAccountId: this.studentAccountId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  myNotifications(@Req() req: any, @Query() query: ListNotificationsQueryDto) {
    return this.svc.listGuardian({
      studentAccountId: this.studentAccountId(req),
      query,
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.guardianMarkRead({
      studentAccountId: this.studentAccountId(req),
      notificationId: id.toString(),
      ipAddress: this.ip(req),
    });
  }
}
