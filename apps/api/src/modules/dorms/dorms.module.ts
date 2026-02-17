import { Module } from '@nestjs/common';
import { DormsService } from './dorms.service';
import { DormsController } from './dorms.controller';
import { DormRoomsController } from './dorm-rooms.controller';
import { GuardianDormController } from './guardian-dorm.controller';
import { DormAssignmentsController } from './dorm-assignments.controller';

@Module({
  controllers: [
    DormsController,
    DormRoomsController,
    DormAssignmentsController,
    GuardianDormController,
  ],
  providers: [DormsService],
  exports: [DormsService],
})
export class DormsModule {}
