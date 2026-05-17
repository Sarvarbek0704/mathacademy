// apps/api/src/modules/subjects/dto/update-subject.dto.ts
import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCore?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackId?: string;
}
