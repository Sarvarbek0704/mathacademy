import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateTimetableDto {
  @ApiProperty({ example: '1', description: 'Group ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId!: string;

  @ApiProperty({
    example: '1',
    description: 'Academic Year ID (numeric string)',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'academicYearId must be numeric string' })
  academicYearId!: string;

  @ApiProperty({
    example: 'Spring 2026 Timetable',
    description: 'Timetable name',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;
}
