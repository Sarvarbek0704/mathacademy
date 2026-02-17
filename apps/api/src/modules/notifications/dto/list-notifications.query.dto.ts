// apps/api/src/modules/notifications/dto/list-notifications.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  IsDateString,
} from 'class-validator';

export class ListNotificationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['IN_APP', 'TELEGRAM_BOT', 'SMS'] })
  @IsOptional()
  @IsString()
  @IsIn(['IN_APP', 'TELEGRAM_BOT', 'SMS'])
  channel?: string;

  @ApiPropertyOptional({ enum: ['QUEUED', 'SENT', 'FAILED', 'READ'] })
  @IsOptional()
  @IsString()
  @IsIn(['QUEUED', 'SENT', 'FAILED', 'READ'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  offset?: string;
}
