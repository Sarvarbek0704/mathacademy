// apps/api/src/modules/awards/dto/set-recipients.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMaxSize,
  Matches,
  ValidateIf,
} from 'class-validator';

export class SetAwardRecipientsDto {
  @ApiPropertyOptional({
    example: ['123', '456'],
    description: 'Array of student IDs (numeric strings)',
    maxItems: 500,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each studentId must be numeric string',
  })
  studentIds?: string[];

  @ApiPropertyOptional({
    example: ['1'],
    description: 'Array of group IDs (numeric strings)',
    maxItems: 50,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each groupId must be numeric string',
  })
  groupIds?: string[];

  @ApiPropertyOptional({
    example: 'Excellent performance!',
    description: 'Additional note (max 500 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
