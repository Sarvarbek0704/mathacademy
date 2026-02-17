// apps/api/src/modules/assessments/assessments.module.ts
import { Module } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import {
  AssessmentsController,
  GuardianGradesController,
} from './assessments.controller';

@Module({
  controllers: [AssessmentsController, GuardianGradesController],
  providers: [AssessmentsService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
