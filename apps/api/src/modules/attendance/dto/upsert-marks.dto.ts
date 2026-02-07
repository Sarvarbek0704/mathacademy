import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AttendanceMarkItem {
  @ApiProperty({ example: '3', description: 'students.id' })
  @IsString()
  studentId!: string;

  @ApiProperty({
    example: 'PRESENT',
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
  })
  @IsString()
  @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  status!: string;

  @ApiProperty({ example: 'Came late', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertAttendanceMarksDto {
  @ApiProperty({ type: [AttendanceMarkItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceMarkItem)
  marks!: AttendanceMarkItem[];
}
