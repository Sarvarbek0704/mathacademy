// apps/api/src/modules/rbac/roles.controller.ts
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

import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ListRolesQueryDto } from './dto/list-roles.query.dto';

@ApiTags('RBAC - Roles')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('rbac/roles')
export class RolesController {
  constructor(private readonly svc: RolesService) {}

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
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Create a new role' })
  create(@Req() req: any, @Body() dto: CreateRoleDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'List roles' })
  list(@Req() req: any, @Query() query: ListRolesQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Get role details with permissions' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({
      tenantId: this.tenantId(req),
      roleId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Update role' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      roleId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Delete role' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      roleId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/permissions')
  @RequirePermissions('roles.manage')
  @ApiOperation({ summary: 'Assign permissions to role (replaces all)' })
  assignPermissions(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.svc.assignPermissions({
      tenantId: this.tenantId(req),
      roleId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':id/permissions')
  @RequirePermissions('roles.view')
  @ApiOperation({ summary: 'Get permissions assigned to role' })
  getPermissions(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getPermissions({
      tenantId: this.tenantId(req),
      roleId: id.toString(),
    });
  }
}
