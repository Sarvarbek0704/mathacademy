import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { AcademicYearsService } from './academic-years.service';

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
}
