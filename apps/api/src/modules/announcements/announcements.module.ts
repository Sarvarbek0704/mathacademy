import { Module } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementsController,
  GuardianAnnouncementsController,
} from './announcements.controller';

@Module({
  controllers: [AnnouncementsController, GuardianAnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
