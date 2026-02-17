import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({
    example: '2026-2027',
    description: 'Academic year name (unique per tenant). Example: 2026-2027',
  })
  @IsString()
  @Length(2, 50)
  name!: string;

  @ApiProperty({
    example: '2026-09-01',
    description: 'Start date (YYYY-MM-DD)',
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2027-06-01',
    description: 'End date (YYYY-MM-DD)',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'If true, this year becomes current and other years become not current',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCurrent?: boolean;
}
