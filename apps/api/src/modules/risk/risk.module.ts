import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RiskService } from './risk.service';
import { RiskController, GuardianRiskController } from './risk.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RiskController, GuardianRiskController],
  providers: [RiskService],
})
export class RiskModule {}
