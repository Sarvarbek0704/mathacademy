import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Mathacademy', description: 'Tenant name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'mathacademy',
    description: 'Unique slug (lowercase, numbers, hyphens)',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase, numbers, and hyphens only',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'Asia/Tashkent', default: 'Asia/Tashkent' })
  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Tashkent';
}
