import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
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

const toBigInt = (v: any) => BigInt(String(v));

@ApiTags('Staff Billing')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard, PermissionsGuard)
@Controller('staff/billing')
export class StaffBillingController {
  constructor(private readonly service: BillingService) {}

  private user(req: any) {
    const u = req.user;
    if (!u) throw new UnauthorizedException('NO_ACCESS_TOKEN');
    if (u.type !== 'STAFF') throw new UnauthorizedException('NOT_STAFF');
    return u;
  }

  private tenantId(req: any) {
    const u = this.user(req);
    const tid = u.tenantId ?? u.tenant_id;
    if (tid === undefined || tid === null)
      throw new UnauthorizedException('NO_TENANT');
    return toBigInt(tid);
  }

  private staffUserId(req: any) {
    const u = this.user(req);
    const uid = u.userId ?? u.user_id;
    if (uid === undefined || uid === null)
      throw new UnauthorizedException('NO_USER_ID');
    return toBigInt(uid);
  }

  @RequirePermissions('billing.read')
  @Get('living-types')
  listLivingTypes(@Req() req: any, @Query() q: ListLivingTypesQueryDto) {
    return this.service.listLivingTypes(this.tenantId(req), q);
  }

  @RequirePermissions('billing.write')
  @Post('living-types/seed-defaults')
  seedDefaults(@Req() req: any, @Body() dto: SeedDefaultsDto) {
    return this.service.seedDefaultLivingTypes(
      this.tenantId(req),
      dto.force ?? false,
    );
  }

  @RequirePermissions('billing.write')
  @Post('meal/weeks')
  createMealWeek(@Req() req: any, @Body() dto: CreateMealWeekDto) {
    return this.service.createMealWeek(this.tenantId(req), dto);
  }

  @RequirePermissions('billing.write')
  @Post('meal/announcements')
  createMealAnnouncement(
    @Req() req: any,
    @Body() dto: CreateMealAnnouncementDto,
  ) {
    return this.service.createMealAnnouncement(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
    );
  }

  @RequirePermissions('billing.write')
  @Post('dorm/months')
  createDormMonth(@Req() req: any, @Body() dto: CreateDormMonthDto) {
    return this.service.createDormMonth(this.tenantId(req), dto);
  }

  @RequirePermissions('billing.write')
  @Post('dorm/announcements')
  createDormAnnouncement(
    @Req() req: any,
    @Body() dto: CreateDormAnnouncementDto,
  ) {
    return this.service.createDormAnnouncement(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
    );
  }

  @RequirePermissions('billing.read')
  @Get('invoices')
  listInvoices(@Req() req: any, @Query() q: ListInvoicesQueryDto) {
    return this.service.listInvoices(this.tenantId(req), q);
  }

  @RequirePermissions('billing.write')
  @Post('invoices')
  createCourseInvoice(@Req() req: any, @Body() dto: CreateCourseInvoiceDto) {
    return this.service.createCourseInvoice(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
    );
  }

  @RequirePermissions('billing.write')
  @Post('payments')
  createPayment(@Req() req: any, @Body() dto: CreatePaymentDto) {
    return this.service.createPayment(
      this.tenantId(req),
      this.staffUserId(req),
      dto,
    );
  }

  @RequirePermissions('billing.read')
  @Get('payments')
  listPayments(@Req() req: any, @Query() q: ListPaymentsQueryDto) {
    return this.service.listPayments(this.tenantId(req), q);
  }
}
