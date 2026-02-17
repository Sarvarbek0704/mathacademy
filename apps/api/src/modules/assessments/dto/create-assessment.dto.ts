// apps/api/src/modules/assessments/dto/create-assessment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({
    example: '1',
    description: 'groups.id (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId!: string;

  @ApiProperty({
    example: '5',
    description: 'subjects.id (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'subjectId must be numeric string' })
  subjectId!: string;

  @ApiProperty({
    example: 'Weekly Test #1 - Algebra',
    description: 'Assessment title (min 3, max 255 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    example: 'WEEKLY_TEST',
    enum: ['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'],
    description: 'Assessment type',
  })
  @IsString()
  @IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
  type!: string;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Weight multiplier for ranking (min 0, max 10)',
    default: 1.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10)
  weight?: number = 1.0;

  @ApiPropertyOptional({
    example: 100,
    description: 'Maximum possible score (min 1, max 1000)',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  maxScore?: number = 100;

  @ApiProperty({
    example: '2026-02-07T10:00:00+05:00',
    description: 'ISO datetime when assessment was held',
    format: 'date-time',
  })
  @IsDateString()
  heldAt!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Publish to guardian panels',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  publishToGuardians?: boolean = false;

  @ApiPropertyOptional({
    example: 'Chapter 5: Quadratic Equations',
    description: 'Additional notes or description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
