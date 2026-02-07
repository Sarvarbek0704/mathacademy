import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignGroupDto {
  @ApiProperty({ example: '2', description: 'groups.id' })
  @IsString()
  groupId!: string;
}
