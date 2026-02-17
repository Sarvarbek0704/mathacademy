// apps/api/src/modules/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { StaffBillingController } from './staff-billing.controller';
import { GuardianBillingController } from './guardian-billing.controller';

@Module({
  providers: [BillingService],
  controllers: [StaffBillingController, GuardianBillingController],
  exports: [BillingService],
})
export class BillingModule {}
