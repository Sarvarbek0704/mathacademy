import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { CreateItemDto } from './dto/create-item.dto';

@ApiTags('Staff - Displays')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/displays')
export class DisplaysController {
  constructor(private readonly svc: DisplaysService) {}

  @RequirePermissions('displays.write')
  @Post()
  createDisplay(@Req() req: any, @Body() dto: CreateDisplayDto) {
    return this.svc.createDisplay({
      tenantId: String(req.user?.tenantId || ''),
      dto,
    });
  }

  @RequirePermissions('displays.read')
  @ApiQuery({ name: 'campusId', required: false })
  @ApiQuery({ name: 'active', required: false, description: 'true/false' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @Get()
  listDisplays(
    @Req() req: any,
    @Query('campusId') campusId?: string,
    @Query('active') active?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listDisplays({
      tenantId: String(req.user?.tenantId || ''),
      campusId,
      active,
      limit,
      offset,
    });
  }

  @RequirePermissions('displays.write')
  @Post(':displayId/playlists')
  createPlaylist(
    @Req() req: any,
    @Param('displayId') displayId: string,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.svc.createPlaylist({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
      dto,
    });
  }

  @RequirePermissions('displays.read')
  @Get(':displayId/playlists')
  listPlaylists(@Req() req: any, @Param('displayId') displayId: string) {
    return this.svc.listPlaylists({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
    });
  }

  @RequirePermissions('displays.write')
  @Post(':displayId/playlists/:playlistId/set-default')
  setDefault(
    @Req() req: any,
    @Param('displayId') displayId: string,
    @Param('playlistId') playlistId: string,
  ) {
    return this.svc.setDefaultPlaylist({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
      playlistId,
    });
  }

  @RequirePermissions('displays.write')
  @Post(':displayId/playlists/:playlistId/items')
  createItem(
    @Req() req: any,
    @Param('displayId') displayId: string,
    @Param('playlistId') playlistId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.svc.createItem({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
      playlistId,
      dto,
    });
  }

  @RequirePermissions('displays.read')
  @Get(':displayId/playlists/:playlistId/items')
  listItems(
    @Req() req: any,
    @Param('displayId') displayId: string,
    @Param('playlistId') playlistId: string,
  ) {
    return this.svc.listItems({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
      playlistId,
    });
  }

  // display monitor uchun: default playlist + items (staff token bilan)
  @RequirePermissions('displays.read')
  @ApiQuery({ name: 'playlistId', required: false })
  @Get(':displayId/runtime')
  runtime(
    @Req() req: any,
    @Param('displayId') displayId: string,
    @Query('playlistId') playlistId?: string,
  ) {
    return this.svc.runtime({
      tenantId: String(req.user?.tenantId || ''),
      displayId,
      playlistId,
    });
  }
}
