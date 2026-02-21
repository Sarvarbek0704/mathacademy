import { Module } from '@nestjs/common';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { GuardianFilesController } from './guardian-files.controller';

@Module({
  controllers: [FilesController, GuardianFilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
