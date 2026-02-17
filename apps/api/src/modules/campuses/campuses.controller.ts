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

import { CampusesService } from './campuses.service';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { ListCampusesQueryDto } from './dto/list-campuses.query.dto';

@ApiTags('Staff - Campuses')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/campuses')
export class CampusesController {
  constructor(private readonly svc: CampusesService) {}

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
  @RequirePermissions('campuses.write')
  @ApiOperation({ summary: 'Create a new campus' })
  create(@Req() req: any, @Body() dto: CreateCampusDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('campuses.read')
  @ApiOperation({ summary: 'List campuses with filters' })
  list(@Req() req: any, @Query() query: ListCampusesQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('campuses.read')
  @ApiOperation({ summary: 'Get campus details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({
      tenantId: this.tenantId(req),
      campusId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('campuses.write')
  @ApiOperation({ summary: 'Update campus' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateCampusDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      campusId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('campuses.write')
  @ApiOperation({ summary: 'Delete campus (only if no dependencies)' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      campusId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
