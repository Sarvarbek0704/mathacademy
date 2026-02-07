import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LeaveDecisionDto {
  @ApiPropertyOptional({ example: 'Izoh...' })
  @IsOptional()
  @IsString()
  notes?: string;
}
