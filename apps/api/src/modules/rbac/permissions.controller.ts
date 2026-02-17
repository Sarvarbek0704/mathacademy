// apps/api/src/modules/rbac/permissions.controller.ts
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

import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ListPermissionsQueryDto } from './dto/list-permissions.query.dto';

@ApiTags('RBAC - Permissions')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('rbac/permissions')
export class PermissionsController {
  constructor(private readonly svc: PermissionsService) {}

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
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Create a new permission (global)' })
  create(@Req() req: any, @Body() dto: CreatePermissionDto) {
    return this.svc.create({
      tenantId: this.tenantId(req), // ✅ tenantId qo‘shildi
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('permissions.view')
  @ApiOperation({ summary: 'List all permissions' })
  list(@Req() req: any, @Query() query: ListPermissionsQueryDto) {
    return this.svc.list({ query });
  }

  @Get(':id')
  @RequirePermissions('permissions.view')
  @ApiOperation({ summary: 'Get permission by ID' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({ permissionId: id.toString() });
  }

  @Patch(':id')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Update permission' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req), // ✅ tenantId qo‘shildi
      permissionId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Delete permission' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req), // ✅ tenantId qo‘shildi
      permissionId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
