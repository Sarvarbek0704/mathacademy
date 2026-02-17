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

import { DormsService } from './dorms.service';
import { CreateDormDto } from './dto/create-dorm.dto';
import { UpdateDormDto } from './dto/update-dorm.dto';
import { ListDormsQueryDto } from './dto/list-dorms.query.dto';

@ApiTags('Staff - Dorms')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/dorms')
export class DormsController {
  constructor(private readonly svc: DormsService) {}

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
  @RequirePermissions('dorms.write')
  @ApiOperation({ summary: 'Create a new dorm' })
  create(@Req() req: any, @Body() dto: CreateDormDto) {
    return this.svc.createDorm({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('dorms.read')
  @ApiOperation({ summary: 'List dorms' })
  list(@Req() req: any, @Query() query: ListDormsQueryDto) {
    return this.svc.listDorms({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('dorms.read')
  @ApiOperation({ summary: 'Get dorm details with rooms' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getDorm({
      tenantId: this.tenantId(req),
      dormId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('dorms.write')
  @ApiOperation({ summary: 'Update dorm' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateDormDto,
  ) {
    return this.svc.updateDorm({
      tenantId: this.tenantId(req),
      dormId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('dorms.write')
  @ApiOperation({ summary: 'Delete dorm (only if no rooms)' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteDorm({
      tenantId: this.tenantId(req),
      dormId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
