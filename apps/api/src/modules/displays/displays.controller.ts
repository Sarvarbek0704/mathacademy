// apps/api/src/modules/displays/displays.controller.ts
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
  ApiQuery,
} from '@nestjs/swagger';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { DisplayListQueryDto } from './dto/display-list.query.dto';

@ApiTags('Staff - Displays')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/displays')
export class DisplaysController {
  constructor(private readonly svc: DisplaysService) {}

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

  // ==================== DISPLAYS ====================

  @Post()
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Create a new display' })
  @ApiResponse({ status: 201, description: 'Display created' })
  createDisplay(@Req() req: any, @Body() dto: CreateDisplayDto) {
    return this.svc.createDisplay({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'List displays with pagination and filters' })
  listDisplays(@Req() req: any, @Query() query: DisplayListQueryDto) {
    return this.svc.listDisplays({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':displayId')
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'Get display details by ID' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  getDisplayById(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
  ) {
    return this.svc.getDisplayById({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
    });
  }

  @Patch(':displayId')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Update display' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  updateDisplay(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Body() dto: UpdateDisplayDto,
  ) {
    return this.svc.updateDisplay({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':displayId')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Delete display' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  deleteDisplay(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
  ) {
    return this.svc.deleteDisplay({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  // ==================== PLAYLISTS ====================

  @Post(':displayId/playlists')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Create a playlist for a display' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  createPlaylist(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.svc.createPlaylist({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':displayId/playlists')
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'List playlists for a display' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  listPlaylists(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
  ) {
    return this.svc.listPlaylists({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
    });
  }

  @Get(':displayId/playlists/:playlistId')
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'Get playlist details by ID' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  getPlaylistById(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
  ) {
    return this.svc.getPlaylistById({
      tenantId: this.tenantId(req),
      playlistId: playlistId.toString(),
    });
  }

  @Patch(':displayId/playlists/:playlistId')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Update playlist' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  updatePlaylist(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.svc.updatePlaylist({
      tenantId: this.tenantId(req),
      playlistId: playlistId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':displayId/playlists/:playlistId')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Delete playlist' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  deletePlaylist(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
  ) {
    return this.svc.deletePlaylist({
      tenantId: this.tenantId(req),
      playlistId: playlistId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':displayId/playlists/:playlistId/set-default')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Set playlist as default for display' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  setDefaultPlaylist(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
  ) {
    return this.svc.setDefaultPlaylist({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  // ==================== ITEMS ====================

  @Post(':displayId/playlists/:playlistId/items')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Create a new item in a playlist' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  createItem(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Body() dto: CreateItemDto,
  ) {
    return this.svc.createItem({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get(':displayId/playlists/:playlistId/items')
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'List items in a playlist' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  listItems(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
  ) {
    return this.svc.listItems({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
    });
  }

  @Get(':displayId/playlists/:playlistId/items/:sortOrder')
  @RequirePermissions('displays.read')
  @ApiOperation({ summary: 'Get item by sort order' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  @ApiParam({ name: 'sortOrder', description: 'Sort order', type: Number })
  getItem(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Param('sortOrder') sortOrder: string,
  ) {
    return this.svc.getItem({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      sortOrder: parseInt(sortOrder, 10),
    });
  }

  @Patch(':displayId/playlists/:playlistId/items/:sortOrder')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Update an item' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  @ApiParam({
    name: 'sortOrder',
    description: 'Current sort order',
    type: Number,
  })
  updateItem(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Param('sortOrder') sortOrder: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.svc.updateItem({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      sortOrder: parseInt(sortOrder, 10),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':displayId/playlists/:playlistId/items/:sortOrder')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Delete an item' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  @ApiParam({ name: 'sortOrder', description: 'Sort order', type: Number })
  deleteItem(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Param('sortOrder') sortOrder: string,
  ) {
    return this.svc.deleteItem({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      sortOrder: parseInt(sortOrder, 10),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':displayId/playlists/:playlistId/items/reorder')
  @RequirePermissions('displays.write')
  @ApiOperation({ summary: 'Reorder items in a playlist' })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiParam({ name: 'playlistId', description: 'Playlist ID' })
  reorderItems(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Param('playlistId', ParseBigIntPipe) playlistId: bigint,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.svc.reorderItems({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId: playlistId.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  // ==================== RUNTIME ====================

  @Get(':displayId/runtime')
  @RequirePermissions('displays.read')
  @ApiOperation({
    summary: 'Get display runtime data (with playlist and items)',
  })
  @ApiParam({ name: 'displayId', description: 'Display ID' })
  @ApiQuery({
    name: 'playlistId',
    required: false,
    description: 'Specific playlist ID',
  })
  runtime(
    @Req() req: any,
    @Param('displayId', ParseBigIntPipe) displayId: bigint,
    @Query('playlistId') playlistId?: string,
  ) {
    return this.svc.runtime({
      tenantId: this.tenantId(req),
      displayId: displayId.toString(),
      playlistId,
    });
  }
}
