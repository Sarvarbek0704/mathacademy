import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Patch,
  Body,
  Post,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { StudentsService } from './students.service';
import { StudentListQuery } from './dto/student-list.query';
import { CreateStudentDto } from './dto/create-student.dto';
import { AssignGroupDto } from './dto/assign-group.dto';

@ApiTags('Staff - Students')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @RequirePermissions('students.read')
  @Get()
  list(@Req() req: any, @Query() query: StudentListQuery) {
    return this.students.list({
      tenantId: String(req.user?.tenantId || ''),
      q: query.q,
      groupId: query.groupId,
      status: query.status,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }

  @RequirePermissions('students.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateStudentDto) {
    return this.students.create({
      tenantId: String(req.user?.tenantId || ''),
      createdByUserId: String(req.user?.userId || ''),
      dto,
    });
  }
  @RequirePermissions('students.write')
  @Patch(':id/group')
  assignGroup(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignGroupDto,
  ) {
    return this.students.assignGroup({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id,
      groupId: dto.groupId,
    });
  }

  @RequirePermissions('students.read')
  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.students.detail({
      tenantId: String(req.user?.tenantId || ''),
      studentId: id,
    });
  }
}
