import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GuardianLoginDto {
  @ApiProperty({
    example: 'mathacademy-000123',
    description: 'StudentID format: <tenantSlug>-<studentLoginId>',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  @Matches(/^\S+-\d+$/, { message: 'studentId must be like tenantSlug-000123' })
  studentId!: string;

  @ApiProperty({ example: 'pass1234', description: 'Guardian password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}
