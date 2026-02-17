// apps/api/src/modules/displays/displays.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { DisplayListQueryDto } from './dto/display-list.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class DisplaysService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ==================== DISPLAYS ====================

  async createDisplay(args: {
    tenantId: string;
    userId: string;
    dto: CreateDisplayDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        let campus_id: bigint | null = null;
        if (args.dto.campusId) {
          campus_id = toBigInt(args.dto.campusId, 'campusId');
          const campus = await tx.campuses.findFirst({
            where: { id: campus_id, tenant_id },
          });
          if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
        }

        const display = await tx.displays.create({
          data: {
            tenant_id,
            campus_id,
            name: args.dto.name.trim(),
            location_desc: args.dto.locationDesc?.trim() || null,
            is_active: args.dto.isActive ?? true,
          },
          include: {
            campuses: true,
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'displays',
          entityId: display.id,
          afterData: {
            id: display.id.toString(),
            name: display.name,
            campus: display.campuses?.name || null,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: display.id.toString(),
          name: display.name,
          campusId: display.campus_id?.toString() || null,
          campusName: display.campuses?.name || null,
          locationDesc: display.location_desc,
          isActive: display.is_active,
          createdAt: (display as any).created_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listDisplays(args: { tenantId: string; query: DisplayListQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.displaysWhereInput = {
        tenant_id,
      };

      if (args.query.campusId) {
        where.campus_id = toBigInt(args.query.campusId, 'campusId');
      }

      if (args.query.active !== undefined) {
        where.is_active = args.query.active;
      }

      const orderBy: Prisma.displaysOrderByWithRelationInput = {};
      if (args.query.sortBy === 'name') {
        orderBy.name = args.query.sortDir ?? 'desc';
      } else if (args.query.sortBy === 'id') {
        orderBy.id = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.displays.count({ where }),
        this.prisma.displays.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            campuses: true,
            _count: {
              select: { display_playlists: true },
            },
          },
        }),
      ]);

      return {
        data: items.map((d) => ({
          id: d.id.toString(),
          name: d.name,
          campusId: d.campus_id?.toString() || null,
          campusName: d.campuses?.name || null,
          locationDesc: d.location_desc,
          isActive: d.is_active,
          createdAt: (d as any).created_at,
          playlistsCount: d._count.display_playlists,
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getDisplayById(args: { tenantId: string; displayId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');

      const display = await this.prisma.displays.findFirst({
        where: { id: display_id, tenant_id },
        include: {
          campuses: true,
          display_playlists: {
            orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
            include: {
              _count: {
                select: { display_items: true },
              },
            },
          },
        },
      });

      if (!display) {
        throw new NotFoundException('DISPLAY_NOT_FOUND');
      }

      return {
        id: display.id.toString(),
        name: display.name,
        campusId: display.campus_id?.toString() || null,
        campusName: display.campuses?.name || null,
        locationDesc: display.location_desc,
        isActive: display.is_active,
        createdAt: (display as any).created_at,
        playlists: display.display_playlists.map((p) => ({
          id: p.id.toString(),
          name: p.name,
          isDefault: p.is_default,
          createdAt: (p as any).created_at,
          itemsCount: p._count.display_items,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateDisplay(args: {
    tenantId: string;
    displayId: string;
    userId: string;
    dto: UpdateDisplayDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.displays.findFirst({
          where: { id: display_id, tenant_id },
          include: { campuses: true },
        });
        if (!existing) throw new NotFoundException('DISPLAY_NOT_FOUND');

        const updateData: Prisma.displaysUpdateInput = {};

        if (args.dto.name !== undefined) {
          updateData.name = args.dto.name.trim();
        }
        if (args.dto.campusId !== undefined) {
          if (args.dto.campusId) {
            const campus_id = toBigInt(args.dto.campusId, 'campusId');
            const campus = await tx.campuses.findFirst({
              where: { id: campus_id, tenant_id },
            });
            if (!campus) throw new NotFoundException('CAMPUS_NOT_FOUND');
            updateData.campuses = { connect: { id: campus_id } };
          } else {
            updateData.campuses = { disconnect: true };
          }
        }
        if (args.dto.locationDesc !== undefined) {
          updateData.location_desc = args.dto.locationDesc?.trim() || null;
        }
        if (args.dto.isActive !== undefined) {
          updateData.is_active = args.dto.isActive;
        }

        const updated = await tx.displays.update({
          where: { id: display_id },
          data: updateData,
          include: {
            campuses: true,
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'displays',
          entityId: display_id,
          beforeData: {
            id: existing.id.toString(),
            name: existing.name,
            isActive: existing.is_active,
          },
          afterData: {
            id: updated.id.toString(),
            name: updated.name,
            isActive: updated.is_active,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          name: updated.name,
          campusId: updated.campus_id?.toString() || null,
          campusName: updated.campuses?.name || null,
          locationDesc: updated.location_desc,
          isActive: updated.is_active,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteDisplay(args: {
    tenantId: string;
    displayId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const display = await tx.displays.findFirst({
          where: { id: display_id, tenant_id },
        });
        if (!display) throw new NotFoundException('DISPLAY_NOT_FOUND');

        const playlistsCount = await tx.display_playlists.count({
          where: { display_id },
        });
        if (playlistsCount > 0) {
          throw new BadRequestException('DISPLAY_HAS_PLAYLISTS');
        }

        await tx.displays.delete({ where: { id: display_id } });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'displays',
          entityId: display_id,
          beforeData: {
            id: display.id.toString(),
            name: display.name,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: display_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== PLAYLISTS ====================

  async createPlaylist(args: {
    tenantId: string;
    displayId: string;
    userId: string;
    dto: CreatePlaylistDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const display = await tx.displays.findFirst({
          where: { id: display_id, tenant_id },
        });
        if (!display) throw new NotFoundException('DISPLAY_NOT_FOUND');

        if (args.dto.isDefault) {
          await tx.display_playlists.updateMany({
            where: { display_id, tenant_id },
            data: { is_default: false },
          });
        }

        const playlist = await tx.display_playlists.create({
          data: {
            tenant_id,
            display_id,
            name: args.dto.name.trim(),
            is_default: args.dto.isDefault ?? false,
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'display_playlists',
          entityId: playlist.id,
          afterData: {
            id: playlist.id.toString(),
            name: playlist.name,
            displayId: display_id.toString(),
            displayName: display.name,
            isDefault: playlist.is_default,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: playlist.id.toString(),
          name: playlist.name,
          displayId: playlist.display_id.toString(),
          isDefault: playlist.is_default,
          createdAt: (playlist as any).created_at,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listPlaylists(args: { tenantId: string; displayId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');

      const display = await this.prisma.displays.findFirst({
        where: { id: display_id, tenant_id },
      });
      if (!display) throw new NotFoundException('DISPLAY_NOT_FOUND');

      const playlists = await this.prisma.display_playlists.findMany({
        where: { tenant_id, display_id },
        orderBy: [{ is_default: 'desc' }, { id: 'asc' }],
        include: {
          _count: {
            select: { display_items: true },
          },
        },
      });

      return {
        displayId: display_id.toString(),
        playlists: playlists.map((p) => ({
          id: p.id.toString(),
          name: p.name,
          isDefault: p.is_default,
          createdAt: (p as any).created_at,
          itemsCount: p._count.display_items,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getPlaylistById(args: { tenantId: string; playlistId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');

      const playlist = await this.prisma.display_playlists.findFirst({
        where: { id: playlist_id, tenant_id },
        include: {
          displays: true,
          display_items: {
            orderBy: { sort_order: 'asc' },
          },
        },
      });

      if (!playlist) {
        throw new NotFoundException('PLAYLIST_NOT_FOUND');
      }

      return {
        id: playlist.id.toString(),
        name: playlist.name,
        displayId: playlist.display_id.toString(),
        displayName: playlist.displays.name,
        isDefault: playlist.is_default,
        createdAt: (playlist as any).created_at,
        items: playlist.display_items.map((item) => ({
          sortOrder: item.sort_order,
          itemType: item.item_type,
          payload: item.payload ? JSON.parse(item.payload) : null,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updatePlaylist(args: {
    tenantId: string;
    playlistId: string;
    userId: string;
    dto: UpdatePlaylistDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.display_playlists.findFirst({
          where: { id: playlist_id, tenant_id },
          include: { displays: true },
        });
        if (!existing) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        const updateData: Prisma.display_playlistsUpdateInput = {};

        if (args.dto.name !== undefined) {
          updateData.name = args.dto.name.trim();
        }
        if (args.dto.isDefault !== undefined) {
          if (args.dto.isDefault && !existing.is_default) {
            await tx.display_playlists.updateMany({
              where: {
                display_id: existing.display_id,
                tenant_id,
                NOT: { id: playlist_id },
              },
              data: { is_default: false },
            });
          }
          updateData.is_default = args.dto.isDefault;
        }

        const updated = await tx.display_playlists.update({
          where: { id: playlist_id },
          data: updateData,
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'display_playlists',
          entityId: playlist_id,
          beforeData: {
            id: existing.id.toString(),
            name: existing.name,
            isDefault: existing.is_default,
          },
          afterData: {
            id: updated.id.toString(),
            name: updated.name,
            isDefault: updated.is_default,
          },
          ipAddress: args.ipAddress,
        });

        return {
          id: updated.id.toString(),
          name: updated.name,
          displayId: updated.display_id.toString(),
          isDefault: updated.is_default,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deletePlaylist(args: {
    tenantId: string;
    playlistId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        await tx.display_playlists.delete({ where: { id: playlist_id } });

        if (playlist.is_default) {
          const newDefault = await tx.display_playlists.findFirst({
            where: { display_id: playlist.display_id, tenant_id },
            orderBy: { id: 'asc' },
          });
          if (newDefault) {
            await tx.display_playlists.update({
              where: { id: newDefault.id },
              data: { is_default: true },
            });
          }
        }

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'display_playlists',
          entityId: playlist_id,
          beforeData: {
            id: playlist.id.toString(),
            name: playlist.name,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true, id: playlist_id.toString() };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async setDefaultPlaylist(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        if (playlist.is_default) {
          return {
            ok: true,
            alreadyDefault: true,
            playlistId: playlist_id.toString(),
          };
        }

        await tx.display_playlists.updateMany({
          where: { display_id, tenant_id, NOT: { id: playlist_id } },
          data: { is_default: false },
        });

        await tx.display_playlists.update({
          where: { id: playlist_id },
          data: { is_default: true },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'display_playlists',
          entityId: playlist_id,
          beforeData: { isDefault: false },
          afterData: { isDefault: true },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          playlistId: playlist_id.toString(),
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== ITEMS ====================

  async createItem(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    userId: string;
    dto: CreateItemDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const created_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        let sortOrderValue: number;
        if (args.dto.sortOrder !== undefined && args.dto.sortOrder !== null) {
          sortOrderValue = args.dto.sortOrder;
          const existing = await tx.display_items.findFirst({
            where: { playlist_id, sort_order: sortOrderValue },
          });
          if (existing) {
            throw new BadRequestException('SORT_ORDER_ALREADY_EXISTS');
          }
        } else {
          const maxOrder = await tx.display_items.aggregate({
            where: { playlist_id },
            _max: { sort_order: true },
          });
          sortOrderValue = (maxOrder._max.sort_order ?? 0) + 1;
        }

        const payload = args.dto.payload
          ? JSON.stringify(args.dto.payload)
          : null;

        await tx.display_items.create({
          data: {
            playlist_id,
            sort_order: sortOrderValue,
            item_type: args.dto.itemType,
            payload,
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: created_by_user_id,
          action: 'CREATE',
          entityType: 'display_items',
          entityId: undefined,
          afterData: {
            playlistId: playlist_id.toString(),
            playlistName: playlist.name,
            sortOrder: sortOrderValue,
            itemType: args.dto.itemType,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          playlistId: playlist_id.toString(),
          sortOrder: sortOrderValue,
          itemType: args.dto.itemType,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listItems(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');

      const playlist = await this.prisma.display_playlists.findFirst({
        where: { id: playlist_id, display_id, tenant_id },
      });
      if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

      const items = await this.prisma.display_items.findMany({
        where: { playlist_id },
        orderBy: { sort_order: 'asc' },
      });

      return {
        playlistId: playlist_id.toString(),
        items: items.map((item) => ({
          sortOrder: item.sort_order,
          itemType: item.item_type,
          payload: item.payload ? JSON.parse(item.payload) : null,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async getItem(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    sortOrder: number;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const sort_order = args.sortOrder;

      const playlist = await this.prisma.display_playlists.findFirst({
        where: { id: playlist_id, display_id, tenant_id },
      });
      if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

      const item = await this.prisma.display_items.findFirst({
        where: { playlist_id, sort_order },
      });

      if (!item) {
        throw new NotFoundException('ITEM_NOT_FOUND');
      }

      return {
        playlistId: playlist_id.toString(),
        sortOrder: item.sort_order,
        itemType: item.item_type,
        payload: item.payload ? JSON.parse(item.payload) : null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateItem(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    sortOrder: number;
    userId: string;
    dto: UpdateItemDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;
      const old_sort_order = args.sortOrder;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        const item = await tx.display_items.findFirst({
          where: { playlist_id, sort_order: old_sort_order },
        });
        if (!item) throw new NotFoundException('ITEM_NOT_FOUND');

        const updateData: Prisma.display_itemsUpdateInput = {};

        if (args.dto.itemType !== undefined) {
          updateData.item_type = args.dto.itemType;
        }
        if (args.dto.payload !== undefined) {
          updateData.payload = args.dto.payload
            ? JSON.stringify(args.dto.payload)
            : null;
        }
        if (
          args.dto.sortOrder !== undefined &&
          args.dto.sortOrder !== old_sort_order
        ) {
          const new_sort_order = args.dto.sortOrder;
          const existing = await tx.display_items.findFirst({
            where: { playlist_id, sort_order: new_sort_order },
          });
          if (existing) {
            throw new BadRequestException('SORT_ORDER_ALREADY_EXISTS');
          }
          updateData.sort_order = new_sort_order;
        }

        const updated = await tx.display_items.update({
          where: {
            playlist_id_sort_order: {
              playlist_id,
              sort_order: old_sort_order,
            },
          },
          data: updateData,
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'display_items',
          entityId: undefined,
          beforeData: {
            playlistId: playlist_id.toString(),
            sortOrder: old_sort_order,
            itemType: item.item_type,
          },
          afterData: {
            playlistId: playlist_id.toString(),
            sortOrder: updated.sort_order,
            itemType: updated.item_type,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          playlistId: playlist_id.toString(),
          sortOrder: updated.sort_order,
          itemType: updated.item_type,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteItem(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    sortOrder: number;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;
      const sort_order = args.sortOrder;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        const item = await tx.display_items.findFirst({
          where: { playlist_id, sort_order },
        });
        if (!item) throw new NotFoundException('ITEM_NOT_FOUND');

        await tx.display_items.delete({
          where: {
            playlist_id_sort_order: {
              playlist_id,
              sort_order,
            },
          },
        });

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: deleted_by_user_id,
          action: 'DELETE',
          entityType: 'display_items',
          entityId: undefined,
          beforeData: {
            playlistId: playlist_id.toString(),
            sortOrder: sort_order,
            itemType: item.item_type,
          },
          ipAddress: args.ipAddress,
        });

        return { ok: true };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async reorderItems(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    userId: string;
    dto: ReorderItemsDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');
      const playlist_id = toBigInt(args.playlistId, 'playlistId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      return await this.prisma.$transaction(async (tx) => {
        const playlist = await tx.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');

        for (const order of args.dto.orders) {
          const item = await tx.display_items.findFirst({
            where: { playlist_id, sort_order: order.oldSortOrder },
          });
          if (!item) {
            throw new NotFoundException(
              `ITEM_NOT_FOUND: sort_order ${order.oldSortOrder}`,
            );
          }

          if (order.oldSortOrder !== order.newSortOrder) {
            const existing = await tx.display_items.findFirst({
              where: { playlist_id, sort_order: order.newSortOrder },
            });
            if (existing) {
              throw new BadRequestException(
                `SORT_ORDER_${order.newSortOrder}_ALREADY_EXISTS`,
              );
            }

            await tx.display_items.update({
              where: {
                playlist_id_sort_order: {
                  playlist_id,
                  sort_order: order.oldSortOrder,
                },
              },
              data: { sort_order: order.newSortOrder },
            });
          }
        }

        await this.auditLogger.log({
          tenantId: tenant_id,
          actorType: 'STAFF',
          actorUserId: updated_by_user_id,
          action: 'UPDATE',
          entityType: 'display_items',
          entityId: undefined,
          afterData: {
            playlistId: playlist_id.toString(),
            reorderCount: args.dto.orders.length,
          },
          ipAddress: args.ipAddress,
        });

        return {
          ok: true,
          count: args.dto.orders.length,
        };
      });
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ==================== RUNTIME ====================

  async runtime(args: {
    tenantId: string;
    displayId: string;
    playlistId?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const display_id = toBigInt(args.displayId, 'displayId');

      const display = await this.prisma.displays.findFirst({
        where: { id: display_id, tenant_id },
      });
      if (!display) throw new NotFoundException('DISPLAY_NOT_FOUND');
      if (!display.is_active) throw new BadRequestException('DISPLAY_INACTIVE');

      let playlist: any = null;
      if (args.playlistId) {
        const playlist_id = toBigInt(args.playlistId, 'playlistId');
        playlist = await this.prisma.display_playlists.findFirst({
          where: { id: playlist_id, display_id, tenant_id },
        });
        if (!playlist) throw new NotFoundException('PLAYLIST_NOT_FOUND');
      } else {
        playlist = await this.prisma.display_playlists.findFirst({
          where: { display_id, tenant_id, is_default: true },
        });
        if (!playlist) {
          playlist = await this.prisma.display_playlists.findFirst({
            where: { display_id, tenant_id },
            orderBy: { id: 'asc' },
          });
          if (!playlist)
            throw new NotFoundException('NO_PLAYLISTS_FOR_DISPLAY');
        }
      }

      const items = await this.prisma.display_items.findMany({
        where: { playlist_id: playlist.id },
        orderBy: { sort_order: 'asc' },
      });

      return {
        display: {
          id: display.id.toString(),
          name: display.name,
          campusId: display.campus_id?.toString() || null,
          locationDesc: display.location_desc,
          isActive: display.is_active,
        },
        playlist: {
          id: playlist.id.toString(),
          name: playlist.name,
          isDefault: playlist.is_default,
        },
        items: items.map((item) => ({
          sortOrder: item.sort_order,
          itemType: item.item_type,
          payload: item.payload ? JSON.parse(item.payload) : null,
        })),
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
