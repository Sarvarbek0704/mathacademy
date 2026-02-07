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
import { AwardsService } from './awards.service';
import { CreateAwardDto } from './dto/create-award.dto';
import { SetAwardRecipientsDto } from './dto/set-recipients.dto';

@ApiTags('Staff - Awards')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/awards')
export class AwardsController {
  constructor(private readonly svc: AwardsService) {}

  @RequirePermissions('awards.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateAwardDto) {
    return this.svc.create({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('awards.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'awardType', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('awardType') awardType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      tenantId: String(req.user?.tenantId || ''),
      from,
      to,
      q,
      awardType,
      limit,
      offset,
    });
  }

  @RequirePermissions('awards.write')
  @Post(':id/recipients')
  setRecipients(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetAwardRecipientsDto,
  ) {
    return this.svc.setRecipients({
      tenantId: String(req.user?.tenantId || ''),
      awardId: id,
      dto,
    });
  }

  @RequirePermissions('awards.read')
  @Get(':id/recipients')
  recipients(@Req() req: any, @Param('id') id: string) {
    return this.svc.recipients({
      tenantId: String(req.user?.tenantId || ''),
      awardId: id,
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
  my(@Req() req: any) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(u.studentAccountId || ''),
    });
  }
}
