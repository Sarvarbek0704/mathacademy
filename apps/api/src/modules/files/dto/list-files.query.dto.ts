import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsIn,
  Matches,
} from 'class-validator';

export class ListFilesQueryDto {
  @ApiPropertyOptional({
    enum: ['STUDENT', 'CERTIFICATE', 'VIOLATION', 'ANNOUNCEMENT', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['STUDENT', 'CERTIFICATE', 'VIOLATION', 'ANNOUNCEMENT', 'OTHER'])
  ownerType?: string;

  @ApiPropertyOptional({ example: '123', description: 'Owner ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  ownerId?: string;

  @ApiPropertyOptional({
    example: 'report',
    description: 'Search by file name',
  })
  @IsOptional()
  @IsString()
  q?: string;

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
    example: 'createdAt',
    enum: ['createdAt', 'fileName'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
