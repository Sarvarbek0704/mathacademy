import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: '10-B' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(11)
  grade?: number;

  @ApiPropertyOptional({ example: '2', description: 'academic_years.id' })
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2', description: 'campuses.id' })
  @IsOptional()
  @IsString()
  campusId?: string;

  @ApiPropertyOptional({ example: '5', description: 'users.id (curator)' })
  @IsOptional()
  @IsString()
  curatorUserId?: string;

  @ApiPropertyOptional({ example: '3', description: 'student_tracks.id' })
  @IsOptional()
  @IsString()
  trackId?: string;
}
