import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStudentStatusDto {
  @ApiProperty({
    example: 'WITHDRAWN',
    enum: ['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'],
  })
  @IsString()
  @IsIn(['ACTIVE', 'GRADUATED', 'EXPELLED', 'WITHDRAWN'])
  status!: string;

  @ApiPropertyOptional({ example: 'Left academy', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
