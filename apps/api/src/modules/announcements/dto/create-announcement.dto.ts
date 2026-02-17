import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAnnouncementDto {
  @ApiProperty({
    example: 'ALL',
    enum: ['STAFF', 'GUARDIANS', 'PUBLIC', 'DISPLAY', 'ALL'],
    description: 'Target audience',
  })
  @IsString()
  @IsIn(['STAFF', 'GUARDIANS', 'PUBLIC', 'DISPLAY', 'ALL'])
  audience!: string;

  @ApiProperty({ example: 'School Closed', description: 'Announcement title' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    example: 'School will be closed on Friday.',
    description: 'Announcement body',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Publish immediately',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean = false;

  @ApiPropertyOptional({
    example: '2026-02-20T09:00:00+05:00',
    description: 'Publish date (if scheduled)',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
