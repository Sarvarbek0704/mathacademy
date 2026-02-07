import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingService } from './billing.service';
import { StaffBillingController } from './staff-billing.controller';
import { GuardianBillingController } from './guardian-billing.controller';

@Module({
  imports: [PrismaModule],
  providers: [BillingService],
  controllers: [StaffBillingController, GuardianBillingController],
})
export class BillingModule {}
