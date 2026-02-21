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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';

import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';

import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { ListFilesQueryDto } from './dto/list-files.query.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { getMaxUploadBytes } from './files.storage';
import 'multer';


@ApiTags('Staff - Files')
@ApiBearerAuth('access-token')
@UseGuards(PermissionsGuard)
@Controller('staff/files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

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
  @RequirePermissions('files.write')
  @ApiOperation({ summary: 'Create a file record' })
  create(@Req() req: any, @Body() dto: CreateFileDto) {
    return this.svc.createFile({
      tenantId: this.tenantId(req),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @RequirePermissions('files.read')
  @ApiOperation({ summary: 'List files with pagination and filters' })
  list(@Req() req: any, @Query() query: ListFilesQueryDto) {
    return this.svc.listFiles({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @RequirePermissions('files.read')
  @ApiOperation({ summary: 'Get file details' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.getFile({
      tenantId: this.tenantId(req),
      fileId: id.toString(),
    });
  }

  @Patch(':id')
  @RequirePermissions('files.write')
  @ApiOperation({ summary: 'Update file metadata' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateFileDto,
  ) {
    return this.svc.updateFile({
      tenantId: this.tenantId(req),
      fileId: id.toString(),
      userId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @RequirePermissions('files.write')
  @ApiOperation({
    summary: 'Delete file record (soft delete not implemented, just delete)',
  })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.svc.deleteFile({
      tenantId: this.tenantId(req),
      fileId: id.toString(),
      userId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post('upload')
  @RequirePermissions('files.write')
  @ApiOperation({
    summary: 'Upload file (multipart/form-data) to local storage',
    description:
      'Stores file on disk (UPLOAD_DIR) and creates a DB record in files table.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ownerType: { type: 'string', example: 'STUDENT' },
        ownerId: { type: 'string', example: '123' },
        purpose: { type: 'string', example: 'STUDENT_PHOTO' },
        fileName: { type: 'string', example: 'photo.jpg' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['ownerType', 'file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: getMaxUploadBytes() },
    }),
  )
  upload(
    @Req() req: any,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadLocalFile({
      tenantId: this.tenantId(req),
      actorType: 'STAFF',
      userId: this.userId(req),
      dto,
      file,
      ipAddress: this.ip(req),
    });
  }
}
