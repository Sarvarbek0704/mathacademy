import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class GuardianChangePasswordDto {
  @ApiProperty({ example: 'oldpass123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  oldPassword!: string;

  @ApiProperty({ example: 'NewPass12345' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  newPassword!: string;
}
