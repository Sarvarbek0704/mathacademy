// apps/api/src/modules/events/dto/create-event.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateEventDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'Campus ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'campusId must be numeric string' })
  campusId?: string;

  @ApiProperty({
    example: 'Movie time',
    description: 'Event title (min 3, max 255 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'MOVIE_TIME',
    enum: ['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'],
    description: 'Event type',
    default: 'OTHER',
  })
  @IsOptional()
  @IsString()
  @IsIn(['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'])
  eventType?: string = 'OTHER';

  @ApiProperty({
    example: '2026-02-10T18:00:00+05:00',
    description: 'Start date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2026-02-10T20:00:00+05:00',
    description: 'End date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 'Friday evening event. Location: Main hall',
    description: 'Event description (max 1000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
