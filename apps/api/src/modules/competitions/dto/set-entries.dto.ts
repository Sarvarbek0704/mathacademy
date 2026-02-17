// apps/api/src/modules/competitions/dto/set-entries.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class CompetitionEntryInput {
  @ApiProperty({
    example: 'STUDENT',
    enum: ['STUDENT', 'GROUP', 'TEAM', 'DORM'],
    description: 'Entry type',
  })
  @IsString()
  @IsIn(['STUDENT', 'GROUP', 'TEAM', 'DORM'])
  entryType!: string;

  @ApiPropertyOptional({
    example: '123',
    description: 'Student ID (required for STUDENT type)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Group ID (required for GROUP type)',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiPropertyOptional({
    example: 'Team Alpha',
    description: 'Display name (required for TEAM/DORM)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameDisplay?: string;
}

export class SetCompetitionEntriesDto {
  @ApiProperty({
    type: [CompetitionEntryInput],
    description: 'Array of entries',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompetitionEntryInput)
  entries!: CompetitionEntryInput[];
}
