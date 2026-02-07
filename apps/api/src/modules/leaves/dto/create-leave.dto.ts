import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateLeaveDto {
  @ApiProperty({ example: '3', description: 'students.id' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'Sog‘ligi yomonlashdi' })
  @IsString()
  reason!: string;

  @ApiProperty({ example: '2026-02-08T09:00:00+05:00' })
  @IsString()
  startAt!: string;

  @ApiProperty({ example: '2026-02-08T18:00:00+05:00' })
  @IsString()
  endAt!: string;

  @ApiPropertyOptional({
    example: 'STUDENT_VERBAL',
    enum: ['STUDENT_VERBAL', 'GUARDIAN_CALL', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['STUDENT_VERBAL', 'GUARDIAN_CALL', 'OTHER'])
  requestedBy?: string;

  @ApiPropertyOptional({ example: 'Ota-onasi olib ketadi' })
  @IsOptional()
  @IsString()
  notes?: string;
}
