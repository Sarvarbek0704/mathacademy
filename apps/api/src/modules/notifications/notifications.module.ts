import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  StaffNotificationsController,
  GuardianNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [StaffNotificationsController, GuardianNotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
