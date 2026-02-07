import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventsService } from './events.service';
import {
  EventsController,
  GuardianEventsController,
} from './events.controller';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController, GuardianEventsController],
  providers: [EventsService],
})
export class EventsModule {}
