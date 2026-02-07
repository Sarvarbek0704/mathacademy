import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCertificateDto {
  @ApiProperty({ example: '3' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'IELTS Certificate' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: '1', description: 'subjects.id' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'British Council' })
  @IsOptional()
  @IsString()
  issuer?: string;

  @ApiPropertyOptional({ example: '7.5' })
  @IsOptional()
  @IsString()
  score?: string;

  @ApiPropertyOptional({ example: '2026-02-01', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '10', description: 'files.id' })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({ example: 'Original scan attached' })
  @IsOptional()
  @IsString()
  notes?: string;
}
