// apps/api/src/modules/events/dto/guardian-event.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class GuardianEventQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date filter',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date filter',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
