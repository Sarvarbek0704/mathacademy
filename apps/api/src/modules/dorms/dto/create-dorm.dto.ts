import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDormDto {
  @ApiProperty({ example: 'Boys Dorm', description: 'Dorm name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Campus ID (numeric string)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'campusId must be numeric string' })
  campusId?: string;

  @ApiPropertyOptional({
    example: 'Near the sports field',
    description: 'Description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean = true;
}
