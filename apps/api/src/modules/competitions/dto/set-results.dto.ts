// apps/api/src/modules/competitions/dto/set-results.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompetitionResultInput {
  @ApiProperty({
    example: '1',
    description: 'Entry ID (numeric string)',
    pattern: '^\\d+$',
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'entryId must be numeric string' })
  entryId!: string;

  @ApiProperty({ example: 1, description: 'Rank (1 = winner)', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rank!: number;

  @ApiPropertyOptional({
    example: '98.50',
    description: 'Score (optional)',
    pattern: '^\\d+(\\.\\d{1,2})?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'score must be a valid number' })
  score?: string;

  @ApiPropertyOptional({
    example: 'Gold Medal',
    description: 'Prize description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  prize?: string;
}

export class SetCompetitionResultsDto {
  @ApiProperty({
    type: [CompetitionResultInput],
    description: 'Array of results',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetitionResultInput)
  results!: CompetitionResultInput[];
}
