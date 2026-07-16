// apps/api/src/modules/billing/guardian-billing.controller.ts
import {
  Controller,
  Get,
  NotImplementedException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { BillingService } from './billing.service';

@ApiTags('Guardian Billing')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/billing')
export class GuardianBillingController {
  constructor(private readonly service: BillingService) {}

  private getGuardianInfo(req: any): {
    tenantId: string;
    studentAccountId: string;
  } {
    const user = req.user;
    if (!user) throw new UnauthorizedException('NO_ACCESS_TOKEN');
    if (user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');

    const tenantId = user.tenantId ?? user.tenant_id;
    if (!tenantId) throw new UnauthorizedException('NO_TENANT');

    const studentAccountId = user.studentAccountId ?? user.student_account_id;
    if (!studentAccountId)
      throw new UnauthorizedException('NO_STUDENT_ACCOUNT');

    return {
      tenantId: String(tenantId),
      studentAccountId: String(studentAccountId),
    };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get my invoices' })
  @ApiResponse({ status: 200, description: 'Invoices returned successfully' })
  invoices(@Req() req: any) {
    const { tenantId, studentAccountId } = this.getGuardianInfo(req);
    return this.service.guardianInvoices(tenantId, studentAccountId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get my payments' })
  @ApiResponse({ status: 200, description: 'Payments returned successfully' })
  payments(@Req() req: any) {
    const { tenantId, studentAccountId } = this.getGuardianInfo(req);
    return this.service.guardianPayments(tenantId, studentAccountId);
  }

  /**
   * Disabled: this recorded a payment without taking one.
   *
   * No payment provider is integrated anywhere in this codebase. The handler
   * wrote a payments row from a client-supplied amount, recalculated the
   * total, and marked the invoice PAID — cascading to meal_student_charges
   * and dorm_student_charges. A guardian could therefore clear their own
   * child's balance by calling it, and the academy's books would show money
   * that was never received.
   *
   * It stays here, returning 501, rather than being deleted: the route is
   * already wired into the guardian UI, and a 501 is an honest answer where
   * a 404 would look like a routing mistake.
   *
   * Restore this only together with a real provider. docs/09-billing-and-
   * finance.md §10 covers the integration; note that Payme settles in whole
   * tiyin and Click in fractional som, so the amount must come from the
   * provider's callback and never from the request body.
   */
  @Post('invoices/:id/pay')
  @ApiOperation({
    summary: 'Disabled — online payment is not implemented',
    description:
      'Returns 501. No payment provider is integrated; the previous implementation ' +
      'marked invoices paid without receiving money. See docs/09-billing-and-finance.md.',
  })
  @ApiResponse({ status: 501, description: 'Online payment is not available' })
  payInvoice() {
    throw new NotImplementedException('ONLINE_PAYMENT_NOT_AVAILABLE');
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get billing summary' })
  @ApiResponse({ status: 200, description: 'Summary returned successfully' })
  async summary(@Req() req: any) {
    const { tenantId, studentAccountId } = this.getGuardianInfo(req);

    const [invoicesResult] = await Promise.all([
      this.service.guardianInvoices(tenantId, studentAccountId),
    ]);

    return {
      ok: true,
      summary: invoicesResult.summary,
    };
  }
}
