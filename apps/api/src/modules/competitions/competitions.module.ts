// apps/api/src/modules/competitions/competitions.module.ts
import { Module } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import {
  CompetitionsController,
  GuardianCompetitionsController,
} from './competitions.controller';

@Module({
  controllers: [CompetitionsController, GuardianCompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
