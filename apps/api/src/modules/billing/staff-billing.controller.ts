// apps/api/src/modules/billing/staff-billing.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';
import { BillingService } from './billing.service';
import {
  CreateCourseInvoiceDto,
  CreateDormAnnouncementDto,
  CreateDormMonthDto,
  CreateMealAnnouncementDto,
  CreateMealWeekDto,
  CreatePaymentDto,
  ListInvoicesQueryDto,
  ListLivingTypesQueryDto,
  ListPaymentsQueryDto,
  SeedDefaultsDto,
} from './dto/billing.dto';

@ApiTags('Staff Billing')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard, PermissionsGuard)
@Controller('staff/billing')
export class StaffBillingController {
  constructor(private readonly service: BillingService) {}

  private tenantId(req: any): string {
    const user = req.user;
    if (!user) throw new UnauthorizedException('NO_ACCESS_TOKEN');
    if (user.type !== 'STAFF') throw new UnauthorizedException('NOT_STAFF');

    const tid = user.tenantId ?? user.tenant_id;
    if (!tid) throw new UnauthorizedException('NO_TENANT');
    return String(tid);
  }

  private staffUserId(req: any): string {
    const user = req.user;
    const uid = user.userId ?? user.user_id;
    if (!uid) throw new UnauthorizedException('NO_USER_ID');
    return String(uid);
  }

  private ip(req: any): string | undefined {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || undefined;
  }

  // ==================== LIVING TYPES ====================

  @Get('living-types')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List living types' })
  listLivingTypes(@Req() req: any, @Query() q: ListLivingTypesQueryDto) {
    return this.service.listLivingTypes(this.tenantId(req), q);
  }

  @Post('living-types/seed-defaults')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Seed default living types' })
  seedDefaults(@Req() req: any, @Body() dto: SeedDefaultsDto) {
    return this.service.seedDefaultLivingTypes(this.tenantId(req), dto);
  }

  // ==================== MEAL BILLING ====================

  @Post('meal/weeks')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create meal week' })
  createMealWeek(@Req() req: any, @Body() dto: CreateMealWeekDto) {
    return this.service.createMealWeek(this.tenantId(req), dto);
  }

  @Get('meal/weeks')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List meal weeks' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  listMealWeeks(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listMealWeeks(
      this.tenantId(req),
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  @Post('meal/announcements')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create meal payment announcement' })
  createMealAnnouncement(
    @Req() req: any,
    @Body() dto: CreateMealAnnouncementDto,
  ) {
    return this.service.createMealAnnouncement(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
      this.ip(req),
    );
  }

  // ==================== DORM BILLING ====================

  @Post('dorm/months')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create dorm billing month' })
  createDormMonth(@Req() req: any, @Body() dto: CreateDormMonthDto) {
    return this.service.createDormMonth(this.tenantId(req), dto);
  }

  @Post('dorm/announcements')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create dorm payment announcement' })
  createDormAnnouncement(
    @Req() req: any,
    @Body() dto: CreateDormAnnouncementDto,
  ) {
    return this.service.createDormAnnouncement(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
      this.ip(req),
    );
  }

  // ==================== INVOICES ====================

  @Get('invoices')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List invoices with filters' })
  listInvoices(@Req() req: any, @Query() q: ListInvoicesQueryDto) {
    return this.service.listInvoices(this.tenantId(req), q);
  }

  @Get('invoices/:id')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  getInvoiceDetail(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.service.getInvoiceDetail(this.tenantId(req), id.toString());
  }

  @Post('invoices')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create course invoice' })
  createCourseInvoice(@Req() req: any, @Body() dto: CreateCourseInvoiceDto) {
    return this.service.createCourseInvoice(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
      this.ip(req),
    );
  }

  // ==================== PAYMENTS ====================

  @Post('payments')
  @RequirePermissions('billing.write')
  @ApiOperation({ summary: 'Create payment' })
  createPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.service.createPayment(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
      this.ip(req),
    );
  }

  @Get('payments')
  @RequirePermissions('billing.read')
  @ApiOperation({ summary: 'List payments' })
  listPayments(@Req() req: any, @Query() q: ListPaymentsQueryDto) {
    return this.service.listPayments(this.tenantId(req), q);
  }
}
