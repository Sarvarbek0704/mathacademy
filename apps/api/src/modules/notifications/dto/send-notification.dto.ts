// apps/api/src/modules/notifications/dto/send-notification.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class NotificationRecipientDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'Staff user ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'userId must be numeric string' })
  userId?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Guardian account ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentAccountId must be numeric string' })
  studentAccountId?: string;
}

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
  @ValidateIf((o) => !o.templateCode)
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Manual body' })
  @ValidateIf((o) => !o.templateCode)
  @IsString()
  body?: string;

  @ApiPropertyOptional({ type: NotificationRecipientDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationRecipientDto)
  to?: NotificationRecipientDto;

  @ApiPropertyOptional({ example: { name: 'Math Battle', date: '2026-02-12' } })
  @IsOptional()
  @IsObject()
  vars?: Record<string, any>;

  @ApiPropertyOptional({ example: { entityType: 'events', entityId: '5' } })
  @IsOptional()
  @IsObject()
  relatedEntity?: Record<string, any>;
}
