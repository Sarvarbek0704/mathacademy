// apps/api/src/modules/displays/dto/create-playlist.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlaylistDto {
  @ApiProperty({
    example: 'Main Playlist',
    description: 'Playlist name (min 3, max 100 chars)',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Make this playlist the default for the display',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean = false;
}
