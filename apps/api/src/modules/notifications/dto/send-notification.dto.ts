import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ example: 'IN_APP', enum: ['IN_APP', 'TELEGRAM_BOT', 'SMS'] })
  @IsString()
  @IsIn(['IN_APP', 'TELEGRAM_BOT', 'SMS'])
  channel!: string;

  @ApiPropertyOptional({ example: 'EVENT_CREATED' })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiPropertyOptional({ example: 'Manual title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Manual body' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ example: { userId: '1' } })
  @IsOptional()
  @IsObject()
  to?: { userId?: string; studentAccountId?: string };

  @ApiPropertyOptional({ example: { name: 'Math Battle', date: '2026-02-12' } })
  @IsOptional()
  @IsObject()
  vars?: Record<string, any>;

  @ApiPropertyOptional({ example: { entityType: 'events', entityId: '5' } })
  @IsOptional()
  @IsObject()
  relatedEntity?: Record<string, any>;
}
