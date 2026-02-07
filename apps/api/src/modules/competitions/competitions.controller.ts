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
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { SetCompetitionEntriesDto } from './dto/set-entries.dto';
import { SetCompetitionResultsDto } from './dto/set-results.dto';

@ApiTags('Staff - Competitions')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/competitions')
export class CompetitionsController {
  constructor(private readonly svc: CompetitionsService) {}

  @RequirePermissions('competitions.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateCompetitionDto) {
    return this.svc.create({ tenantId: String(req.user?.tenantId || ''), dto });
  }

  @RequirePermissions('competitions.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'mode', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('mode') mode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      tenantId: String(req.user?.tenantId || ''),
      from,
      to,
      q,
      mode,
      limit,
      offset,
    });
  }

  @RequirePermissions('competitions.write')
  @Post(':id/entries')
  setEntries(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetCompetitionEntriesDto,
  ) {
    return this.svc.setEntries({
      tenantId: String(req.user?.tenantId || ''),
      competitionId: id,
      dto,
    });
  }

  @RequirePermissions('competitions.read')
  @Get(':id/entries')
  entries(@Req() req: any, @Param('id') id: string) {
    return this.svc.entries({
      tenantId: String(req.user?.tenantId || ''),
      competitionId: id,
    });
  }

  @RequirePermissions('competitions.write')
  @Post(':id/results')
  setResults(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetCompetitionResultsDto,
  ) {
    return this.svc.setResults({
      tenantId: String(req.user?.tenantId || ''),
      competitionId: id,
      dto,
    });
  }

  @RequirePermissions('competitions.read')
  @Get(':id/results')
  results(@Req() req: any, @Param('id') id: string) {
    return this.svc.results({
      tenantId: String(req.user?.tenantId || ''),
      competitionId: id,
    });
  }
}

@ApiTags('Guardian - Competitions')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/competitions')
export class GuardianCompetitionsController {
  constructor(private readonly svc: CompetitionsService) {}

  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @Get()
  my(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(u.studentAccountId || ''),
      from,
      to,
    });
  }

  @Get(':id/result')
  myResult(@Req() req: any, @Param('id') id: string) {
    const u = req.user;
    if (!u || u.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianResult({
      studentAccountId: String(u.studentAccountId || ''),
      competitionId: id,
    });
  }
}
