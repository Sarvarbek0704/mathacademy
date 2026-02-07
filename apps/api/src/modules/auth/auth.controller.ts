import { Body, Controller, Post, Req, Res, Get, Headers } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StaffLoginDto } from './dto/staff-login.dto';
import { GuardianLoginDto } from './dto/guardian-login.dto';
import { AuthService } from './auth.service';
import { HttpCode } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/perms.decorator';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { GuardianChangePasswordDto } from './dto/guardian-change-password.dto';
import { AccessGuard } from '../../common/guards/access.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('staff/login')
  staffLogin(
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.auth.staffLogin(dto, req, res);
  }

  @Post('guardian/login')
  guardianLogin(
    @Body() dto: GuardianLoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.auth.guardianLogin(dto, req, res);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh(@Req() req: Request, @Res() res: Response) {
    return this.auth.refresh(req, res);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    return this.auth.logout(req, res);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  me(@Req() req: any) {
    return this.auth.me(req.headers?.authorization);
  }
  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @RequireRoles('SUPERADMIN')
  @Get('only-superadmin')
  onlySuperadmin() {
    return { ok: true };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('students.read')
  @Get('perm-test')
  permTest() {
    return { ok: true };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(AccessGuard)
  @Post('guardian/change-password')
  guardianChangePassword(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: GuardianChangePasswordDto,
  ) {
    return this.auth.guardianChangePassword(req, res, dto);
  }
}
