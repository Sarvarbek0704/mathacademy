import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'students.read',
    description: 'Permission code (unique)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  code!: string;

  @ApiPropertyOptional({
    example: 'View student list',
    description: 'Optional description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
