// apps/api/src/modules/rbac/user-roles.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { UserRolesService } from './user-roles.service';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';

@ApiTags('RBAC - User Roles')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('rbac/users')
export class UserRolesController {
  constructor(private readonly svc: UserRolesService) {}

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

  @Post(':userId/roles')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Assign roles to a user (replaces all)' })
  assignRoles(
    @Req() req: any,
    @Param('userId', ParseBigIntPipe) userId: bigint,
    @Body() dto: AssignUserRolesDto,
  ) {
    return this.svc.assignRoles({
      tenantId: this.tenantId(req),
      targetUserId: userId.toString(),
      actorUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':userId/roles')
  @RequirePermissions('users.view')
  @ApiOperation({ summary: 'Get roles assigned to a user' })
  getUserRoles(
    @Req() req: any,
    @Param('userId', ParseBigIntPipe) userId: bigint,
  ) {
    return this.svc.getUserRoles({
      tenantId: this.tenantId(req),
      userId: userId.toString(),
    });
  }
}
