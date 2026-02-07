import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAssessmentDto {
  @ApiProperty({ example: '2', description: 'groups.id (required)' })
  @IsString()
  groupId!: string;

  @ApiProperty({ example: '1', description: 'subjects.id (required)' })
  @IsString()
  subjectId!: string;

  @ApiProperty({ example: 'Weekly Test #1' })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'WEEKLY_TEST',
    enum: ['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'],
  })
  @IsString()
  @IsIn(['WEEKLY_TEST', 'BLOCK_TEST', 'WRITTEN', 'CONTROL', 'MOCK'])
  type!: string;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @ApiProperty({
    example: '2026-02-07T10:00:00+05:00',
    description: 'ISO datetime (timestamptz)',
  })
  @IsString()
  heldAt!: string;

  @ApiPropertyOptional({ example: true, description: 'Guardian ko‘rsinmi' })
  @IsOptional()
  publishToGuardians?: boolean;
}
