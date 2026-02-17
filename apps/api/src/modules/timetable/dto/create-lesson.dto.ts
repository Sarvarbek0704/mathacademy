import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLessonDto {
  @ApiProperty({
    example: 1,
    minimum: 1,
    maximum: 7,
    description: '1=Monday, 7=Sunday',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({ example: 1, minimum: 1, description: 'Lesson period number' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodNo!: number;

  @ApiProperty({ example: '1', description: 'Subject ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'subjectId must be numeric string' })
  subjectId!: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Teacher user ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'teacherUserId must be numeric string' })
  teacherUserId?: string;

  @ApiPropertyOptional({ example: 'Room 101' })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional({ example: '09:00', description: 'Start time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startsAt must be in HH:MM format',
  })
  startsAt?: string;

  @ApiPropertyOptional({ example: '09:45', description: 'End time (HH:MM)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endsAt must be in HH:MM format',
  })
  endsAt?: string;
}
