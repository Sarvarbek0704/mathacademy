import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RankingService } from './ranking.service';
import {
  RankingController,
  GuardianRankingController,
} from './ranking.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RankingController, GuardianRankingController],
  providers: [RankingService],
})
export class RankingModule {}
