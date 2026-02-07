import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SetParticipantsDto {
  @ApiPropertyOptional({
    example: '2',
    description: 'groups.id (optional filter)',
  })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ example: ['3', '4'], description: 'students.id[]' })
  @IsArray()
  studentIds!: string[];

  @ApiPropertyOptional({
    example: 'PARTICIPANT',
    description: 'event_participants.role',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
