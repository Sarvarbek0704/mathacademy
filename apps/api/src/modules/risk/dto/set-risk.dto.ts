// apps/api/src/modules/risk/dto/set-risk.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetRiskDto {
  @ApiProperty({ example: '123', description: 'Student ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({ example: 72, description: 'Risk score (0–100)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @ApiPropertyOptional({
    example: 'Late submissions + low test scores',
    description: 'Optional note (max 500 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
