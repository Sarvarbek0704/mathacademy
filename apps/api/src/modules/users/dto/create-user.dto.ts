import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'teacher1', description: 'Unique username' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscore and hyphen',
  })
  username!: string;

  @ApiProperty({ example: 'Karimov Akmal', description: 'Full name' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({
    example: 'pass1234',
    description: 'If not provided, random password generated',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ example: '+998901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'teacher@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: ['2', '3'],
    description: 'Role IDs (TEACHER, ASSISTANT_TEACHER)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d+$/, {
    each: true,
    message: 'Each roleId must be numeric string',
  })
  roleIds?: string[];
}
