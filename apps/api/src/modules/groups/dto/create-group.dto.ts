import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: '10-A' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 10, enum: [10, 11] })
  @IsIn([10, 11] as any)
  grade!: number;

  @ApiProperty({ example: '1', description: 'academic_years.id' })
  @IsString()
  academicYearId!: string;
}
