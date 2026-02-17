// apps/api/src/modules/competitions/dto/competition-list.query.dto.ts
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
  MaxLength,
} from 'class-validator';

export class CompetitionListQueryDto {
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

  @ApiPropertyOptional({
    example: 'Math',
    description: 'Search by title/rules',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'],
    description: 'Filter by mode',
  })
  @IsOptional()
  @IsIn(['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'])
  mode?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 200,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'startsAt',
    enum: ['startsAt', 'createdAt', 'title'],
    description: 'Sort field',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startsAt';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
