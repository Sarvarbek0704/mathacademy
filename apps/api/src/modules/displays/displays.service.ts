import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function safeParseJson(v: any) {
  if (v == null) return null;
  const s = String(v);
  if (!s.trim()) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

@Injectable()
export class DisplaysService {
  constructor(private readonly prisma: PrismaService) {}

  async createDisplay(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const name = String(args.dto.name || '').trim();
    if (!name) throw new BadRequestException('NAME_REQUIRED');

    const campusId = args.dto.campusId ? BigInt(args.dto.campusId) : null;
    const locationDesc = args.dto.locationDesc
      ? String(args.dto.locationDesc)
      : null;
    const isActive =
      typeof args.dto.isActive === 'boolean' ? args.dto.isActive : true;

    if (campusId) {
      const c = await this.prisma.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT id FROM campuses WHERE tenant_id=${tenantId} AND id=${campusId} LIMIT 1`,
      );
      if (!c.length) throw new BadRequestException('CAMPUS_NOT_FOUND');
    }

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO displays (tenant_id, campus_id, name, location_desc, is_active)
        VALUES (${tenantId}, ${campusId}, ${name}, ${locationDesc}, ${isActive})
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async listDisplays(args: {
    tenantId: string;
    campusId?: string;
    active?: string;
    limit?: string;
    offset?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const campusId = args.campusId ? BigInt(args.campusId) : null;

    const active =
      args.active === undefined ||
      args.active === null ||
      String(args.active).trim() === ''
        ? null
        : String(args.active).toLowerCase() === 'true';

    const limit = Math.min(Math.max(Number(args.limit || 50), 1), 200);
    const offset = Math.max(Number(args.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          d.id::text AS id,
          d.campus_id::text AS campus_id,
          d.name,
          d.location_desc,
          d.is_active
        FROM displays d
        WHERE d.tenant_id=${tenantId}
          ${campusId ? Prisma.sql`AND d.campus_id=${campusId}` : Prisma.empty}
          ${active === null ? Prisma.empty : Prisma.sql`AND d.is_active=${active}`}
        ORDER BY d.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async createPlaylist(args: {
    tenantId: string;
    displayId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);

    const name = String(args.dto.name || '').trim();
    if (!name) throw new BadRequestException('NAME_REQUIRED');

    const isDefault =
      typeof args.dto.isDefault === 'boolean' ? args.dto.isDefault : false;

    const d = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM displays WHERE tenant_id=${tenantId} AND id=${displayId} LIMIT 1`,
    );
    if (!d.length) throw new BadRequestException('DISPLAY_NOT_FOUND');

    if (isDefault) {
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE display_playlists SET is_default=false WHERE tenant_id=${tenantId} AND display_id=${displayId}`,
      );
    }

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO display_playlists (tenant_id, display_id, name, is_default)
        VALUES (${tenantId}, ${displayId}, ${name}, ${isDefault})
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString() };
  }

  async listPlaylists(args: { tenantId: string; displayId: string }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);

    const d = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM displays WHERE tenant_id=${tenantId} AND id=${displayId} LIMIT 1`,
    );
    if (!d.length) throw new BadRequestException('DISPLAY_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          p.id::text AS id,
          p.name,
          p.is_default
        FROM display_playlists p
        WHERE p.tenant_id=${tenantId} AND p.display_id=${displayId}
        ORDER BY p.is_default DESC, p.id DESC
      `,
    );

    return { data: rows };
  }

  async setDefaultPlaylist(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);
    const playlistId = BigInt(args.playlistId);

    const p = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT id
        FROM display_playlists
        WHERE tenant_id=${tenantId} AND display_id=${displayId} AND id=${playlistId}
        LIMIT 1
      `,
    );
    if (!p.length) throw new BadRequestException('PLAYLIST_NOT_FOUND');

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE display_playlists SET is_default=false WHERE tenant_id=${tenantId} AND display_id=${displayId}`,
    );
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE display_playlists SET is_default=true WHERE tenant_id=${tenantId} AND display_id=${displayId} AND id=${playlistId}`,
    );

    return { ok: true };
  }

  async createItem(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);
    const playlistId = BigInt(args.playlistId);

    const itemType = String(args.dto.itemType || '').trim();
    const allowed = ['RANKING', 'EVENT', 'ANNOUNCEMENT', 'WINNERS'];
    if (!allowed.includes(itemType))
      throw new BadRequestException('INVALID_ITEM_TYPE');

    const p = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT p.id
        FROM display_playlists p
        JOIN displays d ON d.id=p.display_id
        WHERE p.tenant_id=${tenantId}
          AND p.id=${playlistId}
          AND d.id=${displayId}
          AND d.tenant_id=${tenantId}
        LIMIT 1
      `,
    );
    if (!p.length) throw new BadRequestException('PLAYLIST_NOT_FOUND');

    let sortOrder: number | null =
      typeof args.dto.sortOrder === 'number' ? args.dto.sortOrder : null;

    if (!sortOrder) {
      const maxRows = await this.prisma.$queryRaw<{ m: number | null }[]>(
        Prisma.sql`SELECT COALESCE(MAX(sort_order), 0) AS m FROM display_items WHERE playlist_id=${playlistId}`,
      );
      sortOrder = Number(maxRows[0]?.m || 0) + 1;
    } else {
      const exists = await this.prisma.$queryRaw<{ ok: number }[]>(
        Prisma.sql`SELECT 1 AS ok FROM display_items WHERE playlist_id=${playlistId} AND sort_order=${sortOrder} LIMIT 1`,
      );
      if (exists.length)
        throw new BadRequestException('SORT_ORDER_ALREADY_USED');
    }

    const payloadStr = args.dto.payload
      ? JSON.stringify(args.dto.payload)
      : null;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO display_items (playlist_id, sort_order, item_type, payload)
        VALUES (${playlistId}, ${sortOrder}, ${itemType}, ${payloadStr})
      `,
    );

    return { ok: true, playlistId: playlistId.toString(), sortOrder };
  }

  async listItems(args: {
    tenantId: string;
    displayId: string;
    playlistId: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);
    const playlistId = BigInt(args.playlistId);

    const p = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT p.id
        FROM display_playlists p
        JOIN displays d ON d.id=p.display_id
        WHERE p.tenant_id=${tenantId} AND p.id=${playlistId}
          AND d.id=${displayId} AND d.tenant_id=${tenantId}
        LIMIT 1
      `,
    );
    if (!p.length) throw new BadRequestException('PLAYLIST_NOT_FOUND');

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          di.playlist_id::text AS playlist_id,
          di.sort_order,
          di.item_type,
          di.payload
        FROM display_items di
        WHERE di.playlist_id=${playlistId}
        ORDER BY di.sort_order ASC
      `,
    );

    const data = rows.map((r) => ({
      playlistId: r.playlist_id,
      sortOrder: r.sort_order,
      itemType: r.item_type,
      payload: safeParseJson(r.payload),
      payloadRaw: r.payload,
    }));

    return { data };
  }

  async runtime(args: {
    tenantId: string;
    displayId: string;
    playlistId?: string;
  }) {
    const tenantId = BigInt(args.tenantId);
    const displayId = BigInt(args.displayId);
    const playlistId = args.playlistId ? BigInt(args.playlistId) : null;

    const d = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          campus_id::text AS campus_id,
          name,
          location_desc,
          is_active
        FROM displays
        WHERE tenant_id=${tenantId} AND id=${displayId}
        LIMIT 1
      `,
    );
    if (!d.length) throw new BadRequestException('DISPLAY_NOT_FOUND');

    let pl: any[] = [];
    if (playlistId) {
      pl = await this.prisma.$queryRaw<any[]>(
        Prisma.sql`
          SELECT id::text AS id, name, is_default
          FROM display_playlists
          WHERE tenant_id=${tenantId} AND display_id=${displayId} AND id=${playlistId}
          LIMIT 1
        `,
      );
      if (!pl.length) throw new BadRequestException('PLAYLIST_NOT_FOUND');
    } else {
      pl = await this.prisma.$queryRaw<any[]>(
        Prisma.sql`
          SELECT id::text AS id, name, is_default
          FROM display_playlists
          WHERE tenant_id=${tenantId} AND display_id=${displayId}
          ORDER BY is_default DESC, id DESC
          LIMIT 1
        `,
      );
      if (!pl.length) throw new BadRequestException('NO_PLAYLISTS');
    }

    const items = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT sort_order, item_type, payload
        FROM display_items
        WHERE playlist_id=${BigInt(pl[0].id)}
        ORDER BY sort_order ASC
      `,
    );

    return {
      display: d[0],
      playlist: pl[0],
      items: items.map((r) => ({
        sortOrder: r.sort_order,
        itemType: r.item_type,
        payload: safeParseJson(r.payload),
        payloadRaw: r.payload,
      })),
    };
  }
}
