import { IsString, MinLength } from 'class-validator';

export class GuardianChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}
