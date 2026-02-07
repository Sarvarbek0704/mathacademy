import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateGradeSnapshotDto {
  @ApiProperty({ example: '2' })
  @IsString()
  groupId!: string;

  @ApiProperty({ example: 'WEEK', enum: ['WEEK', 'MONTH', 'TERM'] })
  @IsString()
  @IsIn(['WEEK', 'MONTH', 'TERM'])
  periodType!: string;

  @ApiProperty({ example: '2026-02-03', description: 'YYYY-MM-DD' })
  @IsString()
  periodStart!: string;

  @ApiProperty({ example: '2026-02-09', description: 'YYYY-MM-DD' })
  @IsString()
  periodEnd!: string;
}
