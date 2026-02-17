import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  Matches,
  IsBoolean,
} from 'class-validator';

export class ListAssignmentsQueryDto {
  @ApiPropertyOptional({ example: '123', description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  studentId?: string;

  @ApiPropertyOptional({ example: '1', description: 'Filter by room ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  roomId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Only currently active assignments',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  currentOnly?: boolean;

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
}
