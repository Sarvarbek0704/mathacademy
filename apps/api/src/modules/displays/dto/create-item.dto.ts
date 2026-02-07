import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({
    example: 'ANNOUNCEMENT',
    enum: ['RANKING', 'EVENT', 'ANNOUNCEMENT', 'WINNERS'],
  })
  @IsIn(['RANKING', 'EVENT', 'ANNOUNCEMENT', 'WINNERS'])
  itemType!: string;

  @ApiPropertyOptional({
    example: { title: 'Bugungi TOP-10', text: '...' },
    description: 'Saved as JSON string into display_items.payload',
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @ApiPropertyOptional({
    example: 1,
    description: 'If not provided, auto = max+1',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}
