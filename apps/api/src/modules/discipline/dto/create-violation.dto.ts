import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateViolationDto {
  @ApiProperty({ example: '3' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 'PHONE' })
  @IsString()
  ruleCode!: string;

  @ApiProperty({ example: 'Phone found during study hall' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ example: 'LOW', enum: ['LOW', 'MEDIUM', 'HIGH'] })
  @IsOptional()
  @IsString()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  severity?: string;

  @ApiPropertyOptional({ example: '2026-02-07T12:00:00+05:00' })
  @IsOptional()
  @IsString()
  detectedAt?: string;

  @ApiPropertyOptional({ example: '10', description: 'files.id (evidence)' })
  @IsOptional()
  @IsString()
  evidenceFileId?: string;

  @ApiPropertyOptional({ example: '5', description: 'discipline_actions.id' })
  @IsOptional()
  @IsString()
  linkedDisciplineActionId?: string;
}
