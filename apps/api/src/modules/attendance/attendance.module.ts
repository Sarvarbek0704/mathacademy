import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {
  AttendanceController,
  GuardianAttendanceController,
} from './attendance.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController, GuardianAttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
