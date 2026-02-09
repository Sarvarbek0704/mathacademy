import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { GuardianLoginDto } from './dto/guardian-login.dto';
import { GuardianChangePasswordDto } from './dto/guardian-change-password.dto';

import { AccessGuard } from '../../common/guards/access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/perms.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/perms.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('staff/login')
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        staff: { id: '1', fullName: 'Director' },
        roles: ['SUPERADMIN'],
        permissions: ['students.read'],
      },
    },
  })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'INVALID_CREDENTIALS' } },
  })
  staffLogin(
    @Body() dto: StaffLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.staffLogin(dto, req, res);
  }

  @Post('guardian/login')
  @ApiOkResponse({
    schema: {
      example: {
        accessToken: 'jwt-access-token',
        mustChangePassword: true,
      },
    },
  })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'INVALID_CREDENTIALS' } },
  })
  guardianLogin(
    @Body() dto: GuardianLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.guardianLogin(dto, req, res);
  }

  @HttpCode(200)
  @Post('refresh')
  @ApiOkResponse({ schema: { example: { accessToken: 'new-access-token' } } })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'NO_REFRESH_TOKEN' } },
  })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @HttpCode(200)
  @Post('logout')
  @ApiOkResponse({ schema: { example: { ok: true } } })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(AccessGuard)
  @Get('me')
  @ApiOkResponse({
    schema: {
      example: { ok: true, payload: { type: 'STAFF', tenantId: '1' } },
    },
  })
  me(@Req() req: Request) {
    return this.auth.me(req);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(RolesGuard)
  @RequireRoles('SUPERADMIN')
  @Get('only-superadmin')
  @ApiForbiddenResponse({
    schema: { example: { statusCode: 403, message: 'FORBIDDEN_ROLE' } },
  })
  onlySuperadmin() {
    return { ok: true };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('students.read')
  @Get('perm-test')
  @ApiForbiddenResponse({
    schema: { example: { statusCode: 403, message: 'FORBIDDEN_PERMISSION' } },
  })
  permTest() {
    return { ok: true };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(AccessGuard)
  @Post('guardian/change-password')
  @ApiOkResponse({
    schema: {
      example: {
        ok: true,
        accessToken: 'new-access-token',
        mustChangePassword: false,
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: { statusCode: 400, message: 'NEW_PASSWORD_SAME_AS_OLD' },
    },
  })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'INVALID_OLD_PASSWORD' } },
  })
  guardianChangePassword(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: GuardianChangePasswordDto,
  ) {
    return this.auth.guardianChangePassword(req, res, dto);
  }
}
