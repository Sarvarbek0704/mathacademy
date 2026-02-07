import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { RiskService } from './risk.service';
import { SetRiskDto } from './dto/set-risk.dto';

@ApiTags('Staff - Risk')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/risk')
export class RiskController {
  constructor(private readonly svc: RiskService) {}

  @RequirePermissions('risk.write')
  @Post('scores')
  set(@Req() req: any, @Body() dto: SetRiskDto) {
    return this.svc.setRisk({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('risk.read')
  @Get('latest')
  latestByGroup(@Req() req: any, @Query('groupId') groupId: string) {
    return this.svc.latestByGroup({
      tenantId: String(req.user?.tenantId || ''),
      groupId: String(groupId || ''),
    });
  }
}

@ApiTags('Guardian - Risk')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/risk')
export class GuardianRiskController {
  constructor(private readonly svc: RiskService) {}

  @Get()
  me(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianMe({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
