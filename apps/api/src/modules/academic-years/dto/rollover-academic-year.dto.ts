import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class RolloverAcademicYearDto {
  @ApiProperty({ example: '2027-2028' })
  @IsString()
  @Length(2, 50)
  name!: string;

  @ApiProperty({ example: '2027-09-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2028-06-01' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'If true, clones groups structure from source academic year (without students).',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cloneGroups?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, new year becomes current year.',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  makeCurrent?: boolean;
}
