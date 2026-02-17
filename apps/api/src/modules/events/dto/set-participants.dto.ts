// apps/api/src/modules/events/dto/set-participants.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  ArrayMinSize,
  Matches,
  MaxLength,
} from 'class-validator';

export class SetParticipantsDto {
  @ApiPropertyOptional({
    example: '1',
    description:
      'Group ID (numeric string) - optional filter to restrict students from this group',
    pattern: '^\\d+$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'groupId must be numeric string' })
  groupId?: string;

  @ApiProperty({
    example: ['123', '456'],
    description: 'Array of student IDs (numeric strings)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each studentId must be numeric string',
  })
  studentIds!: string[];

  @ApiPropertyOptional({
    example: 'PARTICIPANT',
    description: 'Role in the event (max 50 chars)',
    default: 'PARTICIPANT',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string = 'PARTICIPANT';
}
