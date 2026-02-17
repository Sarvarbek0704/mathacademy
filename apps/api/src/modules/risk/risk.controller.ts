// apps/api/src/modules/risk/risk.controller.ts
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
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { RiskService } from './risk.service';
import { SetRiskDto } from './dto/set-risk.dto';
import { ListRiskQueryDto } from './dto/list-risk.query.dto';

@ApiTags('Staff - Risk')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/risk')
export class RiskController {
  constructor(private readonly svc: RiskService) {}

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

  @Post('scores')
  @RequirePermissions('risk.write')
  @ApiOperation({ summary: 'Set (record) a new risk score for a student' })
  @ApiResponse({ status: 201, description: 'Risk score recorded' })
  setRisk(@Req() req: any, @Body() dto: SetRiskDto) {
    return this.svc.setRisk({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get('scores')
  @RequirePermissions('risk.read')
  @ApiOperation({ summary: 'List risk scores (with pagination, filters)' })
  listRisk(@Req() req: any, @Query() query: ListRiskQueryDto) {
    return this.svc.listRisk({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('latest/group/:groupId')
  @RequirePermissions('risk.read')
  @ApiOperation({
    summary: 'Get latest risk scores for all students in a group',
  })
  latestByGroup(@Req() req: any, @Query('groupId') groupId: string) {
    // We'll handle validation in service
    return this.svc.latestByGroup({
      tenantId: this.tenantId(req),
      groupId,
    });
  }

  @Get('latest/student/:studentId')
  @RequirePermissions('risk.read')
  @ApiOperation({ summary: 'Get latest risk score for a specific student' })
  latestByStudent(@Req() req: any, @Query('studentId') studentId: string) {
    return this.svc.latestByStudent({
      tenantId: this.tenantId(req),
      studentId,
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
  @ApiOperation({ summary: 'Get latest risk score for my child' })
  me(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianMe({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
