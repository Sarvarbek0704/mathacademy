import { IsString, MinLength } from 'class-validator';

export class GuardianLoginDto {
  @IsString()
  studentId!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
