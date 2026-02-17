// apps/api/src/modules/discipline/discipline.module.ts
import { Module } from '@nestjs/common';
import { DisciplineService } from './discipline.service';
import {
  DisciplineController,
  GuardianDisciplineController,
} from './discipline.controller';

@Module({
  controllers: [DisciplineController, GuardianDisciplineController],
  providers: [DisciplineService],
  exports: [DisciplineService],
})
export class DisciplineModule {}
