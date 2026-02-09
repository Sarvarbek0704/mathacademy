import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

export class GroupListQuery {
  @ApiPropertyOptional({ example: '1', description: 'academic_years.id' })
  @IsOptional()
  @Matches(/^\d+$/)
  academicYearId?: string;

  @ApiPropertyOptional({
    example: '10',
    description: '10 yoki 11',
    enum: ['10', '11'],
  })
  @IsOptional()
  @IsIn(['10', '11'])
  grade?: string;
}
