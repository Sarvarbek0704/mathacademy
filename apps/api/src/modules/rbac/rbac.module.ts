// apps/api/src/modules/rbac/rbac.module.ts
import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RolesService } from './roles.service';
import { UserRolesService } from './user-roles.service';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { UserRolesController } from './user-roles.controller';

@Module({
  controllers: [PermissionsController, RolesController, UserRolesController],
  providers: [PermissionsService, RolesService, UserRolesService],
  exports: [PermissionsService, RolesService, UserRolesService],
})
export class RbacModule {}
