// apps/api/src/modules/ranking/dto/create-snapshot.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsDateString, Matches } from 'class-validator';

export class CreateGradeSnapshotDto {
  @ApiProperty({ example: '1', description: 'Group ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId!: string;

  @ApiProperty({ example: 'WEEK', enum: ['WEEK', 'MONTH', 'TERM'] })
  @IsString()
  @IsIn(['WEEK', 'MONTH', 'TERM'])
  periodType!: string;

  @ApiProperty({ example: '2026-02-03', description: 'YYYY-MM-DD' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-02-09', description: 'YYYY-MM-DD' })
  @IsDateString()
  periodEnd!: string;
}
