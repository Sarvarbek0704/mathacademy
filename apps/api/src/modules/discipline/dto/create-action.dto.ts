// apps/api/src/modules/discipline/dto/create-action.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDisciplineActionDto {
  @ApiProperty({
    example: '123',
    description: 'Student ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'WARNING',
    enum: ['WARNING', 'RESTRICTION', 'FINAL_NOTICE', 'EXPELLED'],
    description: 'Action type',
  })
  @IsString()
  @IsIn(['WARNING', 'RESTRICTION', 'FINAL_NOTICE', 'EXPELLED'])
  actionType!: string;

  @ApiProperty({
    example: 'Phone usage violation',
    description: 'Reason for action (max 1000 chars)',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional({
    example: '2026-02-07T12:05:00+05:00',
    description: 'Issue time (ISO 8601), defaults to now',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    example: '12',
    description: 'Related assessment ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'relatedAssessmentId must be numeric string' })
  relatedAssessmentId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the action is currently active',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    example: ['1', '2'],
    description: 'Violation IDs to link (numeric strings)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each violationId must be numeric string',
  })
  violationIds?: string[];
}
