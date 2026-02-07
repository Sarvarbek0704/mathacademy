import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DisplaysController } from './displays.controller';
import { DisplaysService } from './displays.service';

@Module({
  imports: [PrismaModule],
  controllers: [DisplaysController],
  providers: [DisplaysService],
})
export class DisplaysModule {}
