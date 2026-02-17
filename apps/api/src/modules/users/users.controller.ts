import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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

import { RolesGuard } from '../../common/guards/roles.guard';
import { RequireRoles } from '../../common/decorators/roles.decorator';
import { ParseBigIntPipe } from '../../common/pipes/parse-bigint.pipe';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Staff - Users')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@RequireRoles('SUPERADMIN')
@Controller('staff/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private tenantId(req: any): string {
    return String(req.user?.tenantId || '');
  }

  private userId(req: any): string {
    return String(req.user?.userId || '');
  }

  private ip(req: any): string | undefined {
    const xf = String(req.headers?.['x-forwarded-for'] || '')
      .split(',')[0]
      ?.trim();
    return xf || req.ip || req.connection?.remoteAddress || undefined;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new staff user' })
  @ApiResponse({ status: 201, description: 'User created' })
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.usersService.create({
      tenantId: this.tenantId(req),
      createdByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all staff users' })
  list(@Req() req: any, @Query() query: ListUsersQueryDto) {
    return this.usersService.list({
      tenantId: this.tenantId(req),
      query,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiParam({ name: 'id', description: 'User ID' })
  get(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.usersService.getById({
      tenantId: this.tenantId(req),
      userId: id.toString(),
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  update(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update({
      tenantId: this.tenantId(req),
      userId: id.toString(),
      updatedByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (soft delete by deactivating)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  delete(@Req() req: any, @Param('id', ParseBigIntPipe) id: bigint) {
    return this.usersService.delete({
      tenantId: this.tenantId(req),
      userId: id.toString(),
      deletedByUserId: this.userId(req),
      ipAddress: this.ip(req),
    });
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Reset user password' })
  @ApiParam({ name: 'id', description: 'User ID' })
  resetPassword(
    @Req() req: any,
    @Param('id', ParseBigIntPipe) id: bigint,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword({
      tenantId: this.tenantId(req),
      userId: id.toString(),
      updatedByUserId: this.userId(req),
      dto,
      ipAddress: this.ip(req),
    });
  }
}
