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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { RankingService } from './ranking.service';
import { CreateGradeSnapshotDto } from './dto/create-snapshot.dto';

@ApiTags('Staff - Ranking')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/ranking')
export class RankingController {
  constructor(private readonly svc: RankingService) {}

  @RequirePermissions('ranking.write')
  @Post('snapshots')
  createSnapshot(@Req() req: any, @Body() dto: CreateGradeSnapshotDto) {
    return this.svc.createSnapshot({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }

  @RequirePermissions('ranking.read')
  @Get('snapshots')
  listSnapshots(
    @Req() req: any,
    @Query('groupId') groupId?: string,
    @Query('periodType') periodType?: string,
  ) {
    return this.svc.listSnapshots({
      tenantId: String(req.user?.tenantId || ''),
      groupId,
      periodType,
    });
  }

  @RequirePermissions('ranking.read')
  @Get('snapshots/:id')
  snapshotRows(@Req() req: any, @Param('id') id: string) {
    return this.svc.snapshotRows({
      tenantId: String(req.user?.tenantId || ''),
      snapshotId: id,
    });
  }

  @RequirePermissions('ranking.read')
  @Get('live')
  live(
    @Req() req: any,
    @Query('groupId') groupId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.liveRanking({
      tenantId: String(req.user?.tenantId || ''),
      groupId,
      from,
      to,
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
  latest(@Req() req: any, @Query('periodType') periodType = 'WEEK') {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianLatest({
      studentAccountId: String(user.studentAccountId || ''),
      periodType: String(periodType || 'WEEK'),
    });
  }
}
