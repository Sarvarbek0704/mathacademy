import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function tpl(str: string, vars?: Record<string, any>) {
  const s = String(str || '');
  const v = vars || {};
  return s.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const val = v[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Templates ----------
  async upsertTemplate(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const code = String(args.dto.code || '').trim();
    const channel = String(args.dto.channel || '').trim();
    const title = String(args.dto.title || '').trim();
    const body = String(args.dto.body || '').trim();

    if (!code) throw new BadRequestException('CODE_REQUIRED');
    if (!title) throw new BadRequestException('TITLE_REQUIRED');
    if (!body) throw new BadRequestException('BODY_REQUIRED');

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO notification_templates (tenant_id, code, channel, title, body)
        VALUES (${tenantId}, ${code}, ${channel}, ${title}, ${body})
        ON CONFLICT (tenant_id, code, channel)
        DO UPDATE SET title=EXCLUDED.title, body=EXCLUDED.body
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString(), ok: true };
  }

  async listTemplates(args: { tenantId: string; q: any }) {
    const tenantId = BigInt(args.tenantId);
    const q = args.q || {};
    const qq = q.q ? String(q.q).trim() : null;
    const code = q.code ? String(q.code).trim() : null;
    const channel = q.channel ? String(q.channel).trim() : null;

    const limit = Math.min(Math.max(Number(q.limit || 50), 1), 200);
    const offset = Math.max(Number(q.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          code,
          channel,
          title,
          body,
          created_at
        FROM notification_templates
        WHERE tenant_id=${tenantId}
          ${channel ? Prisma.sql`AND channel=${channel}` : Prisma.empty}
          ${code ? Prisma.sql`AND code=${code}` : Prisma.empty}
          ${
            qq
              ? Prisma.sql`AND (code ILIKE ${'%' + qq + '%'} OR title ILIKE ${'%' + qq + '%'} OR body ILIKE ${'%' + qq + '%'})`
              : Prisma.empty
          }
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  // ---------- Preferences (staff) ----------
  async upsertPreferenceForUser(args: {
    tenantId: string;
    userId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const userId = BigInt(args.userId);

    const u = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`SELECT id FROM users WHERE tenant_id=${tenantId} AND id=${userId} LIMIT 1`,
    );
    if (!u.length) throw new BadRequestException('USER_NOT_FOUND');

    const dto = args.dto || {};

    const inAppEnabled =
      typeof dto.inAppEnabled === 'boolean' ? dto.inAppEnabled : undefined;
    const telegramEnabled =
      typeof dto.telegramEnabled === 'boolean'
        ? dto.telegramEnabled
        : undefined;
    const smsEnabled =
      typeof dto.smsEnabled === 'boolean' ? dto.smsEnabled : undefined;

    const telegramChatId =
      dto.telegramChatId !== undefined
        ? String(dto.telegramChatId || '')
        : undefined;
    const smsPhone =
      dto.smsPhone !== undefined ? String(dto.smsPhone || '') : undefined;

    // MVP: SMS real send yo‘q, lekin preference saqlab qo‘yamiz
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO notification_preferences
          (tenant_id, account_type, user_id, student_account_id,
           in_app_enabled, telegram_enabled, sms_enabled, telegram_chat_id, sms_phone, updated_at)
        VALUES
          (${tenantId}, 'STAFF', ${userId}, NULL,
           ${inAppEnabled ?? true}, ${telegramEnabled ?? false}, ${smsEnabled ?? false},
           ${telegramChatId ?? null}, ${smsPhone ?? null}, now())
        ON CONFLICT (tenant_id, account_type, user_id, student_account_id)
        DO UPDATE SET
          in_app_enabled = COALESCE(EXCLUDED.in_app_enabled, notification_preferences.in_app_enabled),
          telegram_enabled = COALESCE(EXCLUDED.telegram_enabled, notification_preferences.telegram_enabled),
          sms_enabled = COALESCE(EXCLUDED.sms_enabled, notification_preferences.sms_enabled),
          telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, notification_preferences.telegram_chat_id),
          sms_phone = COALESCE(EXCLUDED.sms_phone, notification_preferences.sms_phone),
          updated_at = now()
      `,
    );

    return { ok: true };
  }

  async upsertPreferenceForStudentAccount(args: {
    tenantId: string;
    studentAccountId: string;
    dto: any;
  }) {
    const tenantId = BigInt(args.tenantId);
    const studentAccountId = BigInt(args.studentAccountId);

    const a = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        SELECT sa.id
        FROM student_accounts sa
        JOIN students s ON s.id=sa.student_id
        WHERE sa.id=${studentAccountId} AND s.tenant_id=${tenantId}
        LIMIT 1
      `,
    );
    if (!a.length) throw new BadRequestException('STUDENT_ACCOUNT_NOT_FOUND');

    const dto = args.dto || {};
    const inAppEnabled =
      typeof dto.inAppEnabled === 'boolean' ? dto.inAppEnabled : undefined;
    const telegramEnabled =
      typeof dto.telegramEnabled === 'boolean'
        ? dto.telegramEnabled
        : undefined;
    const smsEnabled =
      typeof dto.smsEnabled === 'boolean' ? dto.smsEnabled : undefined;
    const telegramChatId =
      dto.telegramChatId !== undefined
        ? String(dto.telegramChatId || '')
        : undefined;
    const smsPhone =
      dto.smsPhone !== undefined ? String(dto.smsPhone || '') : undefined;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO notification_preferences
          (tenant_id, account_type, user_id, student_account_id,
           in_app_enabled, telegram_enabled, sms_enabled, telegram_chat_id, sms_phone, updated_at)
        VALUES
          (${tenantId}, 'GUARDIAN', NULL, ${studentAccountId},
           ${inAppEnabled ?? true}, ${telegramEnabled ?? false}, ${smsEnabled ?? false},
           ${telegramChatId ?? null}, ${smsPhone ?? null}, now())
        ON CONFLICT (tenant_id, account_type, user_id, student_account_id)
        DO UPDATE SET
          in_app_enabled = COALESCE(EXCLUDED.in_app_enabled, notification_preferences.in_app_enabled),
          telegram_enabled = COALESCE(EXCLUDED.telegram_enabled, notification_preferences.telegram_enabled),
          sms_enabled = COALESCE(EXCLUDED.sms_enabled, notification_preferences.sms_enabled),
          telegram_chat_id = COALESCE(EXCLUDED.telegram_chat_id, notification_preferences.telegram_chat_id),
          sms_phone = COALESCE(EXCLUDED.sms_phone, notification_preferences.sms_phone),
          updated_at = now()
      `,
    );

    return { ok: true };
  }

  // ---------- Preferences (guardian self) ----------
  async getOrCreateGuardianPref(args: { studentAccountId: string }) {
    const studentAccountId = BigInt(args.studentAccountId);

    const base = await this.prisma.$queryRaw<{ tenant_id: bigint }[]>(
      Prisma.sql`
        SELECT s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id=sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const tenantId = base[0].tenant_id;

    const pref = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          in_app_enabled,
          telegram_enabled,
          sms_enabled,
          telegram_chat_id,
          sms_phone
        FROM notification_preferences
        WHERE tenant_id=${tenantId} AND account_type='GUARDIAN' AND student_account_id=${studentAccountId}
        LIMIT 1
      `,
    );

    if (pref.length) return { data: pref[0] };

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO notification_preferences
          (tenant_id, account_type, user_id, student_account_id,
           in_app_enabled, telegram_enabled, sms_enabled, updated_at)
        VALUES (${tenantId}, 'GUARDIAN', NULL, ${studentAccountId}, true, false, false, now())
      `,
    );

    const pref2 = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          in_app_enabled,
          telegram_enabled,
          sms_enabled,
          telegram_chat_id,
          sms_phone
        FROM notification_preferences
        WHERE tenant_id=${tenantId} AND account_type='GUARDIAN' AND student_account_id=${studentAccountId}
        LIMIT 1
      `,
    );

    return { data: pref2[0] };
  }

  async updateGuardianPref(args: { studentAccountId: string; dto: any }) {
    // tenantId’ni ichidan topamiz
    const studentAccountId = BigInt(args.studentAccountId);

    const base = await this.prisma.$queryRaw<{ tenant_id: bigint }[]>(
      Prisma.sql`
        SELECT s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id=sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const tenantId = base[0].tenant_id;
    return this.upsertPreferenceForStudentAccount({
      tenantId: tenantId.toString(),
      studentAccountId: args.studentAccountId,
      dto: args.dto,
    });
  }

  // ---------- Send / Queue ----------
  async send(args: { tenantId: string; dto: any }) {
    const tenantId = BigInt(args.tenantId);
    const dto = args.dto || {};

    const channel = String(dto.channel || '').trim();
    const toUserId = dto.to?.userId ? BigInt(dto.to.userId) : null;
    const toStudentAccountId = dto.to?.studentAccountId
      ? BigInt(dto.to.studentAccountId)
      : null;

    if (!toUserId && !toStudentAccountId)
      throw new BadRequestException('RECIPIENT_REQUIRED');
    if (toUserId && toStudentAccountId)
      throw new BadRequestException('RECIPIENT_AMBIGUOUS');

    // resolve template if provided
    let title = dto.title ? String(dto.title) : '';
    let body = dto.body ? String(dto.body) : '';

    if (dto.templateCode) {
      const code = String(dto.templateCode).trim();
      const t = await this.prisma.$queryRaw<any[]>(
        Prisma.sql`
          SELECT title, body
          FROM notification_templates
          WHERE tenant_id=${tenantId} AND code=${code} AND channel=${channel}
          LIMIT 1
        `,
      );
      if (!t.length) throw new BadRequestException('TEMPLATE_NOT_FOUND');
      title = t[0].title;
      body = t[0].body;
    }

    if (!title.trim()) throw new BadRequestException('TITLE_REQUIRED');
    if (!body.trim()) throw new BadRequestException('BODY_REQUIRED');

    // apply vars
    title = tpl(title, dto.vars);
    body = tpl(body, dto.vars);

    // related_entity JSON string
    const relatedEntityStr = dto.relatedEntity
      ? JSON.stringify(dto.relatedEntity)
      : null;

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>(
      Prisma.sql`
        INSERT INTO notifications
          (tenant_id, channel, status, title, body, recipient_user_id, student_account_id, related_entity)
        VALUES
          (${tenantId}, ${channel}, 'QUEUED', ${title}, ${body}, ${toUserId}, ${toStudentAccountId}, ${relatedEntityStr})
        RETURNING id
      `,
    );

    return { id: rows[0].id.toString(), ok: true, status: 'QUEUED' };
  }

  // ---------- List ----------
  async listAll(args: { tenantId: string; q: any }) {
    const tenantId = BigInt(args.tenantId);
    const q = args.q || {};

    const qq = q.q ? String(q.q).trim() : null;
    const channel = q.channel ? String(q.channel).trim() : null;
    const status = q.status ? String(q.status).trim() : null;
    const from = q.from ? String(q.from) : null;
    const to = q.to ? String(q.to) : null;

    const limit = Math.min(Math.max(Number(q.limit || 50), 1), 200);
    const offset = Math.max(Number(q.offset || 0), 0);

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          n.id::text AS id,
          n.channel,
          n.status,
          n.title,
          n.body,
          n.recipient_user_id::text AS recipient_user_id,
          n.student_account_id::text AS student_account_id,
          n.related_entity,
          n.created_at,
          n.sent_at
        FROM notifications n
        WHERE n.tenant_id=${tenantId}
          ${channel ? Prisma.sql`AND n.channel=${channel}` : Prisma.empty}
          ${status ? Prisma.sql`AND n.status=${status}` : Prisma.empty}
          ${from ? Prisma.sql`AND n.created_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND n.created_at <= ${to}::timestamptz` : Prisma.empty}
          ${
            qq
              ? Prisma.sql`AND (n.title ILIKE ${'%' + qq + '%'} OR n.body ILIKE ${'%' + qq + '%'})`
              : Prisma.empty
          }
        ORDER BY n.id DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
    );

    return { data: rows, meta: { limit, offset } };
  }

  async listGuardian(args: {
    studentAccountId: string;
    from?: string;
    to?: string;
    status?: string;
    channel?: string;
  }) {
    const studentAccountId = BigInt(args.studentAccountId);

    const base = await this.prisma.$queryRaw<{ tenant_id: bigint }[]>(
      Prisma.sql`
        SELECT s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id=sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const tenantId = base[0].tenant_id;

    const from = args.from ? String(args.from) : null;
    const to = args.to ? String(args.to) : null;
    const status = args.status ? String(args.status) : null;
    const channel = args.channel ? String(args.channel) : null;

    const rows = await this.prisma.$queryRaw<any[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          channel,
          status,
          title,
          body,
          related_entity,
          created_at,
          sent_at
        FROM notifications
        WHERE tenant_id=${tenantId} AND student_account_id=${studentAccountId}
          ${channel ? Prisma.sql`AND channel=${channel}` : Prisma.empty}
          ${status ? Prisma.sql`AND status=${status}` : Prisma.empty}
          ${from ? Prisma.sql`AND created_at >= ${from}::timestamptz` : Prisma.empty}
          ${to ? Prisma.sql`AND created_at <= ${to}::timestamptz` : Prisma.empty}
        ORDER BY id DESC
        LIMIT 200
      `,
    );

    return { data: rows };
  }

  // ---------- Status updates ----------
  async markSent(args: { tenantId: string; id: string }) {
    const tenantId = BigInt(args.tenantId);
    const id = BigInt(args.id);

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE notifications SET status='SENT', sent_at=now() WHERE tenant_id=${tenantId} AND id=${id}`,
    );
    return { ok: true };
  }

  async markFailed(args: { tenantId: string; id: string }) {
    const tenantId = BigInt(args.tenantId);
    const id = BigInt(args.id);

    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE notifications SET status='FAILED' WHERE tenant_id=${tenantId} AND id=${id}`,
    );
    return { ok: true };
  }

  async guardianMarkRead(args: { studentAccountId: string; id: string }) {
    const studentAccountId = BigInt(args.studentAccountId);
    const id = BigInt(args.id);

    const base = await this.prisma.$queryRaw<{ tenant_id: bigint }[]>(
      Prisma.sql`
        SELECT s.tenant_id
        FROM student_accounts sa
        JOIN students s ON s.id=sa.student_id
        WHERE sa.id=${studentAccountId}
        LIMIT 1
      `,
    );
    if (!base.length) throw new BadRequestException('ACCOUNT_NOT_FOUND');

    const tenantId = base[0].tenant_id;

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE notifications
        SET status='READ'
        WHERE tenant_id=${tenantId} AND id=${id} AND student_account_id=${studentAccountId}
      `,
    );
    return { ok: true };
  }
}
