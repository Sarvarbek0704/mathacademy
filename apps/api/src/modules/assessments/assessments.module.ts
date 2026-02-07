import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssessmentsService } from './assessments.service';
import {
  AssessmentsController,
  GuardianGradesController,
} from './assessments.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AssessmentsController, GuardianGradesController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
