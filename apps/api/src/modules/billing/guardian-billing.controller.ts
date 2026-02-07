import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { BillingService } from './billing.service';

const toBigInt = (v: any) => BigInt(String(v));

@ApiTags('Guardian Billing')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/billing')
export class GuardianBillingController {
  constructor(private readonly service: BillingService) {}

  private user(req: any) {
    const u = req.user;
    if (!u) throw new UnauthorizedException('NO_ACCESS_TOKEN');
    if (u.type !== 'GUARDIAN') throw new UnauthorizedException('NOT_GUARDIAN');
    return u;
  }

  private tenantId(req: any) {
    const u = this.user(req);
    const tid = u.tenantId ?? u.tenant_id;
    if (tid === undefined || tid === null)
      throw new UnauthorizedException('NO_TENANT');
    return toBigInt(tid);
  }

  private studentAccountId(req: any) {
    const u = this.user(req);
    const sid = u.studentAccountId ?? u.student_account_id;
    if (sid === undefined || sid === null)
      throw new UnauthorizedException('NO_STUDENT_ACCOUNT_ID');
    return toBigInt(sid);
  }

  @Get('invoices')
  invoices(@Req() req: any) {
    return this.service.guardianInvoices(
      this.tenantId(req),
      this.studentAccountId(req),
    );
  }

  @Get('payments')
  payments(@Req() req: any) {
    return this.service.guardianPayments(
      this.tenantId(req),
      this.studentAccountId(req),
    );
  }
}
