import { IsString, MinLength } from 'class-validator';

export class StaffLoginDto {
  @IsString()
  tenantSlug!: string;

  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
