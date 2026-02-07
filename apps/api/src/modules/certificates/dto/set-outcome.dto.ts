import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class SetOutcomeDto {
  @ApiProperty({ example: '3' })
  @IsString()
  studentId!: string;

  @ApiProperty({
    example: 'ON_TIME_ADMITTED',
    enum: ['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'],
  })
  @IsString()
  @IsIn(['EARLY_ADMITTED', 'ON_TIME_ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'])
  outcomeStatus!: string;

  @ApiPropertyOptional({ example: 'TDIU' })
  @IsOptional()
  @IsString()
  institutionName?: string;

  @ApiPropertyOptional({ example: 'Economics' })
  @IsOptional()
  @IsString()
  facultyOrProgram?: string;

  @ApiPropertyOptional({ example: '2026-08-15', description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  decisionDate?: string;

  @ApiPropertyOptional({ example: 'Official letter' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'Accepted with scholarship' })
  @IsOptional()
  @IsString()
  notes?: string;
}
