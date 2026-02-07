import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateDisciplineActionDto {
  @ApiProperty({ example: '3' })
  @IsString()
  studentId!: string;

  @ApiProperty({
    example: 'WARNING',
    enum: ['WARNING', 'RESTRICTION', 'FINAL_NOTICE', 'EXPELLED'],
  })
  @IsString()
  @IsIn(['WARNING', 'RESTRICTION', 'FINAL_NOTICE', 'EXPELLED'])
  actionType!: string;

  @ApiProperty({ example: 'Phone usage violation' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({ example: '2026-02-07T12:05:00+05:00' })
  @IsOptional()
  @IsString()
  issuedAt?: string;

  @ApiPropertyOptional({ example: '12', description: 'assessments.id' })
  @IsOptional()
  @IsString()
  relatedAssessmentId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: ['1', '2'],
    description: 'violations.id[] to link',
  })
  @IsOptional()
  @IsArray()
  violationIds?: string[];
}
