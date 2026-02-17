import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class AttendanceMarkItem {
  @ApiProperty({
    example: '123',
    description: 'students.id (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'PRESENT',
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
    description: 'Attendance status',
  })
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status!: string;

  @ApiPropertyOptional({
    example: 'Came 10 minutes late',
    description: 'Additional note (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class UpsertAttendanceMarksDto {
  @ApiProperty({
    type: [AttendanceMarkItem],
    description: 'Array of attendance marks (min 1, max 100)',
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceMarkItem)
  marks!: AttendanceMarkItem[];
}
