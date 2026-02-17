import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicYearsModule } from './modules/academic-years/academic-years.module';
import { TimetableModule } from './modules/timetable/timetable.module';
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
import { validateEnv } from './common/config/env.validation';
import { RbacModule } from './modules/rbac/rbac.module';
import { DormsModule } from './modules/dorms/dorms.module';
import { FilesModule } from './modules/files/files.module';
import { CampusesModule } from './modules/campuses/campuses.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TracksModule } from './modules/student-tracks/tracks.module';
import { CohortsModule } from './modules/cohorts/cohorts.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
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
    TimetableModule,
    RbacModule,
    DormsModule,
    FilesModule,
    CampusesModule,
    SubjectsModule,
    TracksModule,
    CohortsModule,
    AnnouncementsModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
