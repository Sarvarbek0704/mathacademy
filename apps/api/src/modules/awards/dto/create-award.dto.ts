import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateAwardDto {
  @ApiProperty({
    example: 'GIFT',
    enum: ['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'],
  })
  @IsString()
  @IsIn(['GIFT', 'STIPEND', 'CERTIFICATE', 'BADGE'])
  awardType!: string;

  @ApiProperty({ example: 'Best Student of Week' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Award description...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '150000.00' })
  @IsOptional()
  @IsString()
  valueAmount?: string;

  @ApiPropertyOptional({ example: '2026-02-07T10:00:00+05:00' })
  @IsOptional()
  @IsString()
  issuedAt?: string;
}
