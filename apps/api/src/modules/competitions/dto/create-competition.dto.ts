import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCompetitionDto {
  @ApiProperty({ example: 'Math Battle' })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'],
  })
  @IsString()
  @IsIn(['INDIVIDUAL', 'TEAM', 'GROUP', 'DORM'])
  mode!: string;

  @ApiProperty({ example: '2026-02-12T18:00:00+05:00' })
  @IsString()
  startsAt!: string;

  @ApiPropertyOptional({ example: '2026-02-12T20:00:00+05:00' })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({ example: 'Rules text...' })
  @IsOptional()
  @IsString()
  rules?: string;
}
