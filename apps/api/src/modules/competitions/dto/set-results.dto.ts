import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompetitionResultInput {
  @ApiProperty({ example: '1', description: 'competition_entries.id' })
  @IsString()
  entryId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  rank!: number;

  @ApiPropertyOptional({ example: '98.50' })
  @IsOptional()
  @IsString()
  score?: string;

  @ApiPropertyOptional({ example: 'Gold medal' })
  @IsOptional()
  @IsString()
  prize?: string;
}

export class SetCompetitionResultsDto {
  @ApiProperty({ type: [CompetitionResultInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitionResultInput)
  results!: CompetitionResultInput[];
}
