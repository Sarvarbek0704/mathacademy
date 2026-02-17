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

import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ListTenantsQueryDto } from './dto/list-tenants.query.dto';

@ApiTags('System - Tenants')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@RequireRoles('SUPERADMIN')
@Controller('system/tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

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
  @ApiOperation({ summary: 'Create a new tenant (superadmin only)' })
  create(@Req() req: any, @Body() dto: CreateTenantDto) {
    return this.svc.create({
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  list(@Req() req: any, @Query() query: ListTenantsQueryDto) {
    return this.svc.list({ query });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({ tenantId: id.toString() });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.svc.update({
      tenantId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant (only if no dependencies)' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
