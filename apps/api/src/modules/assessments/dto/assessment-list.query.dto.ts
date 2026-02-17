// apps/api/src/modules/assessments/dto/assessment-list.query.dto.ts
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

export class AssessmentListQueryDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'Filter by group ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({
    example: '5',
    description: 'Filter by subject ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'subjectId must be numeric string' })
  subjectId?: string;

  @ApiPropertyOptional({
    example: 'WEEKLY_TEST',
    description: 'Filter by assessment type',
    enum: ['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
  type?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

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
    example: 'held_at',
    enum: ['held_at', 'title', 'type', 'created_at'],
    description: 'Sort field',
  })
  @IsOptional()
  @IsIn(['held_at', 'title', 'type', 'created_at'])
  sortBy?: string = 'held_at';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}

export class GuardianGradesQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Filter by subject ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'subjectId must be numeric string' })
  subjectId?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    maximum: 200,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
