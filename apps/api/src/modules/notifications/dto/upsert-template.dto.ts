// apps/api/src/modules/notifications/dto/upsert-template.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

export class UpsertNotificationTemplateDto {
  @ApiProperty({ example: 'EVENT_CREATED' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'IN_APP', enum: ['IN_APP', 'TELEGRAM_BOT', 'SMS'] })
  @IsString()
  @IsIn(['IN_APP', 'TELEGRAM_BOT', 'SMS'])
  channel!: string;

  @ApiProperty({ example: 'Yangi tadbir' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'Tadbir: {{name}} | Sana: {{date}}' })
  @IsString()
  @MinLength(1)
  body!: string;
}
