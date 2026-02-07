import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@ApiTags('Staff - Groups')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @RequirePermissions('groups.read')
  @Get()
  list(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('grade') grade?: string,
  ) {
    return this.groups.list({
      tenantId: String(req.user?.tenantId || ''),
      academicYearId,
      grade,
    });
  }

  @RequirePermissions('groups.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateGroupDto) {
    return this.groups.create({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }
}
