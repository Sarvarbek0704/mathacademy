import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  IsDateString,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateAttendanceSessionDto {
  @ApiProperty({
    example: '1',
    description: 'groups.id (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId!: string;

  @ApiProperty({
    example: '2026-02-07',
    description: 'Session date (YYYY-MM-DD)',
    format: 'date',
  })
  @IsDateString()
  sessionDate!: string;

  @ApiProperty({
    example: 'CLASS',
    enum: ['CLASS', 'STUDY_HALL', 'EVENT'],
    description: 'Session type',
  })
  @IsString()
  @IsIn(['CLASS', 'STUDY_HALL', 'EVENT'])
  type!: string;

  @ApiPropertyOptional({
    example: 'Morning lesson',
    description: 'Additional notes (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
