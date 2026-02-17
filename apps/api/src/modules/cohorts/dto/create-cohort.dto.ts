import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCohortDto {
  @ApiProperty({ example: 'Bitiruvchi-2026', description: 'Cohort label' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label!: string;

  @ApiProperty({ example: 2026, description: 'Graduation year' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear!: number;
}
