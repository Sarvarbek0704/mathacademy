// apps/api/src/modules/awards/dto/create-award.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAwardDto {
  @ApiProperty({
    example: 'GIFT',
    enum: ['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'],
    description: 'Type of award',
  })
  @IsString()
  @IsIn(['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'])
  awardType!: string;

  @ApiProperty({
    example: 'Best Student of Week',
    description: 'Award title (min 3, max 255 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'Award for outstanding academic performance',
    description: 'Award description (max 1000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: '150000.00',
    description: 'Monetary value (if applicable)',
    pattern: '^\\d+(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'valueAmount must be a valid decimal',
  })
  valueAmount?: string;

  @ApiPropertyOptional({
    example: '2026-02-07T10:00:00+05:00',
    description: 'Issue date (defaults to now)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}
