import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { AccessGuard } from '../../common/guards/access.guard';
import { FilesService } from './files.service';
import { getMaxUploadBytes } from './files.storage';
import 'multer';


@ApiTags('Guardian - Files')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/files')
export class GuardianFilesController {
  constructor(private readonly svc: FilesService) {}

  private tenantId(req: any): string {
    return String(req.user?.tenantId || '');
  }

  private studentAccountId(req: any): string {
    return String(req.user?.studentAccountId || '');
  }

  private ip(req: any): string | undefined {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || undefined;
  }

  @Get('my')
  @ApiOperation({ summary: 'List my uploaded files (guardian)' })
  listMy(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') return { data: [] };

    return this.svc.listFiles({
      tenantId: this.tenantId(req),
      query: {
        ownerType: 'GUARDIAN',
        ownerId: this.studentAccountId(req),
        page: 1,
        limit: 50,
      } as any,
    });
  }

  @Post('upload-avatar')
  @ApiOperation({
    summary: 'Upload guardian avatar (multipart/form-data)',
    description:
      'Stores avatar on disk and creates files record with ownerType=GUARDIAN, ownerId=current studentAccountId, purpose=GUARDIAN_AVATAR.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', example: 'avatar.jpg' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: getMaxUploadBytes() },
    }),
  )
  uploadAvatar(
    @Req() req: any,
    @Body() body: { fileName?: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN') return { ok: false };

    return this.svc.uploadLocalFile({
      tenantId: this.tenantId(req),
      actorType: 'GUARDIAN',
      studentAccountId: this.studentAccountId(req),
      dto: {
        ownerType: 'GUARDIAN',
        ownerId: this.studentAccountId(req),
        purpose: 'GUARDIAN_AVATAR',
        fileName: body?.fileName,
      } as any,
      file,
      ipAddress: this.ip(req),
    });
  }
}
