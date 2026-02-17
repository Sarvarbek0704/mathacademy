import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'TEACHER', description: 'Role name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;
}
