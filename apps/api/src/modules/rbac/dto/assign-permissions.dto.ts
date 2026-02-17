import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize, Matches } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    example: ['students.read', 'students.write'],
    description: 'Array of permission codes',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionCodes!: string[];
}
