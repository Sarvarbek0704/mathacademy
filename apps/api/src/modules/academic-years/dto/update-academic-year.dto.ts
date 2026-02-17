import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { CreateAcademicYearDto } from './create-academic-year.dto';

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Set/unset current year flag. If true, others become false.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  override isCurrent?: boolean;

  @ApiPropertyOptional({ example: '2026-09-05' })
  @IsOptional()
  @IsDateString()
  override startDate?: string;

  @ApiPropertyOptional({ example: '2027-06-10' })
  @IsOptional()
  @IsDateString()
  override endDate?: string;
}
