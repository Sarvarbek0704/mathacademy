import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CertificatesService } from './certificates.service';
import {
  CertificatesController,
  OutcomesController,
  GuardianCertificatesController,
  GuardianOutcomeController,
} from './certificates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    CertificatesController,
    OutcomesController,
    GuardianCertificatesController,
    GuardianOutcomeController,
  ],
  providers: [CertificatesService],
})
export class CertificatesModule {}
