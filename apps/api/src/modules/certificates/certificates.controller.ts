import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { CertificatesService } from './certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { SetOutcomeDto } from './dto/set-outcome.dto';

@ApiTags('Staff - Certificates')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/certificates')
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @RequirePermissions('certificates.write')
  @Post()
  create(@Req() req: any, @Body() dto: CreateCertificateDto) {
    return this.svc.createCertificate({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }

  @RequirePermissions('certificates.read')
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listCertificates({
      tenantId: String(req.user?.tenantId || ''),
      studentId,
      groupId,
      q,
      limit,
      offset,
    });
  }
}

@ApiTags('Staff - Outcomes')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/outcomes')
export class OutcomesController {
  constructor(private readonly svc: CertificatesService) {}

  @RequirePermissions('outcomes.write')
  @Post()
  set(@Req() req: any, @Body() dto: SetOutcomeDto) {
    return this.svc.setOutcome({
      tenantId: String(req.user?.tenantId || ''),
      userId: String(req.user?.userId || ''),
      dto,
    });
  }

  @RequirePermissions('outcomes.read')
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @Get()
  list(
    @Req() req: any,
    @Query('studentId') studentId?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.svc.listOutcomes({
      tenantId: String(req.user?.tenantId || ''),
      studentId,
      groupId,
    });
  }
}

@ApiTags('Guardian - Certificates')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/certificates')
export class GuardianCertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @Get()
  my(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianCertificates({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}

@ApiTags('Guardian - Outcome')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/outcome')
export class GuardianOutcomeController {
  constructor(private readonly svc: CertificatesService) {}

  @Get()
  my(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianOutcome({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
