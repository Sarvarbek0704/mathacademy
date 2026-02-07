import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DisciplineService } from './discipline.service';
import {
  DisciplineController,
  GuardianDisciplineController,
} from './discipline.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DisciplineController, GuardianDisciplineController],
  providers: [DisciplineService],
})
export class DisciplineModule {}
