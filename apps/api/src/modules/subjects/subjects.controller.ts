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

import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { ListSubjectsQueryDto } from './dto/list-subjects.query.dto';

@ApiTags('Staff - Subjects')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/subjects')
export class SubjectsController {
  constructor(private readonly svc: SubjectsService) {}

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
  @RequirePermissions('subjects.write')
  @ApiOperation({ summary: 'Create a new subject' })
  create(@Req() req: any, @Body() dto: CreateSubjectDto) {
    return this.svc.create({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('subjects.read')
  @ApiOperation({ summary: 'List subjects with filters' })
  list(@Req() req: any, @Query() query: ListSubjectsQueryDto) {
    return this.svc.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('subjects.read')
  @ApiOperation({ summary: 'Get subject details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getById({
      tenantId: this.tenantId(req),
      subjectId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('subjects.write')
  @ApiOperation({ summary: 'Update subject' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.svc.update({
      tenantId: this.tenantId(req),
      subjectId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('subjects.write')
  @ApiOperation({ summary: 'Delete subject (only if no dependencies)' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.delete({
      tenantId: this.tenantId(req),
      subjectId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
