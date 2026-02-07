import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateAttendanceSessionDto {
  @ApiProperty({ example: '2', description: 'groups.id' })
  @IsString()
  groupId!: string;

  @ApiProperty({ example: '2026-02-07', description: 'YYYY-MM-DD' })
  @IsString()
  sessionDate!: string;

  @ApiProperty({ example: 'CLASS', enum: ['CLASS', 'STUDY_HALL', 'EVENT'] })
  @IsString()
  @IsIn(['CLASS', 'STUDY_HALL', 'EVENT'])
  type!: string;
}
