// apps/api/src/modules/notifications/notifications.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { UpsertNotificationTemplateDto } from './dto/upsert-template.dto';
import { ListNotificationTemplatesQueryDto } from './dto/list-templates.query.dto';
import { UpsertNotificationPreferenceDto } from './dto/upsert-preference.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

function tpl(str: string, vars?: Record<string, any>): string {
  const s = String(str || '');
  const v = vars || {};
  return s.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const val = v[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

@Injectable()
export class NotificationsService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  // ---------- Templates ----------

  async upsertTemplate(args: {
    tenantId: string;
    userId: string;
    dto: UpsertNotificationTemplateDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = args.userId ? toBigInt(args.userId, 'userId') : null;

      const template = await this.prisma.notification_templates.upsert({
        where: {
          tenant_id_code_channel: {
            tenant_id,
            code: args.dto.code,
            channel: args.dto.channel,
          },
        },
        update: {
          title: args.dto.title,
          body: args.dto.body,
        },
        create: {
          tenant_id,
          code: args.dto.code,
          channel: args.dto.channel,
          title: args.dto.title,
          body: args.dto.body,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: user_id,
        action: 'CREATE',
        entityType: 'notification_templates',
        entityId: template.id,
        afterData: {
          id: template.id.toString(),
          code: template.code,
          channel: template.channel,
          title: template.title,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: template.id.toString(),
        code: template.code,
        channel: template.channel,
        title: template.title,
        body: template.body,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listTemplates(args: {
    tenantId: string;
    query: ListNotificationTemplatesQueryDto;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const limit = args.query.limit
        ? Math.min(parseInt(args.query.limit), 200)
        : 20;
      const offset = args.query.offset ? parseInt(args.query.offset) : 0;

      const where: Prisma.notification_templatesWhereInput = {
        tenant_id,
      };

      if (args.query.channel) {
        where.channel = args.query.channel;
      }
      if (args.query.code) {
        where.code = args.query.code;
      }
      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.notification_templates.count({ where }),
        this.prisma.notification_templates.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            code: true,
            channel: true,
            title: true,
            body: true,
            created_at: true,
          },
        }),
      ]);

      return {
        data: items.map((t) => ({
          id: t.id.toString(),
          code: t.code,
          channel: t.channel,
          title: t.title,
          body: t.body,
          createdAt: t.created_at,
        })),
        meta: { limit, offset, total },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Preferences (staff) ----------

  async upsertPreferenceForUser(args: {
    tenantId: string;
    userId: string;
    dto: UpsertNotificationPreferenceDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const user_id = toBigInt(args.userId, 'userId');

      const user = await this.prisma.users.findFirst({
        where: { id: user_id, tenant_id },
      });
      if (!user) throw new NotFoundException('USER_NOT_FOUND');

      const pref = await this.prisma.notification_preferences.upsert({
        where: {
          tenant_id_account_type_user_id_student_account_id: {
            tenant_id,
            account_type: 'STAFF',
            user_id,
            student_account_id: null as any, // ✅ null workaround
          },
        },
        update: {
          in_app_enabled: args.dto.inAppEnabled,
          telegram_enabled: args.dto.telegramEnabled,
          sms_enabled: args.dto.smsEnabled,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
          updated_at: new Date(),
        },
        create: {
          tenant_id,
          account_type: 'STAFF',
          user_id,
          student_account_id: null as any,
          in_app_enabled: args.dto.inAppEnabled ?? true,
          telegram_enabled: args.dto.telegramEnabled ?? false,
          sms_enabled: args.dto.smsEnabled ?? false,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: user_id,
        action: 'UPDATE', // ✅ action qo‘shildi
        entityType: 'notification_preferences',
        entityId: pref.id,
        afterData: {
          inAppEnabled: pref.in_app_enabled,
          telegramEnabled: pref.telegram_enabled,
          smsEnabled: pref.sms_enabled,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: pref.id.toString(),
        inAppEnabled: pref.in_app_enabled,
        telegramEnabled: pref.telegram_enabled,
        smsEnabled: pref.sms_enabled,
        telegramChatId: pref.telegram_chat_id,
        smsPhone: pref.sms_phone,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async upsertPreferenceForStudentAccount(args: {
    tenantId: string;
    studentAccountId: string;
    dto: UpsertNotificationPreferenceDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findFirst({
        where: { id: student_account_id, tenant_id },
      });
      if (!account) throw new NotFoundException('STUDENT_ACCOUNT_NOT_FOUND');

      const pref = await this.prisma.notification_preferences.upsert({
        where: {
          tenant_id_account_type_user_id_student_account_id: {
            tenant_id,
            account_type: 'GUARDIAN',
            user_id: null as any, // ✅ null allowed, but TypeScript workaround
            student_account_id,
          },
        },
        update: {
          in_app_enabled: args.dto.inAppEnabled,
          telegram_enabled: args.dto.telegramEnabled,
          sms_enabled: args.dto.smsEnabled,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
          updated_at: new Date(),
        },
        create: {
          tenant_id,
          account_type: 'GUARDIAN',
          user_id: null as any,
          student_account_id,
          in_app_enabled: args.dto.inAppEnabled ?? true,
          telegram_enabled: args.dto.telegramEnabled ?? false,
          sms_enabled: args.dto.smsEnabled ?? false,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: null, // bu yerda staff userId kerak, controllerdan olinadi (keyin qo‘shamiz)
        action: 'UPDATE', // ✅ MUHIM! action qo‘shildi
        entityType: 'notification_preferences',
        entityId: pref.id,
        afterData: {
          inAppEnabled: pref.in_app_enabled,
          telegramEnabled: pref.telegram_enabled,
          smsEnabled: pref.sms_enabled,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: pref.id.toString(),
        inAppEnabled: pref.in_app_enabled,
        telegramEnabled: pref.telegram_enabled,
        smsEnabled: pref.sms_enabled,
        telegramChatId: pref.telegram_chat_id,
        smsPhone: pref.sms_phone,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Preferences (guardian self) ----------

  async getOrCreateGuardianPref(args: { studentAccountId: string }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: { students: true },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      const tenant_id = account.students.tenant_id;

      let pref = await this.prisma.notification_preferences.findUnique({
        where: {
          tenant_id_account_type_user_id_student_account_id: {
            tenant_id,
            account_type: 'GUARDIAN',
            user_id: null as any, // ✅ TypeScript workaround
            student_account_id,
          },
        },
      });

      if (!pref) {
        pref = await this.prisma.notification_preferences.create({
          data: {
            tenant_id,
            account_type: 'GUARDIAN',
            user_id: null as any, // ✅ TypeScript workaround
            student_account_id,
            in_app_enabled: true,
            telegram_enabled: false,
            sms_enabled: false,
          },
        });
      }

      return {
        id: pref.id.toString(),
        inAppEnabled: pref.in_app_enabled,
        telegramEnabled: pref.telegram_enabled,
        smsEnabled: pref.sms_enabled,
        telegramChatId: pref.telegram_chat_id,
        smsPhone: pref.sms_phone,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateGuardianPref(args: {
    studentAccountId: string;
    dto: UpsertNotificationPreferenceDto;
    ipAddress?: string;
  }) {
    // For guardian self-update, we need tenantId and actor info. But since we don't have staff userId, we can call upsertPreferenceForStudentAccount without actorUserId.
    // We'll modify upsertPreferenceForStudentAccount to accept optional actorUserId.
    // We'll implement a separate method for guardian self-update that doesn't log actor or logs with actorType GUARDIAN.
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: { students: true },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      const tenant_id = account.students.tenant_id;

      const pref = await this.prisma.notification_preferences.upsert({
        where: {
          tenant_id_account_type_user_id_student_account_id: {
            tenant_id,
            account_type: 'GUARDIAN',
            user_id: null as any,
            student_account_id,
          },
        },
        update: {
          in_app_enabled: args.dto.inAppEnabled,
          telegram_enabled: args.dto.telegramEnabled,
          sms_enabled: args.dto.smsEnabled,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
          updated_at: new Date(),
        },
        create: {
          tenant_id,
          account_type: 'GUARDIAN',
          user_id: null,
          student_account_id,
          in_app_enabled: args.dto.inAppEnabled ?? true,
          telegram_enabled: args.dto.telegramEnabled ?? false,
          sms_enabled: args.dto.smsEnabled ?? false,
          telegram_chat_id: args.dto.telegramChatId,
          sms_phone: args.dto.smsPhone,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'GUARDIAN',
        actorStudentAccountId: student_account_id,
        action: 'UPDATE',
        entityType: 'notification_preferences',
        entityId: pref.id,
        afterData: {
          inAppEnabled: pref.in_app_enabled,
          telegramEnabled: pref.telegram_enabled,
          smsEnabled: pref.sms_enabled,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: pref.id.toString(),
        inAppEnabled: pref.in_app_enabled,
        telegramEnabled: pref.telegram_enabled,
        smsEnabled: pref.sms_enabled,
        telegramChatId: pref.telegram_chat_id,
        smsPhone: pref.sms_phone,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Send / Queue ----------

  async send(args: {
    tenantId: string;
    userId?: string; // staff userId if sent by staff, otherwise guardian?
    dto: SendNotificationDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const dto = args.dto;

      // Validate recipient
      if (!dto.to || (!dto.to.userId && !dto.to.studentAccountId)) {
        throw new BadRequestException('RECIPIENT_REQUIRED');
      }
      if (dto.to.userId && dto.to.studentAccountId) {
        throw new BadRequestException('RECIPIENT_AMBIGUOUS');
      }

      let recipient_user_id: bigint | null = null;
      let recipient_student_account_id: bigint | null = null;
      if (dto.to.userId) {
        recipient_user_id = toBigInt(dto.to.userId, 'userId');
        const user = await this.prisma.users.findFirst({
          where: { id: recipient_user_id, tenant_id },
        });
        if (!user) throw new NotFoundException('USER_NOT_FOUND');
      } else {
        recipient_student_account_id = toBigInt(
          dto.to.studentAccountId,
          'studentAccountId',
        );
        const account = await this.prisma.student_accounts.findFirst({
          where: { id: recipient_student_account_id, tenant_id },
        });
        if (!account) throw new NotFoundException('STUDENT_ACCOUNT_NOT_FOUND');
      }

      // Determine title and body
      let title: string;
      let body: string;

      if (dto.templateCode) {
        const template = await this.prisma.notification_templates.findUnique({
          where: {
            tenant_id_code_channel: {
              tenant_id,
              code: dto.templateCode,
              channel: dto.channel,
            },
          },
        });
        if (!template) throw new NotFoundException('TEMPLATE_NOT_FOUND');
        title = template.title;
        body = template.body;
      } else {
        if (!dto.title || !dto.body) {
          throw new BadRequestException(
            'TITLE_AND_BODY_REQUIRED_WHEN_NO_TEMPLATE',
          );
        }
        title = dto.title;
        body = dto.body;
      }

      // Apply vars
      title = tpl(title, dto.vars);
      body = tpl(body, dto.vars);

      // Related entity JSON
      const related_entity = dto.relatedEntity
        ? JSON.stringify(dto.relatedEntity)
        : null;

      // Create notification
      const notification = await this.prisma.notifications.create({
        data: {
          tenant_id,
          channel: dto.channel,
          status: 'QUEUED',
          title,
          body,
          recipient_user_id,
          student_account_id: recipient_student_account_id,
          related_entity,
        },
      });

      // Audit log (optional)
      // We could log but maybe too noisy

      return {
        id: notification.id.toString(),
        status: notification.status,
        ok: true,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- List Notifications ----------

  async listAll(args: { tenantId: string; query: ListNotificationsQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const limit = args.query.limit
        ? Math.min(parseInt(args.query.limit), 200)
        : 20;
      const offset = args.query.offset ? parseInt(args.query.offset) : 0;

      const where: Prisma.notificationsWhereInput = {
        tenant_id,
      };

      if (args.query.channel) {
        where.channel = args.query.channel;
      }
      if (args.query.status) {
        where.status = args.query.status;
      }
      if (args.query.from || args.query.to) {
        where.created_at = {};
        if (args.query.from) {
          where.created_at.gte = new Date(args.query.from);
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          where.created_at.lte = toDate;
        }
      }
      if (args.query.q) {
        const search = args.query.q.trim();
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { body: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.notifications.count({ where }),
        this.prisma.notifications.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { id: 'desc' },
          include: {
            users: { select: { full_name: true } },
            student_accounts: {
              select: {
                student_login_id: true,
                students: { select: { full_name: true } },
              },
            },
          },
        }),
      ]);

      return {
        data: items.map((n) => ({
          id: n.id.toString(),
          channel: n.channel,
          status: n.status,
          title: n.title,
          body: n.body,
          recipient: n.users
            ? { type: 'STAFF', name: n.users.full_name }
            : n.student_accounts
              ? {
                  type: 'GUARDIAN',
                  name: n.student_accounts.students.full_name,
                }
              : null,
          relatedEntity: n.related_entity ? JSON.parse(n.related_entity) : null,
          createdAt: n.created_at,
          sentAt: n.sent_at,
        })),
        meta: { limit, offset, total },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listGuardian(args: {
    studentAccountId: string;
    query: ListNotificationsQueryDto;
  }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: { students: true },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      const tenant_id = account.students.tenant_id;

      const limit = args.query.limit
        ? Math.min(parseInt(args.query.limit), 200)
        : 20;
      const offset = args.query.offset ? parseInt(args.query.offset) : 0;

      const where: Prisma.notificationsWhereInput = {
        tenant_id,
        student_account_id,
      };

      if (args.query.channel) {
        where.channel = args.query.channel;
      }
      if (args.query.status) {
        where.status = args.query.status;
      }
      if (args.query.from || args.query.to) {
        where.created_at = {};
        if (args.query.from) {
          where.created_at.gte = new Date(args.query.from);
        }
        if (args.query.to) {
          const toDate = new Date(args.query.to);
          toDate.setHours(23, 59, 59, 999);
          where.created_at.lte = toDate;
        }
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.notifications.count({ where }),
        this.prisma.notifications.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { id: 'desc' },
          select: {
            id: true,
            channel: true,
            status: true,
            title: true,
            body: true,
            related_entity: true,
            created_at: true,
            sent_at: true,
          },
        }),
      ]);

      return {
        data: items.map((n) => ({
          id: n.id.toString(),
          channel: n.channel,
          status: n.status,
          title: n.title,
          body: n.body,
          relatedEntity: n.related_entity ? JSON.parse(n.related_entity) : null,
          createdAt: n.created_at,
          sentAt: n.sent_at,
        })),
        meta: { limit, offset, total },
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  // ---------- Status updates ----------

  async markSent(args: {
    tenantId: string;
    notificationId: string;
    userId?: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.notificationId, 'notificationId');

      const notification = await this.prisma.notifications.findFirst({
        where: { id, tenant_id },
      });
      if (!notification) throw new NotFoundException('NOTIFICATION_NOT_FOUND');
      if (notification.status !== 'QUEUED') {
        // Can mark sent only from QUEUED
      }

      await this.prisma.notifications.update({
        where: { id },
        data: { status: 'SENT', sent_at: new Date() },
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async markFailed(args: {
    tenantId: string;
    notificationId: string;
    userId?: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const id = toBigInt(args.notificationId, 'notificationId');

      const notification = await this.prisma.notifications.findFirst({
        where: { id, tenant_id },
      });
      if (!notification) throw new NotFoundException('NOTIFICATION_NOT_FOUND');

      await this.prisma.notifications.update({
        where: { id },
        data: { status: 'FAILED' },
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async guardianMarkRead(args: {
    studentAccountId: string;
    notificationId: string;
    ipAddress?: string;
  }) {
    try {
      const student_account_id = toBigInt(
        args.studentAccountId,
        'studentAccountId',
      );
      const id = toBigInt(args.notificationId, 'notificationId');

      const account = await this.prisma.student_accounts.findUnique({
        where: { id: student_account_id },
        include: { students: true },
      });
      if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
      const tenant_id = account.students.tenant_id;

      const notification = await this.prisma.notifications.findFirst({
        where: { id, tenant_id, student_account_id },
      });
      if (!notification) throw new NotFoundException('NOTIFICATION_NOT_FOUND');

      await this.prisma.notifications.update({
        where: { id },
        data: { status: 'READ' },
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
