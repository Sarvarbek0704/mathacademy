import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiPropertyOptional({
    example: 'newPass123',
    description: 'If not provided, random password generated',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}
