// apps/api/src/modules/competitions/competitions.controller.ts
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
  ApiQuery,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CompetitionListQueryDto } from './dto/competition-list.query.dto';
import { SetCompetitionEntriesDto } from './dto/set-entries.dto';
import { SetCompetitionResultsDto } from './dto/set-results.dto';

@ApiTags('Staff - Competitions')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/competitions')
export class CompetitionsController {
  constructor(private readonly svc: CompetitionsService) {}

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
  @RequirePermissions('competitions.write')
  @ApiOperation({ summary: 'Create new competition' })
  @ApiResponse({ status: 201, description: 'Competition created' })
  create(@Req() req: any, @Body() dto: CreateCompetitionDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('competitions.read')
  @ApiOperation({ summary: 'List competitions with pagination and filters' })
  list(@Req() req: any, @Query() query: CompetitionListQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('competitions.read')
  @ApiOperation({ summary: 'Get competition details with entries and results' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  getDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDetail({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('competitions.write')
  @ApiOperation({ summary: 'Update competition' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateCompetitionDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('competitions.write')
  @ApiOperation({ summary: 'Delete competition' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  remove(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.remove({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/entries')
  @RequirePermissions('competitions.write')
  @ApiOperation({ summary: 'Set competition entries (replaces all)' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  setEntries(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SetCompetitionEntriesDto,
  ) {
    return this.svc.setEntries({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':id/entries')
  @RequirePermissions('competitions.read')
  @ApiOperation({ summary: 'Get competition entries' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  getEntries(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getEntries({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
    });
  }

  @Post(':id/results')
  @RequirePermissions('competitions.write')
  @ApiOperation({ summary: 'Set competition results (upsert)' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  setResults(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: SetCompetitionResultsDto,
  ) {
    return this.svc.setResults({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':id/results')
  @RequirePermissions('competitions.read')
  @ApiOperation({ summary: 'Get competition results' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  getResults(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getResults({
      tenantId: this.tenantId(req),
      competitionId: id.toString(),
    });
  }
}

@ApiTags('Guardian - Competitions')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/competitions')
export class GuardianCompetitionsController {
  constructor(private readonly svc: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my competitions' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  my(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianList({
      studentAccountId: String(user.studentAccountId || ''),
      from,
      to,
    });
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Get my result in a competition' })
  @ApiParam({ name: 'id', description: 'Competition ID' })
  myResult(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianResult({
      studentAccountId: String(user.studentAccountId || ''),
      competitionId: id.toString(),
    });
  }
}
