// apps/api/src/modules/discipline/dto/guardian-discipline.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class GuardianDisciplineQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
