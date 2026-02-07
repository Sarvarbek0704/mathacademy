import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({
    example: 'QUEUED',
    enum: ['QUEUED', 'SENT', 'FAILED', 'READ'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['QUEUED', 'SENT', 'FAILED', 'READ'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  offset?: string;
}
