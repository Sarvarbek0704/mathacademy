// apps/api/src/modules/billing/dto/billing.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  Max,
  IsInt,
  ArrayMinSize,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class ListLivingTypesQueryDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class SeedDefaultsDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Force reset all living types',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;
}

export class CreateMealWeekDto {
  @ApiProperty({
    example: '2026-02-01',
    description: 'Week start date (YYYY-MM-DD)',
  })
  @IsDateString()
  weekStart!: string;

  @ApiProperty({
    example: '2026-02-07',
    description: 'Week end date (YYYY-MM-DD)',
  })
  @IsDateString()
  weekEnd!: string;
}

export class CreateDormMonthDto {
  @ApiProperty({
    example: '2026-02-01',
    description: 'Month start date (YYYY-MM-DD)',
  })
  @IsDateString()
  monthStart!: string;

  @ApiProperty({
    example: '2026-02-28',
    description: 'Month end date (YYYY-MM-DD)',
  })
  @IsDateString()
  monthEnd!: string;
}

export class PriceItemDto {
  @ApiProperty({ example: '1', description: 'Living type ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'livingTypeId must be numeric string' })
  livingTypeId!: string;

  @ApiProperty({
    example: 50000,
    description: 'Price amount (>= 0)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceAmount!: number;
}

export class StudentOverrideDto {
  @ApiProperty({ example: '123', description: 'Student ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 45000,
    description: 'Custom amount (>= 0)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateMealAnnouncementDto {
  @ApiProperty({ example: '1', description: 'Meal week ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'mealWeekId must be numeric string' })
  mealWeekId!: string;

  @ApiProperty({
    example: 'Weekly Meal Payment - Week 6',
    description: 'Announcement title',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'Please pay for next week meals',
    description: 'Additional message',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    example: '2026-02-10',
    description: 'Payment due date',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Publish immediately',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ type: [PriceItemDto], description: 'Price by living type' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  prices!: PriceItemDto[];

  @ApiPropertyOptional({
    type: [StudentOverrideDto],
    description: 'Student-specific overrides',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentOverrideDto)
  overrides?: StudentOverrideDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Auto-generate invoices',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  generateInvoices?: boolean;
}

export class CreateDormAnnouncementDto {
  @ApiProperty({ example: '1', description: 'Dorm month ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'dormMonthId must be numeric string' })
  dormMonthId!: string;

  @ApiProperty({
    example: 'February Dormitory Payment',
    description: 'Announcement title',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    example: 'Monthly dormitory fee',
    description: 'Additional message',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    example: '2026-02-25',
    description: 'Payment due date',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Publish immediately',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ type: [PriceItemDto], description: 'Price by living type' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  prices!: PriceItemDto[];

  @ApiPropertyOptional({
    type: [StudentOverrideDto],
    description: 'Student-specific overrides',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentOverrideDto)
  overrides?: StudentOverrideDto[];

  @ApiPropertyOptional({
    example: true,
    description: 'Auto-generate invoices',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  generateInvoices?: boolean;
}

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ example: '123', description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({
    example: 'MEAL',
    enum: ['COURSE', 'MEAL', 'DORM', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['COURSE', 'MEAL', 'DORM', 'OTHER'])
  type?: 'COURSE' | 'MEAL' | 'DORM' | 'OTHER';

  @ApiPropertyOptional({
    example: 'PENDING',
    enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'])
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 1000,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;
}

export class CreateCourseInvoiceDto {
  @ApiProperty({ example: '123', description: 'Student ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId!: string;

  @ApiProperty({
    example: 500000,
    description: 'Invoice amount (>= 0)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    example: '2026-02-28',
    description: 'Payment due date',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: '2026-02-01', description: 'Period start' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-02-28', description: 'Period end' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({
    example: 'COURSE',
    enum: ['COURSE', 'OTHER'],
    default: 'COURSE',
  })
  @IsOptional()
  @IsIn(['COURSE', 'OTHER'])
  type?: 'COURSE' | 'OTHER';

  @ApiPropertyOptional({
    example: 'Tuition fee for February',
    description: 'Description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreatePaymentDto {
  @ApiProperty({ example: '456', description: 'Invoice ID (numeric string)' })
  @IsString()
  @Matches(/^\d+$/, { message: 'invoiceId must be numeric string' })
  invoiceId!: string;

  @ApiProperty({
    example: 500000,
    description: 'Paid amount (>= 0)',
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @ApiPropertyOptional({
    example: 'CASH',
    enum: ['CASH', 'CARD', 'TRANSFER', 'OTHER'],
    default: 'CASH',
  })
  @IsOptional()
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  method?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

  @ApiPropertyOptional({
    example: 'TRX123456',
    description: 'Reference number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @ApiPropertyOptional({
    example: 'MANUAL',
    enum: ['MANUAL', 'ONLINE'],
    default: 'MANUAL',
  })
  @IsOptional()
  @IsIn(['MANUAL', 'ONLINE'])
  source?: 'MANUAL' | 'ONLINE';
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ example: '456', description: 'Filter by invoice ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'invoiceId must be numeric string' })
  invoiceId?: string;

  @ApiPropertyOptional({ example: '123', description: 'Filter by student ID' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'studentId must be numeric string' })
  studentId?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 1000,
    description: 'Items per page',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;
}
