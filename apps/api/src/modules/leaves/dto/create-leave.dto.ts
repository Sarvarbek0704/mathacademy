// apps/api/src/modules/leaves/dto/create-leave.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateLeaveDto {
  @ApiProperty({
    example: '123',
    description: 'Student ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'Sog‘ligi yomonlashdi',
    description: 'Reason for leave (min 3, max 500 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiProperty({
    example: '2026-02-08T09:00:00+05:00',
    description: 'Start date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsDateString()
  startAt!: string;

  @ApiProperty({
    example: '2026-02-08T18:00:00+05:00',
    description: 'End date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({
    example: 'STUDENT_VERBAL',
    enum: ['STUDENT_VERBAL', 'GUARDIAN_CALL', 'OTHER'],
    description: 'Who requested the leave',
    default: 'STUDENT_VERBAL',
  })
  @IsOptional()
  @IsString()
  @IsIn(['STUDENT_VERBAL', 'GUARDIAN_CALL', 'OTHER'])
  requestedBy?: string = 'STUDENT_VERBAL';

  @ApiPropertyOptional({
    example: 'Ota-onasi olib ketadi',
    description: 'Additional notes (max 1000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
