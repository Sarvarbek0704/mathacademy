// apps/api/src/modules/billing/guardian-billing.controller.ts
import {
  Controller,
  Get,
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
