// apps/api/src/modules/discipline/dto/list-actions.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
  IsIn,
} from 'class-validator';

export class ListActionsQueryDto {
  @ApiPropertyOptional({ example: '123', description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by group ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'issuedAt',
    enum: ['issuedAt', 'actionType'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'issuedAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
