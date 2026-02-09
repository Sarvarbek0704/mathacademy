import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: '10-A' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 10, description: 'Odatda 10 yoki 11' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(11)
  grade!: number;

  @ApiProperty({ example: '1', description: 'academic_years.id' })
  @IsString()
  academicYearId!: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'groups.status (varchar)',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '1', description: 'campuses.id' })
  @IsOptional()
  @IsString()
  campusId?: string;

  @ApiPropertyOptional({ example: '1', description: 'users.id (curator)' })
  @IsOptional()
  @IsString()
  curatorUserId?: string;

  @ApiPropertyOptional({ example: '1', description: 'student_tracks.id' })
  @IsOptional()
  @IsString()
  trackId?: string;
}
