import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class CreateTrackDto {
  @ApiProperty({ example: 'Physics', description: 'Track name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'For students interested in physics',
    description: 'Description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
