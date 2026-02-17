import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize, Matches } from 'class-validator';

export class AssignUserRolesDto {
  @ApiProperty({
    example: ['1', '2'],
    description: 'Array of role IDs (numeric strings)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each role ID must be numeric string',
  })
  roleIds!: string[];
}
