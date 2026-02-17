// apps/api/src/modules/displays/dto/create-item.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateItemDto {
  @ApiProperty({
    example: 'ANNOUNCEMENT',
    enum: ['RANKING', 'EVENT', 'ANNOUNCEMENT', 'WINNERS'],
    description: 'Type of display item',
  })
  @IsIn(['RANKING', 'EVENT', 'ANNOUNCEMENT', 'WINNERS'])
  itemType!: string;

  @ApiPropertyOptional({
    example: { title: 'Bugungi TOP-10', message: 'Ali: 98.5, Vali: 97.0' },
    description: 'JSON payload (will be stringified)',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Sort order (must be unique within playlist). If omitted, auto-assigned.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  sortOrder?: number;
}
