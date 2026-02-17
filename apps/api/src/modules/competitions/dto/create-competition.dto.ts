// apps/api/src/modules/competitions/dto/create-competition.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompetitionDto {
  @ApiProperty({
    example: 'Math Battle 2026',
    description: 'Competition title (min 3, max 255 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'],
    description: 'Competition mode',
  })
  @IsString()
  @IsIn(['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'])
  mode!: string;

  @ApiProperty({
    example: '2026-02-12T18:00:00+05:00',
    description: 'Start date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2026-02-12T20:00:00+05:00',
    description: 'End date/time (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 'Each participant solves 5 problems. Top 3 advance.',
    description: 'Competition rules (max 2000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rules?: string;
}
