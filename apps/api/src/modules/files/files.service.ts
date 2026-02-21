import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogger } from '../../common/utils/audit.util';
import { rethrowServiceError } from '../../common/utils/service-error.util';

import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { ListFilesQueryDto } from './dto/list-files.query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { saveLocalFile, safeDeleteLocalFile } from './files.storage';
import 'multer';

function toBigInt(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s) || s === '0')
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return BigInt(s);
}

@Injectable()
export class FilesService {
  private readonly auditLogger: AuditLogger;

  constructor(private readonly prisma: PrismaService) {
    this.auditLogger = new AuditLogger(prisma);
  }

  private async assertOwnerExists(args: {
    tenant_id: bigint;
    ownerType: string;
    owner_id: bigint;
  }) {
    const { tenant_id, ownerType, owner_id } = args;
    switch (ownerType) {
      case 'STUDENT': {
        const s = await this.prisma.students.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!s) throw new NotFoundException('STUDENT_NOT_FOUND');
        return;
      }
      case 'CERTIFICATE': {
        const c = await this.prisma.certificates.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!c) throw new NotFoundException('CERTIFICATE_NOT_FOUND');
        return;
      }
      case 'VIOLATION': {
        const v = await this.prisma.violations.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!v) throw new NotFoundException('VIOLATION_NOT_FOUND');
        return;
      }
      case 'ANNOUNCEMENT': {
        const a = await this.prisma.announcements.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!a) throw new NotFoundException('ANNOUNCEMENT_NOT_FOUND');
        return;
      }
      case 'EVENT': {
        const e = await this.prisma.events.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
        return;
      }
      case 'COMPETITION': {
        const c = await this.prisma.competitions.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!c) throw new NotFoundException('COMPETITION_NOT_FOUND');
        return;
      }
      case 'AWARD': {
        const a = await this.prisma.awards.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!a) throw new NotFoundException('AWARD_NOT_FOUND');
        return;
      }
      case 'DISPLAY_ITEM': {
        const p = await this.prisma.display_playlists.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!p) throw new NotFoundException('DISPLAY_PLAYLIST_NOT_FOUND');
        return;
      }

      case 'USER': {
        const u = await this.prisma.users.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!u) throw new NotFoundException('USER_NOT_FOUND');
        return;
      }
      case 'GUARDIAN': {
        const g = await this.prisma.student_accounts.findFirst({
          where: { id: owner_id, tenant_id },
          select: { id: true },
        });
        if (!g) throw new NotFoundException('GUARDIAN_NOT_FOUND');
        return;
      }
      default:
        return; // OTHER
    }
  }

  async createFile(args: {
    tenantId: string;
    userId: string;
    dto: CreateFileDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const uploaded_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      let owner_id: bigint | null = null;
      if (args.dto.ownerId) {
        owner_id = toBigInt(args.dto.ownerId, 'ownerId');
        await this.assertOwnerExists({
          tenant_id,
          ownerType: args.dto.ownerType,
          owner_id,
        });
      }

      const file = await this.prisma.files.create({
        data: {
          tenant_id,
          owner_type: args.dto.ownerType,
          owner_id,
          purpose: args.dto.purpose,
          file_name: args.dto.fileName,
          mime_type: args.dto.mimeType,
          size_bytes: args.dto.sizeBytes,
          url: args.dto.url,
          storage_provider: args.dto.url?.startsWith('/uploads/')
            ? 'LOCAL'
            : 'EXTERNAL',
          storage_path: null,
          uploaded_by_user_id,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: uploaded_by_user_id,
        action: 'CREATE',
        entityType: 'files',
        entityId: file.id,
        afterData: {
          id: file.id.toString(),
          fileName: file.file_name,
          ownerType: file.owner_type,
          ownerId: file.owner_id?.toString(),
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: file.id.toString(),
        fileName: file.file_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes ? Number(file.size_bytes) : null,
        url: file.url,
        ownerType: file.owner_type,
        ownerId: file.owner_id?.toString(),
        purpose: file.purpose,
        storageProvider: file.storage_provider,
        uploadedBy: args.userId,
        createdAt: file.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async listFiles(args: { tenantId: string; query: ListFilesQueryDto }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const page = args.query.page ?? 1;
      const limit = Math.min(args.query.limit ?? 20, 200);
      const skip = (page - 1) * limit;

      const where: Prisma.filesWhereInput = { tenant_id };

      if (args.query.ownerType) {
        where.owner_type = args.query.ownerType;
      }
      if (args.query.ownerId) {
        where.owner_id = toBigInt(args.query.ownerId, 'ownerId');
      }
      if (args.query.q) {
        where.file_name = { contains: args.query.q, mode: 'insensitive' };
      }
      if (args.query.purpose) {
        (where as any).purpose = args.query.purpose;
      }

      const orderBy: Prisma.filesOrderByWithRelationInput = {};
      if (args.query.sortBy === 'fileName') {
        orderBy.file_name = args.query.sortDir ?? 'desc';
      } else {
        (orderBy as any).created_at = args.query.sortDir ?? 'desc';
      }

      const [total, items] = await this.prisma.$transaction([
        this.prisma.files.count({ where }),
        this.prisma.files.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            users: { select: { full_name: true } },
          },
        }),
      ]);

      return {
        data: items.map((f) => ({
          id: f.id.toString(),
          fileName: f.file_name,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes ? Number(f.size_bytes) : null,
          url: f.url,
          ownerType: f.owner_type,
          ownerId: f.owner_id?.toString(),
          purpose: (f as any).purpose ?? null,
          storageProvider: (f as any).storage_provider ?? null,
          uploadedBy: f.users?.full_name || null,
          createdAt: f.created_at,
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

  async getFile(args: { tenantId: string; fileId: string }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const file_id = toBigInt(args.fileId, 'fileId');

      const file = await this.prisma.files.findFirst({
        where: { id: file_id, tenant_id },
        include: {
          users: { select: { full_name: true } },
        },
      });
      if (!file) throw new NotFoundException('FILE_NOT_FOUND');

      return {
        id: file.id.toString(),
        fileName: file.file_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes ? Number(file.size_bytes) : null,
        url: file.url,
        ownerType: file.owner_type,
        ownerId: file.owner_id?.toString(),
        purpose: (file as any).purpose ?? null,
        storageProvider: (file as any).storage_provider ?? null,
        uploadedBy: file.users?.full_name || null,
        createdAt: file.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async updateFile(args: {
    tenantId: string;
    fileId: string;
    userId: string;
    dto: UpdateFileDto;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const file_id = toBigInt(args.fileId, 'fileId');
      const updated_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const file = await this.prisma.files.findFirst({
        where: { id: file_id, tenant_id },
      });
      if (!file) throw new NotFoundException('FILE_NOT_FOUND');

      // If ownerId/ownerType changes, validate new owner
      if (args.dto.ownerId || args.dto.ownerType) {
        const newOwnerType = args.dto.ownerType ?? file.owner_type;
        const newOwnerId = args.dto.ownerId
          ? toBigInt(args.dto.ownerId, 'ownerId')
          : file.owner_id;

        if (newOwnerId) {
          await this.assertOwnerExists({
            tenant_id,
            ownerType: newOwnerType,
            owner_id: newOwnerId,
          });
        }
      }

      const updateData: Prisma.filesUpdateInput = {};
      if (args.dto.ownerType) updateData.owner_type = args.dto.ownerType;
      if (args.dto.ownerId !== undefined) {
        updateData.owner_id = args.dto.ownerId
          ? toBigInt(args.dto.ownerId, 'ownerId')
          : null;
      }
      if (args.dto.fileName) updateData.file_name = args.dto.fileName;
      if (args.dto.purpose !== undefined)
        (updateData as any).purpose = args.dto.purpose;
      if (args.dto.mimeType !== undefined)
        updateData.mime_type = args.dto.mimeType;
      if (args.dto.sizeBytes !== undefined)
        updateData.size_bytes = args.dto.sizeBytes;
      if (args.dto.url) updateData.url = args.dto.url;

      const updated = await this.prisma.files.update({
        where: { id: file_id },
        data: updateData,
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: updated_by_user_id,
        action: 'UPDATE',
        entityType: 'files',
        entityId: file_id,
        beforeData: { id: file.id.toString(), fileName: file.file_name },
        afterData: { id: updated.id.toString(), fileName: updated.file_name },
        ipAddress: args.ipAddress,
      });

      return {
        id: updated.id.toString(),
        fileName: updated.file_name,
        mimeType: updated.mime_type,
        sizeBytes: updated.size_bytes ? Number(updated.size_bytes) : null,
        url: updated.url,
        ownerType: updated.owner_type,
        ownerId: updated.owner_id?.toString(),
        purpose: (updated as any).purpose ?? null,
        storageProvider: (updated as any).storage_provider ?? null,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async uploadLocalFile(args: {
    tenantId: string;
    actorType: 'STAFF' | 'GUARDIAN';
    userId?: string;
    studentAccountId?: string;
    dto: UploadFileDto;
    file: Express.Multer.File;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const uploaded_by_user_id =
        args.actorType === 'STAFF' && args.userId
          ? toBigInt(args.userId, 'userId')
          : null;
      const actor_student_account_id =
        args.actorType === 'GUARDIAN' && args.studentAccountId
          ? toBigInt(args.studentAccountId, 'studentAccountId')
          : null;

      if (!args.file?.buffer) throw new BadRequestException('NO_FILE');

      const ownerIdStr = args.dto.ownerId;
      let owner_id: bigint | null = null;
      if (ownerIdStr) {
        owner_id = toBigInt(ownerIdStr, 'ownerId');
        await this.assertOwnerExists({
          tenant_id,
          ownerType: args.dto.ownerType,
          owner_id,
        });
      }

      // optional: single-avatar rule
      const purpose = args.dto.purpose?.trim() || null;
      if (
        purpose &&
        ['USER_AVATAR', 'GUARDIAN_AVATAR', 'STUDENT_PHOTO'].includes(purpose)
      ) {
        await this.prisma.files.deleteMany({
          where: {
            tenant_id,
            owner_type: args.dto.ownerType,
            owner_id,
            purpose,
          },
        });
      }

      const saved = await saveLocalFile({
        tenantId: String(tenant_id),
        ownerType: args.dto.ownerType,
        ownerId: owner_id?.toString() ?? null,
        purpose,
        originalName: args.dto.fileName || args.file.originalname,
        mimeType: args.file.mimetype,
        buffer: args.file.buffer,
      });

      const created = await this.prisma.files.create({
        data: {
          tenant_id,
          owner_type: args.dto.ownerType,
          owner_id,
          purpose,
          file_name: args.dto.fileName || args.file.originalname,
          mime_type: args.file.mimetype,
          size_bytes: BigInt(args.file.size || args.file.buffer.length),
          url: saved.url,
          storage_provider: saved.provider,
          storage_path: saved.storagePath,
          uploaded_by_user_id,
        },
      });

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: args.actorType,
        actorUserId: uploaded_by_user_id,
        actorStudentAccountId: actor_student_account_id || undefined,
        action: 'CREATE',
        entityType: 'files',
        entityId: created.id,
        afterData: {
          id: created.id.toString(),
          fileName: created.file_name,
          ownerType: created.owner_type,
          ownerId: created.owner_id?.toString(),
          purpose: created.purpose,
        },
        ipAddress: args.ipAddress,
      });

      return {
        id: created.id.toString(),
        fileName: created.file_name,
        mimeType: created.mime_type,
        sizeBytes: created.size_bytes ? Number(created.size_bytes) : null,
        url: created.url,
        ownerType: created.owner_type,
        ownerId: created.owner_id?.toString(),
        purpose: created.purpose,
        storageProvider: created.storage_provider,
        createdAt: created.created_at,
      };
    } catch (error) {
      rethrowServiceError(error);
    }
  }

  async deleteFile(args: {
    tenantId: string;
    fileId: string;
    userId: string;
    ipAddress?: string;
  }) {
    try {
      const tenant_id = toBigInt(args.tenantId, 'tenantId');
      const file_id = toBigInt(args.fileId, 'fileId');
      const deleted_by_user_id = args.userId
        ? toBigInt(args.userId, 'userId')
        : null;

      const file = await this.prisma.files.findFirst({
        where: { id: file_id, tenant_id },
      });
      if (!file) throw new NotFoundException('FILE_NOT_FOUND');

      // Check if file is referenced elsewhere (certificates, violations)
      const referencedInCert = await this.prisma.certificates.count({
        where: { file_id },
      });
      const referencedInViol = await this.prisma.violations.count({
        where: { evidence_file_id: file_id },
      });
      if (referencedInCert > 0 || referencedInViol > 0) {
        throw new BadRequestException('FILE_IS_REFERENCED');
      }

      await this.prisma.files.delete({ where: { id: file_id } });

      if (file.storage_provider === 'LOCAL') {
        await safeDeleteLocalFile(file.storage_path);
      }

      await this.auditLogger.log({
        tenantId: tenant_id,
        actorType: 'STAFF',
        actorUserId: deleted_by_user_id,
        action: 'DELETE',
        entityType: 'files',
        entityId: file_id,
        beforeData: { id: file.id.toString(), fileName: file.file_name },
        ipAddress: args.ipAddress,
      });

      return { ok: true };
    } catch (error) {
      rethrowServiceError(error);
    }
  }
}
