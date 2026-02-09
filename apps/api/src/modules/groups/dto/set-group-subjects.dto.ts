import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetGroupSubjectsDto {
  @ApiProperty({ example: ['1', '2', '3'], description: 'subjects.id[]' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  subjectIds!: string[];
}
