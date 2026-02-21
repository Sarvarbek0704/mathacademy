import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UploadFileDto {
  @ApiProperty({
    example: 'STUDENT',
    enum: [
      'STUDENT',
      'USER',
      'GUARDIAN',
      'CERTIFICATE',
      'VIOLATION',
      'ANNOUNCEMENT',
      'EVENT',
      'COMPETITION',
      'AWARD',
      'DISPLAY_ITEM',
      'OTHER',
    ],
  })
  @IsString()
  @IsIn([
    'STUDENT',
    'USER',
    'GUARDIAN',
    'CERTIFICATE',
    'VIOLATION',
    'ANNOUNCEMENT',
    'EVENT',
    'COMPETITION',
    'AWARD',
    'DISPLAY_ITEM',
    'OTHER',
  ])
  ownerType!: string;

  @ApiPropertyOptional({
    example: '123',
    description: 'Owner ID (numeric string). Required for most owner types.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'ownerId must be numeric string' })
  ownerId?: string;

  @ApiPropertyOptional({
    example: 'STUDENT_PHOTO',
    description: 'Purpose/tag for the file (avatar/photo/banner/evidence etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  purpose?: string;

  @ApiPropertyOptional({
    example: 'avatar.jpg',
    description: 'Original file name override (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}
