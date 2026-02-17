// apps/api/src/modules/academic-years/dto/academic-year-stats.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AcademicYearStatsQuery {
  @ApiPropertyOptional({
    example: '5',
    description: 'Limit last N years by start_date desc (optional)',
  })
  @IsOptional()
  @IsString()
  last?: string;
}
