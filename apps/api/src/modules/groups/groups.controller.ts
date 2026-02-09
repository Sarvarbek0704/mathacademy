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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { SetGroupSubjectsDto } from './dto/set-group-subjects.dto';
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
    @Query('status') status?: string,
  ) {
    return this.groups.list({
      tenantId: String(req.user?.tenantId || ''),
      academicYearId,
      grade,
      status,
    });
  }

  @RequirePermissions('groups.read')
  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.groups.detail({
      tenantId: String(req.user?.tenantId || ''),
      id,
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

  @RequirePermissions('groups.write')
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update({
      tenantId: String(req.user?.tenantId || ''),
      id,
      dto,
    });
  }

  @RequirePermissions('groups.write')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.groups.remove({
      tenantId: String(req.user?.tenantId || ''),
      id,
    });
  }

  // ✅ Qo‘shimcha foydali endpoint:
  @RequirePermissions('groups.write')
  @Post(':id/subjects')
  setSubjects(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SetGroupSubjectsDto,
  ) {
    return this.groups.setSubjects({
      tenantId: String(req.user?.tenantId || ''),
      groupId: id,
      subjectIds: dto.subjectIds,
    });
  }
}
