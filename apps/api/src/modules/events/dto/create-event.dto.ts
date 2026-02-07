import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEventDto {
  @ApiPropertyOptional({ example: '1', description: 'campuses.id (optional)' })
  @IsOptional()
  @IsString()
  campusId?: string;

  @ApiProperty({ example: 'Movie time' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    example: 'MOVIE_TIME',
    enum: ['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['MOVIE_TIME', 'TOURNAMENT', 'MEETING', 'OTHER'])
  eventType?: string;

  @ApiProperty({ example: '2026-02-10T18:00:00+05:00' })
  @IsString()
  startsAt!: string;

  @ApiPropertyOptional({ example: '2026-02-10T20:00:00+05:00' })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({ example: 'Friday evening event. Location: Main hall' })
  @IsOptional()
  @IsString()
  description?: string;
}
