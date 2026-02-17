// apps/api/src/modules/leaves/dto/leave-list.query.dto.ts
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

export class LeaveListQueryDto {
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

  @ApiPropertyOptional({
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Start date filter',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-02-28',
    description: 'End date filter',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

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
    example: 'createdAt',
    enum: ['createdAt', 'startAt', 'status'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
