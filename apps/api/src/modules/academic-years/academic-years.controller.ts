import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';

@ApiTags('Staff - Academic Years')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/academic-years')
export class AcademicYearsController {
  constructor(private readonly ay: AcademicYearsService) {}

  @RequirePermissions('academic_years.read')
  @Get()
  list(@Req() req: any) {
    return this.ay.list({ tenantId: String(req.user?.tenantId || '') });
  }

  @RequirePermissions('academic_years.read')
  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.ay.detail({ tenantId: String(req.user?.tenantId || ''), id });
  }

  @RequirePermissions('academic_years.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateAcademicYearDto) {
    return this.ay.create({ tenantId: String(req.user?.tenantId || ''), dto });
  }

  @RequirePermissions('academic_years.write')
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.ay.update({
      tenantId: String(req.user?.tenantId || ''),
      id,
      dto,
    });
  }

  @RequirePermissions('academic_years.write')
  @Post(':id/set-current')
  setCurrent(@Req() req: any, @Param('id') id: string) {
    return this.ay.setCurrent({
      tenantId: String(req.user?.tenantId || ''),
      id,
    });
  }

  @RequirePermissions('academic_years.write')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.ay.remove({ tenantId: String(req.user?.tenantId || ''), id });
  }
}
