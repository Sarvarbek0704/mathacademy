import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'Test Student' })
  @IsString()
  fullName!: string;

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

  @ApiPropertyOptional({ example: 10, description: 'Asosan 10 yoki 11' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(11)
  admissionGrade?: number;

  @ApiPropertyOptional({
    example: '2026-02-07',
    description: 'YYYY-MM-DD (bo‘sh bo‘lsa bugun)',
  })
  @IsOptional()
  @IsString()
  admissionDate?: string;

  @ApiPropertyOptional({
    example: 2027,
    description: 'Bo‘sh bo‘lsa admissionGrade bo‘yicha avtomatik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  expectedGraduationYear?: number;
}
