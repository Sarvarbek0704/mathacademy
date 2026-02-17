// apps/api/src/modules/awards/awards.controller.ts
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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';
import { AwardsService } from './awards.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { SetAwardRecipientsDto } from './dto/set-recipients.dto';
import { AwardListQueryDto } from './dto/award-list.query.dto';

@ApiTags('Staff - Awards')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/awards')
export class AwardsController {
  constructor(private readonly svc: AwardsService) {}

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
  @RequirePermissions('awards.write')
  @ApiOperation({ summary: 'Create new award' })
  @ApiResponse({ status: 201, description: 'Award created successfully' })
  create(@Req() req: any, @Body() dto: CreateAwardDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('awards.read')
  @ApiOperation({ summary: 'List awards with pagination and filters' })
  list(@Req() req: any, @Query() query: AwardListQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('statistics')
  @RequirePermissions('awards.read')
  @ApiOperation({ summary: 'Get awards statistics' })
  getStatistics(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getStatistics({
      tenantId: this.tenantId(req),
      from,
      to,
    });
  }

  @Get(':id')
  @RequirePermissions('awards.read')
  @ApiOperation({ summary: 'Get award details' })
  @ApiParam({ name: 'id', description: 'Award ID' })
  getDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDetail({
      tenantId: this.tenantId(req),
      awardId: id.toString(),
    });
  }

  @Post(':id/recipients')
  @RequirePermissions('awards.write')
  @ApiOperation({ summary: 'Set award recipients' })
  @ApiParam({ name: 'id', description: 'Award ID' })
  setRecipients(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SetAwardRecipientsDto,
  ) {
    return this.svc.setRecipients({
      tenantId: this.tenantId(req),
      awardId: id.toString(),
      actorUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Guardian - Awards')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/awards')
export class GuardianAwardsController {
  constructor(private readonly svc: AwardsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my awards' })
  @ApiResponse({ status: 200, description: 'Awards returned successfully' })
  my(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') {
      throw new UnauthorizedException('NOT_GUARDIAN');
    }
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
