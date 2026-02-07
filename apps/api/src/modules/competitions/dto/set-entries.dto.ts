import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompetitionEntryInput {
  @ApiProperty({
    example: 'STUDENT',
    enum: ['STUDENT', 'GROUP', 'TEAM', 'DORM'],
  })
  @IsString()
  @IsIn(['STUDENT', 'GROUP', 'TEAM', 'DORM'])
  entryType!: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({ example: '2' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ example: 'Team A' })
  @IsOptional()
  @IsString()
  nameDisplay?: string;
}

export class SetCompetitionEntriesDto {
  @ApiProperty({ type: [CompetitionEntryInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompetitionEntryInput)
  entries!: CompetitionEntryInput[];
}
