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
import { CreateDormRoomDto } from './dto/create-dorm-room.dto';
import { UpdateDormRoomDto } from './dto/update-dorm-room.dto';
import { ListRoomsQueryDto } from './dto/list-rooms.query.dto';

@ApiTags('Staff - Dorm Rooms')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/dorms/:dormId/rooms')
export class DormRoomsController {
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
  @ApiOperation({ summary: 'Add a room to a dorm' })
  create(
    @Req() req: any,
    @Param('dormId', ParseBigIntPipe) dormId: bigint,
    @Body() dto: CreateDormRoomDto,
  ) {
    return this.svc.createRoom({
      tenantId: this.tenantId(req),
      dormId: dormId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('dorms.read')
  @ApiOperation({ summary: 'List rooms in a dorm' })
  list(
    @Req() req: any,
    @Param('dormId', ParseBigIntPipe) dormId: bigint,
    @Query() query: ListRoomsQueryDto,
  ) {
    return this.svc.listRooms({
      tenantId: this.tenantId(req),
      dormId: dormId.toString(),
      query,
    });
  }

  @Get(':roomId')
  @RequirePermissions('dorms.read')
  @ApiOperation({ summary: 'Get room details' })
  get(
    @Req() req: any,
    @Param('dormId', ParseBigIntPipe) dormId: bigint,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
  ) {
    return this.svc.getRoom({
      tenantId: this.tenantId(req),
      dormId: dormId.toString(),
      roomId: roomId.toString(),
    });
  }

  @Patch(':roomId')
  @RequirePermissions('dorms.write')
  @ApiOperation({ summary: 'Update a room' })
  update(
    @Req() req: any,
    @Param('dormId', ParseBigIntPipe) dormId: bigint,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
    @Body() dto: UpdateDormRoomDto,
  ) {
    return this.svc.updateRoom({
      tenantId: this.tenantId(req),
      dormId: dormId.toString(),
      roomId: roomId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':roomId')
  @RequirePermissions('dorms.write')
  @ApiOperation({ summary: 'Delete a room (only if no assignments)' })
  delete(
    @Req() req: any,
    @Param('dormId', ParseBigIntPipe) dormId: bigint,
    @Param('roomId', ParseBigIntPipe) roomId: bigint,
  ) {
    return this.svc.deleteRoom({
      tenantId: this.tenantId(req),
      dormId: dormId.toString(),
      roomId: roomId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }
}
