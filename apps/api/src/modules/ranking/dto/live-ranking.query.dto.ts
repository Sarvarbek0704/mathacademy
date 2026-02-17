// apps/api/src/modules/ranking/dto/live-ranking.query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, Matches } from 'class-validator';

export class LiveRankingQueryDto {
  @ApiProperty({ example: '1', description: 'Group ID' })
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId!: string;

  @ApiProperty({
    example: '2026-02-03',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-02-09', description: 'End date (YYYY-MM-DD)' })
  @IsDateString()
  to!: string;
}
