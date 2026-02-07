import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpsertNotificationTemplateDto {
  @ApiProperty({ example: 'EVENT_CREATED' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 'IN_APP', enum: ['IN_APP', 'TELEGRAM_BOT', 'SMS'] })
  @IsString()
  @IsIn(['IN_APP', 'TELEGRAM_BOT', 'SMS'])
  channel!: string;

  @ApiProperty({ example: 'Yangi tadbir' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Tadbir: {{name}} | Sana: {{date}}' })
  @IsString()
  body!: string;
}
