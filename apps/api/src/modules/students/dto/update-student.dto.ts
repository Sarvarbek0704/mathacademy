import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateStudentDto {
  @ApiPropertyOptional({ example: 'Updated Name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'])
  status?: string;

  @ApiPropertyOptional({ example: '1', description: 'groups.id' })
  @IsOptional()
  @IsString()
  currentGroupId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(11)
  admissionGrade?: number;

  @ApiPropertyOptional({ example: '2026-02-07', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  admissionDate?: string;

  @ApiPropertyOptional({ example: 2027 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  expectedGraduationYear?: number;
}
