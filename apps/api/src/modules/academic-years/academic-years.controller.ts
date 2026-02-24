// apps/api/src/modules/academic-years/academic-years.controller.ts
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
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { RolloverAcademicYearDto } from './dto/rollover-academic-year.dto';
import { AcademicYearListQuery } from './dto/academic-year-list.query.dto';
import { AcademicYearStatsQuery } from './dto/academic-year-stats.query.dto';

@ApiTags('Academic Years')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard, PermissionsGuard)
@Controller('staff/academic-years')
export class AcademicYearsController {
  constructor(private readonly svc: AcademicYearsService) {}

  private tenantId(req: any): string {
    return String(req.user?.tenantId || '');
  }

  private userId(req: any): string | null {
    const userId = req.user?.userId;
    return userId ? String(userId) : null;
  }

  private ip(req: any): string | null {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || null;
  }

  @Get('current')
  @RequirePermissions('academic_years.read')
  @ApiOperation({
    summary: 'Get current academic year',
    description: 'Get the academic year marked as current for the tenant',
  })
  @ApiOkResponse({
    description: 'Current academic year returned successfully',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            name: { type: 'string', example: '2026-2027' },
            startDate: { type: 'string', example: '2026-09-01' },
            endDate: { type: 'string', example: '2027-06-01' },
            isCurrent: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2026-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  current(@Req() req: any) {
    return this.svc.current(this.tenantId(req));
  }

  @Get('stats')
  @RequirePermissions('academic_years.read')
  @ApiOperation({
    summary: 'Get academic years statistics',
    description: 'Get statistics for academic years (last N years optional)',
  })
  @ApiOkResponse({
    description: 'Statistics returned successfully',
  })
  stats(@Req() req: any, @Query() q: AcademicYearStatsQuery) {
    return this.svc.stats(this.tenantId(req), q);
  }

  @Get()
  @RequirePermissions('academic_years.read')
  @ApiOperation({
    summary: 'List academic years',
    description: 'Get paginated list of academic years with filtering',
  })
  @ApiOkResponse({
    description: 'Academic years list returned successfully',
  })
  async list(@Req() req: any, @Query() q: AcademicYearListQuery) {
    const result = await this.svc.list(this.tenantId(req), q);
    return {
      ok: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id/overview')
  @RequirePermissions('academic_years.read')
  @ApiOperation({
    summary: 'Get academic year overview',
    description: 'Get detailed overview with counts for specific academic year',
  })
  @ApiParam({ name: 'id', description: 'Academic Year ID', example: '1' })
  @ApiOkResponse({
    description: 'Overview returned successfully',
  })
  overview(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.overview(this.tenantId(req), id.toString());
  }

  @Get(':id')
  @RequirePermissions('academic_years.read')
  @ApiOperation({
    summary: 'Get academic year details',
    description: 'Get detailed information about specific academic year',
  })
  @ApiParam({ name: 'id', description: 'Academic Year ID', example: '1' })
  @ApiOkResponse({
    description: 'Academic year details returned successfully',
  })
  detail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.detail(this.tenantId(req), id.toString());
  }

  @Post()
  @RequirePermissions('academic_years.write')
  @ApiOperation({
    summary: 'Create new academic year',
    description:
      'Create a new academic year. If marked as current, other years become non-current.',
  })
  @ApiBody({ type: CreateAcademicYearDto })
  @ApiOkResponse({
    description: 'Academic year created successfully',
  })
  create(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    return this.svc.create(
      this.tenantId(req),
      this.userId(req),
      dto,
      this.ip(req),
    );
  }

  @Patch(':id')
  @RequirePermissions('academic_years.write')
  @ApiOperation({
    summary: 'Update academic year',
    description: 'Update academic year information',
  })
  @ApiParam({ name: 'id', description: 'Academic Year ID', example: '1' })
  @ApiBody({ type: UpdateAcademicYearDto })
  @ApiOkResponse({
    description: 'Academic year updated successfully',
  })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.svc.update(
      this.tenantId(req),
      this.userId(req),
      id.toString(),
      dto,
      this.ip(req),
    );
  }

  @Post(':id/set-current')
  @RequirePermissions('academic_years.write')
  @ApiOperation({
    summary: 'Set academic year as current',
    description: 'Set this academic year as current, others become non-current',
  })
  @ApiParam({ name: 'id', description: 'Academic Year ID', example: '1' })
  @ApiOkResponse({
    description: 'Academic year set as current successfully',
  })
  setCurrent(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.setCurrent(
      this.tenantId(req),
      this.userId(req),
      id.toString(),
      this.ip(req),
    );
  }

  @Post(':id/rollover')
  @RequirePermissions('academic_years.write')
  @ApiOperation({
    summary: 'Rollover academic year',
    description:
      'Create new academic year based on existing one, optionally cloning groups',
  })
  @ApiParam({
    name: 'id',
    description: 'Source Academic Year ID',
    example: '1',
  })
  @ApiBody({ type: RolloverAcademicYearDto })
  @ApiOkResponse({
    description: 'Academic year rolled over successfully',
  })
  rollover(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: RolloverAcademicYearDto,
  ) {
    return this.svc.rollover(
      this.tenantId(req),
      this.userId(req),
      id.toString(),
      dto,
      this.ip(req),
    );
  }

  @Delete(':id')
  @RequirePermissions('academic_years.delete')
  @ApiOperation({
    summary: 'Delete academic year',
    description:
      'Delete academic year (requires force parameter if has dependencies)',
  })
  @ApiParam({ name: 'id', description: 'Academic Year ID', example: '1' })
  @ApiQuery({
    name: 'force',
    required: false,
    description: 'Force delete even if has dependencies',
    type: Boolean,
  })
  @ApiOkResponse({
    description: 'Academic year deleted successfully',
  })
  remove(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Query('force') force?: string,
  ) {
    const forceBool = force === '1' || force === 'true' || force === 'yes';
    return this.svc.remove(
      this.tenantId(req),
      this.userId(req),
      id.toString(),
      forceBool,
      this.ip(req),
    );
  }
}
