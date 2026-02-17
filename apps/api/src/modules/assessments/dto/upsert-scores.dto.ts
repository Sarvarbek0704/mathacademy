// apps/api/src/modules/assessments/dto/upsert-scores.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScoreItem {
  @ApiProperty({
    example: '123',
    description: 'students.id (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 85.5,
    description: 'Score value',
    minimum: 0,
    maximum: 1000,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  score!: number;

  @ApiPropertyOptional({
    example: 'Good work!',
    description: 'Teacher comment (max 500 chars)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  teacherComment?: string;
}

export class UpsertAssessmentScoresDto {
  @ApiProperty({
    type: [ScoreItem],
    description: 'Array of scores (min 1, max 100 per request)',
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ScoreItem)
  scores!: ScoreItem[];
}
