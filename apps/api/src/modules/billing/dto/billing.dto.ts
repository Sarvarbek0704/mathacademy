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
} from 'class-validator';

export class ListLivingTypesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
}

export class SeedDefaultsDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;
}

export class CreateMealWeekDto {
  @IsDateString()
  weekStart!: string; // YYYY-MM-DD

  @IsDateString()
  weekEnd!: string; // YYYY-MM-DD
}

export class CreateDormMonthDto {
  @IsDateString()
  monthStart!: string; // YYYY-MM-DD

  @IsDateString()
  monthEnd!: string; // YYYY-MM-DD
}

export class PriceItemDto {
  @IsString()
  livingTypeId!: string;

  @IsNumber()
  priceAmount!: number; // >= 0
}

export class StudentOverrideDto {
  @IsString()
  studentId!: string;

  @IsNumber()
  amount!: number; // >=0
}

export class CreateMealAnnouncementDto {
  @IsString()
  mealWeekId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string; // YYYY-MM-DD

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  prices!: PriceItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentOverrideDto)
  overrides?: StudentOverrideDto[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  generateInvoices?: boolean;
}

export class CreateDormAnnouncementDto {
  @IsString()
  dormMonthId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPublished?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceItemDto)
  prices!: PriceItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentOverrideDto)
  overrides?: StudentOverrideDto[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  generateInvoices?: boolean;
}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsIn(['COURSE', 'MEAL', 'DORM', 'OTHER'])
  type?: 'COURSE' | 'MEAL' | 'DORM' | 'OTHER';

  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'])
  status?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';

  @IsOptional()
  @IsDateString()
  from?: string; // period_start >= from

  @IsOptional()
  @IsDateString()
  to?: string; // period_end <= to

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}

export class CreateCourseInvoiceDto {
  @IsString()
  studentId!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsIn(['COURSE', 'OTHER'])
  type?: 'COURSE' | 'OTHER';
}

export class CreatePaymentDto {
  @IsString()
  invoiceId!: string;

  @IsNumber()
  paidAmount!: number;

  @IsOptional()
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'OTHER'])
  method?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsIn(['MANUAL', 'ONLINE'])
  source?: 'MANUAL' | 'ONLINE';
}

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}
