import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDisplayDto {
  @ApiProperty({ example: 'Hall Monitor #1' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '1', description: 'campuses.id' })
  @IsOptional()
  @IsString()
  campusId?: string;

  @ApiPropertyOptional({ example: 'TV near entrance' })
  @IsOptional()
  @IsString()
  locationDesc?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
