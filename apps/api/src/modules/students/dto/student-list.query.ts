// apps/api/src/modules/students/dto/student-list.query.ts
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StudentListQuery {
  @ApiPropertyOptional({
    example: 'ali',
    description: 'Search by full name, student login id, or guardian name',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by campus ID' })
  @IsOptional()
  @Type(() => String)
  campusId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by group ID' })
  @IsOptional()
  @Type(() => String)
  groupId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by cohort ID' })
  @IsOptional()
  @Type(() => String)
  cohortId?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Legacy alias for groupId (backward compatibility)',
  })
  @IsOptional()
  @Type(() => String)
  currentGroupId?: string;

  @ApiPropertyOptional({
    example: 'Physics',
    description: 'Filter by track name',
  })
  @IsOptional()
  @IsString()
  trackName?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'],
    description: 'Filter by status',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'])
  status?: string;

  @ApiPropertyOptional({
    example: 'DAY_ONLY',
    description: 'Filter by living type',
    enum: ['DAY_ONLY', 'WEEKDAYS_ONLY', 'FULL_BOARD'],
  })
  @IsOptional()
  @IsIn(['DAY_ONLY', 'WEEKDAYS_ONLY', 'FULL_BOARD'])
  livingType?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Filter by admission grade (8,9,10,11)',
    enum: [8, 9, 10, 11],
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn([8, 9, 10, 11])
  admissionGrade?: number;

  @ApiPropertyOptional({
    example: '2023',
    description: 'Filter by admission year',
  })
  @IsOptional()
  @IsString()
  admissionYear?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by guardian profile completion',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  guardianProfileCompleted?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Include archived students',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;

  // Sorting
  @ApiPropertyOptional({
    example: 'created_at',
    description: 'Sort field: id, full_name, admission_date, created_at',
    enum: ['id', 'full_name', 'admission_date', 'created_at'],
  })
  @IsOptional()
  @IsIn(['id', 'full_name', 'admission_date', 'created_at'])
  sortBy?: string;

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort direction',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  // Pagination
  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
