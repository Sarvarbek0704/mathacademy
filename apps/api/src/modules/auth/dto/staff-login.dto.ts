import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({
    example: 'mathacademy',
    description: 'Tenant slug (lowercase, digits, hyphen)',
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'tenantSlug must be a slug (lowercase, digits, hyphen, no consecutive hyphens)',
  })
  @Matches(/^[a-z].*/, { message: 'tenantSlug must start with a letter' })
  tenantSlug!: string;

  @ApiProperty({
    example: 'admin',
    description: 'Staff username (alphanumeric, underscore, hyphen)',
    pattern: '^[a-zA-Z0-9_-]+$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscore and hyphen',
  })
  username!: string;

  @ApiProperty({
    example: 'pass1234',
    description: 'Staff password (min 6, max 128 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    example: 'device-id-123',
    description: 'Optional device identifier for session tracking',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  deviceId?: string;
}
