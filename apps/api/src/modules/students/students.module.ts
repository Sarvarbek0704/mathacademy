import { Module } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { GuardianStudentController } from './guardian-student.controller';

@Module({
  controllers: [StudentsController, GuardianStudentController],
  providers: [StudentsService],
})
export class StudentsModule {}
