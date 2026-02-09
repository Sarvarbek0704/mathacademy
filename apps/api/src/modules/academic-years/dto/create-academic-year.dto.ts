import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: '2025-2026' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: '2025-09-01', description: 'YYYY-MM-DD' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-06-30', description: 'YYYY-MM-DD' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCurrent?: boolean;
}
