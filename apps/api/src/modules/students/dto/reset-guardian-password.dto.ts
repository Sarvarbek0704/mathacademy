import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ResetGuardianPasswordDto {
  @ApiProperty({ example: 'pass12345', minLength: 4, maxLength: 72 })
  @IsString()
  @MinLength(4)
  @MaxLength(72)
  newPassword!: string;
}
