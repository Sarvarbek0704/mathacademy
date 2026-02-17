// apps/api/src/modules/certificates/dto/set-outcome.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetOutcomeDto {
  @ApiProperty({
    example: '123',
    description: 'Student ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'ON_TIME_ADMITTED',
    enum: ['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'],
    description: 'Outcome status',
  })
  @IsString()
  @IsIn(['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'])
  outcomeStatus!: string;

  @ApiPropertyOptional({
    example: 'TDIU',
    description: 'Institution name (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  institutionName?: string;

  @ApiPropertyOptional({
    example: 'Economics',
    description: 'Faculty/Program (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  facultyOrProgram?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description: 'Decision date (YYYY-MM-DD)',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  decisionDate?: string;

  @ApiPropertyOptional({
    example: 'Official letter',
    description: 'Source of information (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  source?: string;

  @ApiPropertyOptional({
    example: 'Accepted with scholarship',
    description: 'Additional notes (max 1000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
