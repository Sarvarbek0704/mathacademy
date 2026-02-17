// apps/api/src/modules/displays/dto/reorder-items.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItemOrder {
  @ApiProperty({ example: 1, description: 'Current sort order' })
  @IsInt()
  @Min(1)
  oldSortOrder!: number;

  @ApiProperty({ example: 2, description: 'New sort order' })
  @IsInt()
  @Min(1)
  newSortOrder!: number;
}

export class ReorderItemsDto {
  @ApiProperty({
    type: [ItemOrder],
    description: 'Array of sort order changes',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemOrder)
  orders!: ItemOrder[];
}
