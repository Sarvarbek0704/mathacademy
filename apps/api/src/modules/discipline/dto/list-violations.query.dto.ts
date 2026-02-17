// apps/api/src/modules/discipline/dto/list-violations.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
} from 'class-validator';

export class ListViolationsQueryDto {
  @ApiPropertyOptional({ example: '123', description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by group ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 'HIGH', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  severity?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'detectedAt',
    enum: ['detectedAt', 'severity', 'ruleCode'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'detectedAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
