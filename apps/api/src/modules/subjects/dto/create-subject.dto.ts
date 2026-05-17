// apps/api/src/modules/subjects/dto/create-subject.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'MATH-01', description: 'Short unique code for the subject' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isCore?: boolean;

  @ApiPropertyOptional({ description: 'Track (yo\'nalish) ID this subject belongs to' })
  @IsOptional()
  @IsString()
  trackId?: string;
}
