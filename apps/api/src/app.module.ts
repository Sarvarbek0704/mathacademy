import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { GroupsModule } from './modules/groups/groups.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { RiskModule } from './modules/risk/risk.module';
import { DisciplineModule } from './modules/discipline/discipline.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { EventsModule } from './modules/events/events.module';
import { CompetitionsModule } from './modules/competitions/competitions.module';
import { AwardsModule } from './modules/awards/awards.module';
import { DisplaysModule } from './modules/displays/displays.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),
    PrismaModule,

    AuthModule,
    StudentsModule,
    AcademicYearsModule,
    GroupsModule,
    AttendanceModule,
    AssessmentsModule,
    RankingModule,
    RiskModule,
    DisciplineModule,
    LeavesModule,
    CertificatesModule,
    EventsModule,
    CompetitionsModule,
    AwardsModule,
    DisplaysModule,
    NotificationsModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
