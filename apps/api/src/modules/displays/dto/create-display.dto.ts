// apps/api/src/modules/displays/dto/create-display.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDisplayDto {
  @ApiProperty({
    example: 'Hall Monitor #1',
    description: 'Display name (min 3, max 100 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Campus ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'campusId must be numeric string' })
  campusId?: string;

  @ApiPropertyOptional({
    example: 'TV near entrance',
    description: 'Location description (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationDesc?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Display active status',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;
}
