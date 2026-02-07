import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SetAwardRecipientsDto {
  @ApiPropertyOptional({ example: ['3', '4'] })
  @IsOptional()
  @IsArray()
  studentIds?: string[];

  @ApiPropertyOptional({ example: ['2'] })
  @IsOptional()
  @IsArray()
  groupIds?: string[];

  @ApiPropertyOptional({ example: 'Nice job!' })
  @IsOptional()
  @IsString()
  note?: string;
}
