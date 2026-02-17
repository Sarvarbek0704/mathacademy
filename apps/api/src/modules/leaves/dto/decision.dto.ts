// apps/api/src/modules/leaves/dto/decision.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LeaveDecisionDto {
  @ApiPropertyOptional({
    example: 'Approved by admin',
    description: 'Decision notes (max 500 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
