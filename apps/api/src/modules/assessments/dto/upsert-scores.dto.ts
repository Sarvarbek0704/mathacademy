import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScoreItem {
  @ApiProperty({ example: '3', description: 'students.id' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 78 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;
}

export class UpsertAssessmentScoresDto {
  @ApiProperty({ type: [ScoreItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScoreItem)
  scores!: ScoreItem[];
}
