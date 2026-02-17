// apps/api/src/modules/certificates/dto/create-certificate.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  Matches,
  MaxLength,
  MinLength,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCertificateDto {
  @ApiProperty({
    example: '123',
    description: 'Student ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 'IELTS Certificate',
    description: 'Certificate title (min 3, max 255 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Subject ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'subjectId must be numeric string' })
  subjectId?: string;

  @ApiPropertyOptional({
    example: 'British Council',
    description: 'Issuing organization (max 255 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  issuer?: string;

  @ApiPropertyOptional({
    example: '7.5',
    description: 'Score / Grade (max 50 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  score?: string;

  @ApiPropertyOptional({
    example: '2026-02-01',
    description: 'Issue date (YYYY-MM-DD)',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    example: '10',
    description: 'File ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'fileId must be numeric string' })
  fileId?: string;

  @ApiPropertyOptional({
    example: 'Original scan attached',
    description: 'Additional notes (max 1000 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
