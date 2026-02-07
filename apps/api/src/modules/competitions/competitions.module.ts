import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompetitionsService } from './competitions.service';
import {
  CompetitionsController,
  GuardianCompetitionsController,
} from './competitions.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CompetitionsController, GuardianCompetitionsController],
  providers: [CompetitionsService],
})
export class CompetitionsModule {}
