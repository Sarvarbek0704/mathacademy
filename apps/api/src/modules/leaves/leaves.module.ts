import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeavesService } from './leaves.service';
import {
  LeavesController,
  GuardianLeavesController,
} from './leaves.controller';

@Module({
  imports: [PrismaModule],
  controllers: [LeavesController, GuardianLeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
