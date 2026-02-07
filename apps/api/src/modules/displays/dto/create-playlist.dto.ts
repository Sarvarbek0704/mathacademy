import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreatePlaylistDto {
  @ApiProperty({ example: 'Main Playlist' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'make this playlist default for the display',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
