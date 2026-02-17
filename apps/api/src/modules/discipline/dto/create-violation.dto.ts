// apps/api/src/modules/discipline/dto/create-violation.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsDateString,
} from 'class-validator';

export class CreateViolationDto {
  @ApiProperty({
    example: '123',
    description: 'Student ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'PHONE',
    description: 'Rule code (max 50 chars)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  ruleCode!: string;

  @ApiProperty({
    example: 'Phone found during study hall',
    description: 'Violation description (max 1000 chars)',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description!: string;

  @ApiPropertyOptional({
    example: 'MEDIUM',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    description: 'Severity level',
    default: 'LOW',
  })
  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  severity?: string = 'LOW';

  @ApiPropertyOptional({
    example: '2026-02-07T12:00:00+05:00',
    description: 'Detection time (ISO 8601), defaults to now',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  detectedAt?: string;

  @ApiPropertyOptional({
    example: '10',
    description: 'Evidence file ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'evidenceFileId must be numeric string' })
  evidenceFileId?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Linked discipline action ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, {
    message: 'linkedDisciplineActionId must be numeric string',
  })
  linkedDisciplineActionId?: string;
}
