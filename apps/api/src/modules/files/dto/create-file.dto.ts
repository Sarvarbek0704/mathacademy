import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFileDto {
  @ApiProperty({
    example: 'STUDENT',
    enum: ['STUDENT', 'CERTIFICATE', 'VIOLATION', 'ANNOUNCEMENT', 'OTHER'],
  })
  @IsString()
  @IsIn(['STUDENT', 'CERTIFICATE', 'VIOLATION', 'ANNOUNCEMENT', 'OTHER'])
  ownerType!: string;

  @ApiPropertyOptional({
    example: '123',
    description:
      'Owner ID (numeric string), required if ownerType is STUDENT/CERTIFICATE/VIOLATION',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'ownerId must be numeric string' })
  ownerId?: string;

  @ApiProperty({ example: 'report.pdf', description: 'File name' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiPropertyOptional({ example: 'application/pdf', description: 'MIME type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ example: 1024000, description: 'File size in bytes' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024) // 100MB max
  sizeBytes?: number;

  @ApiProperty({
    example: '/uploads/report.pdf',
    description: 'File URL or path',
  })
  @IsString()
  @MaxLength(500)
  url!: string;
}
