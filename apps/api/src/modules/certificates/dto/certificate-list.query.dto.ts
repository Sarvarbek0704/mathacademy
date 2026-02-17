// apps/api/src/modules/certificates/dto/certificate-list.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';

export class CertificateListQueryDto {
  @ApiPropertyOptional({
    example: '123',
    description: 'Filter by student ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Filter by group ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({
    example: 'IELTS',
    description: 'Search by title or issuer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 200,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'issuedAt',
    enum: ['issuedAt', 'createdAt', 'title'],
    description: 'Sort field',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'issuedAt';

  @ApiPropertyOptional({
    example: 'desc',
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  @IsOptional()
  @IsString()
  sortDir?: 'asc' | 'desc' = 'desc';
}

export class OutcomeListQueryDto {
  @ApiPropertyOptional({
    example: '123',
    description: 'Filter by student ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Filter by group ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({
    example: 'ADMITTED',
    description: 'Filter by outcome status',
  })
  @IsOptional()
  @IsString()
  outcomeStatus?: string;
}
