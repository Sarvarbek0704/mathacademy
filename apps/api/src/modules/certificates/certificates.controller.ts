// apps/api/src/modules/certificates/certificates.controller.ts
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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { AccessGuard } from '../../common/guards/access.guard';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { CertificatesService } from './certificates.service';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { SetOutcomeDto } from './dto/set-outcome.dto';
import {
  CertificateListQueryDto,
  OutcomeListQueryDto,
} from './dto/certificate-list.query.dto';

@ApiTags('Staff - Certificates')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/certificates')
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

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
  @RequirePermissions('certificates.write')
  @ApiOperation({ summary: 'Create new certificate' })
  @ApiResponse({ status: 201, description: 'Certificate created' })
  create(@Req() req: any, @Body() dto: CreateCertificateDto) {
    return this.svc.createCertificate({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('certificates.read')
  @ApiOperation({ summary: 'List certificates' })
  list(@Req() req: any, @Query() query: CertificateListQueryDto) {
    return this.svc.listCertificates({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('statistics')
  @RequirePermissions('certificates.read')
  @ApiOperation({ summary: 'Get certificates and outcomes statistics' })
  @ApiQuery({ name: 'groupId', required: false })
  getStatistics(@Req() req: any, @Query('groupId') groupId?: string) {
    return this.svc.getStatistics({
      tenantId: this.tenantId(req),
      groupId,
    });
  }

  @Get(':id')
  @RequirePermissions('certificates.read')
  @ApiOperation({ summary: 'Get certificate by ID' })
  @ApiParam({ name: 'id', description: 'Certificate ID' })
  getById(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getCertificateById({
      tenantId: this.tenantId(req),
      certificateId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('certificates.write')
  @ApiOperation({ summary: 'Update certificate' })
  @ApiParam({ name: 'id', description: 'Certificate ID' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateCertificateDto,
  ) {
    return this.svc.updateCertificate({
      tenantId: this.tenantId(req),
      certificateId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('certificates.write')
  @ApiOperation({ summary: 'Delete certificate' })
  @ApiParam({ name: 'id', description: 'Certificate ID' })
  @ApiResponse({ status: 200, description: 'Certificate deleted' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteCertificate({
      tenantId: this.tenantId(req),
      certificateId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}

@ApiTags('Staff - Outcomes')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/outcomes')
export class OutcomesController {
  constructor(private readonly svc: CertificatesService) {}

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
  @RequirePermissions('outcomes.write')
  @ApiOperation({ summary: 'Set or update student outcome' })
  set(@Req() req: any, @Body() dto: SetOutcomeDto) {
    return this.svc.setOutcome({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('outcomes.read')
  @ApiOperation({ summary: 'List outcomes' })
  list(@Req() req: any, @Query() query: OutcomeListQueryDto) {
    return this.svc.listOutcomes({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get('student/:studentId')
  @RequirePermissions('outcomes.read')
  @ApiOperation({ summary: 'Get outcome by student ID' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  getByStudentId(
    @Req() req: any,
    @Param('studentId', ParseBigIntPipe) studentId: bigint,
  ) {
    return this.svc.getOutcomeByStudentId({
      tenantId: this.tenantId(req),
      studentId: studentId.toString(),
    });
  }

  @Delete('student/:studentId')
  @RequirePermissions('outcomes.write')
  @ApiOperation({ summary: 'Delete outcome' })
  @ApiParam({ name: 'studentId', description: 'Student ID' })
  delete(
    @Req() req: any,
    @Param('studentId', ParseBigIntPipe) studentId: bigint,
  ) {
    return this.svc.deleteOutcome({
      tenantId: this.tenantId(req),
      studentId: studentId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
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
  @ApiOperation({ summary: 'Get my certificates' })
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
  @ApiOperation({ summary: 'Get my outcome' })
  my(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianOutcome({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
