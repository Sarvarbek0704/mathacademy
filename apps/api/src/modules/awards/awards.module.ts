// apps/api/src/modules/awards/awards.module.ts
import { Module } from '@nestjs/common';
import { AwardsService } from './awards.service';
import {
  AwardsController,
  GuardianAwardsController,
} from './awards.controller';

@Module({
  controllers: [AwardsController, GuardianAwardsController],
  providers: [AwardsService],
  exports: [AwardsService],
})
export class AwardsModule {}
