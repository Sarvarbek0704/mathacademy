import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDormRoomDto {
  @ApiProperty({ example: '101', description: 'Room code/number' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  roomCode!: string;

  @ApiProperty({ example: 2, description: 'Capacity (min 1)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity!: number;

  @ApiPropertyOptional({
    example: 'MALE',
    description: 'Gender policy (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  genderPolicy?: string;
}
