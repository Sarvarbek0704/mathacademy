import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StudentListQuery {
  @ApiPropertyOptional({
    example: 'ali',
    description: 'Search by full name or student login id',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: '1', description: 'groups.id' })
  @IsOptional()
  @Type(() => String)
  groupId?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: ['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'])
  status?: string;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
