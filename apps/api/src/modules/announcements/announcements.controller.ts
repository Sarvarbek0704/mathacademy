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

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements.query.dto';

@ApiTags('Staff - Announcements')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/announcements')
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

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
  @RequirePermissions('announcements.write')
  @ApiOperation({ summary: 'Create an announcement' })
  create(@Req() req: any, @Body() dto: CreateAnnouncementDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('announcements.read')
  @ApiOperation({ summary: 'List announcements' })
  list(@Req() req: any, @Query() query: ListAnnouncementsQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('announcements.read')
  @ApiOperation({ summary: 'Get announcement details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({
      tenantId: this.tenantId(req),
      announcementId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('announcements.write')
  @ApiOperation({ summary: 'Update announcement' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      announcementId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('announcements.write')
  @ApiOperation({ summary: 'Delete announcement' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      announcementId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/publish')
  @RequirePermissions('announcements.write')
  @ApiOperation({
    summary: 'Publish announcement (set isPublished=true, publishedAt=now)',
  })
  publish(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.publish({
      tenantId: this.tenantId(req),
      announcementId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/unpublish')
  @RequirePermissions('announcements.write')
  @ApiOperation({ summary: 'Unpublish announcement (set isPublished=false)' })
  unpublish(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.unpublish({
      tenantId: this.tenantId(req),
      announcementId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Announcements')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/announcements')
export class GuardianAnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get published announcements for guardians' })
  list(@Req() req: any, @Query() query: ListAnnouncementsQueryDto) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }
    // Guardian can only see published announcements with audience = GUARDIANS or ALL
    return this.svc.listForGuardian({
      tenantId: String(user.tenantId || ''),
      query,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific published announcement' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }
    return this.svc.getForGuardian({
      tenantId: String(user.tenantId || ''),
      announcementId: id.toString(),
    });
  }
}
