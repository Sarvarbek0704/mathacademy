import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AcademicYearAnalyticsQueryDto {
  @ApiPropertyOptional({ example: '2025-09-01', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
