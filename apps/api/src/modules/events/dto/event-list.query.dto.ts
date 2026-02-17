// apps/api/src/modules/events/dto/event-list.query.dto.ts
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
  MaxLength,
} from 'class-validator';

export class EventListQueryDto {
  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Start date filter (startsAt >= from)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'End date filter (endsAt <= to)',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    example: 'movie',
    description: 'Search by title/description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Filter by campus ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'campusId must be numeric string' })
  campusId?: string;

  @ApiPropertyOptional({
    example: 'MOVIE_TIME',
    enum: ['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'],
    description: 'Filter by event type',
  })
  @IsOptional()
  @IsIn(['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'])
  eventType?: string;

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
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startsAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
