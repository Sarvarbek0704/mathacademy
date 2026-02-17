// apps/api/src/modules/ranking/ranking.controller.ts
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
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { RankingService } from './ranking.service';
import { CreateGradeSnapshotDto } from './dto/create-snapshot.dto';
import { ListSnapshotsQueryDto } from './dto/list-snapshots.query.dto';
import { LiveRankingQueryDto } from './dto/live-ranking.query.dto';

@ApiTags('Staff - Ranking')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/ranking')
export class RankingController {
  constructor(private readonly svc: RankingService) {}

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

  @Post('snapshots')
  @RequirePermissions('ranking.write')
  @ApiOperation({ summary: 'Create a new grade snapshot (or regenerate)' })
  @ApiResponse({ status: 201, description: 'Snapshot created' })
  createSnapshot(@Req() req: any, @Body() dto: CreateGradeSnapshotDto) {
    return this.svc.createSnapshot({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get('snapshots')
  @RequirePermissions('ranking.read')
  @ApiOperation({ summary: 'List grade snapshots' })
  listSnapshots(@Req() req: any, @Query() query: ListSnapshotsQueryDto) {
    return this.svc.listSnapshots({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('snapshots/:id')
  @RequirePermissions('ranking.read')
  @ApiOperation({ summary: 'Get snapshot rows (rankings) for a snapshot' })
  @ApiParam({ name: 'id', description: 'Snapshot ID' })
  snapshotRows(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.snapshotRows({
      tenantId: this.tenantId(req),
      snapshotId: id.toString(),
    });
  }

  @Get('live')
  @RequirePermissions('ranking.read')
  @ApiOperation({ summary: 'Get live ranking for a group over a date range' })
  live(@Req() req: any, @Query() query: LiveRankingQueryDto) {
    return this.svc.liveRanking({
      tenantId: this.tenantId(req),
      groupId: query.groupId,
      from: query.from,
      to: query.to,
    });
  }
}

@ApiTags('Guardian - Ranking')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/ranking')
export class GuardianRankingController {
  constructor(private readonly svc: RankingService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Get latest snapshot ranking for my child' })
  @ApiQuery({
    name: 'periodType',
    enum: ['WEEK', 'MONTH', 'TERM'],
    required: false,
  })
  latest(@Req() req: any, @Query('periodType') periodType: string = 'WEEK') {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianLatest({
      studentAccountId: String(user.studentAccountId || ''),
      periodType,
    });
  }
}
