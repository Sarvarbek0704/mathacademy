// apps/api/src/modules/timetable/timetable.module.ts
import { Module } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import {
  TimetableController,
  GuardianTimetableController,
} from './timetable.controller';

@Module({
  controllers: [TimetableController, GuardianTimetableController],
  providers: [TimetableService],
  exports: [TimetableService],
})
export class TimetableModule {}
