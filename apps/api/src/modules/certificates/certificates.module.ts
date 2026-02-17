// apps/api/src/modules/certificates/certificates.module.ts
import { Module } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import {
  CertificatesController,
  OutcomesController,
  GuardianCertificatesController,
  GuardianOutcomeController,
} from './certificates.controller';

@Module({
  controllers: [
    CertificatesController,
    OutcomesController,
    GuardianCertificatesController,
    GuardianOutcomeController,
  ],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
