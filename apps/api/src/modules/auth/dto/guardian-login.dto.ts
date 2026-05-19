// guardian-login.dto.ts
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsDefined,
  IsAlphanumeric,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuardianLoginDto {
  @ApiProperty({
    example: 'mathacademy-000123',
    description: 'StudentID format: <tenantSlug>-<studentLoginId>',
    pattern: '^[a-z0-9-]+-\\d+$',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  @Matches(/^[a-z][a-z0-9]*-[A-Za-z0-9][A-Za-z0-9-]*$/, {
    message: 'studentId must be like mathacademy-MA-0001',
  })
  studentId!: string;

  @ApiProperty({
    example: 'pass1234',
    description: 'Guardian password (min 6, max 128 chars)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    example: 'device-id-123',
    description: 'Optional device identifier for session tracking',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
