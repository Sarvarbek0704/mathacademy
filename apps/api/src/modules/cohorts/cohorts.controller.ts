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
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { CohortsService } from './cohorts.service';
import { CreateCohortDto } from './dto/create-cohort.dto';
import { UpdateCohortDto } from './dto/update-cohort.dto';
import { ListCohortsQueryDto } from './dto/list-cohorts.query.dto';

@ApiTags('Staff - Cohorts')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/cohorts')
export class CohortsController {
  constructor(private readonly svc: CohortsService) {}

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
  @RequirePermissions('cohorts.write')
  @ApiOperation({ summary: 'Create a new cohort' })
  create(@Req() req: any, @Body() dto: CreateCohortDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('cohorts.read')
  @ApiOperation({ summary: 'List cohorts with filters' })
  list(@Req() req: any, @Query() query: ListCohortsQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('cohorts.read')
  @ApiOperation({ summary: 'Get cohort details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({
      tenantId: this.tenantId(req),
      cohortId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('cohorts.write')
  @ApiOperation({ summary: 'Update cohort' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateCohortDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      cohortId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('cohorts.write')
  @ApiOperation({ summary: 'Delete cohort (only if no students assigned)' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      cohortId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
