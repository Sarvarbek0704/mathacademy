import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({ example: 'mathacademy', description: 'Tenant slug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'tenantSlug must be a slug (lowercase, digits, hyphen)',
  })
  tenantSlug!: string;

  @ApiProperty({ example: 'admin', description: 'Staff username' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'pass1234', description: 'Staff password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}
