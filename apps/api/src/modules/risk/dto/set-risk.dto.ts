import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetRiskDto {
  @ApiProperty({ example: '3', description: 'students.id' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 72, description: '0..100' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @ApiPropertyOptional({
    example: 'Late + low scores',
    description: 'optional note',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
