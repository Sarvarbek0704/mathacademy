import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AwardsService } from './awards.service';
import {
  AwardsController,
  GuardianAwardsController,
} from './awards.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AwardsController, GuardianAwardsController],
  providers: [AwardsService],
})
export class AwardsModule {}
