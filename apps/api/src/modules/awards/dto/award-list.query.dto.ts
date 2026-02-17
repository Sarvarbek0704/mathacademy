// apps/api/src/modules/awards/dto/award-list.query.dto.ts
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

export class AwardListQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: 'student',
    description: 'Search by title/description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: 'GIFT',
    enum: ['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'],
    description: 'Filter by award type',
  })
  @IsOptional()
  @IsString()
  @IsIn(['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'])
  awardType?: string;

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
}
