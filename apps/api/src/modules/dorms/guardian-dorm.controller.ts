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
import { DormsService } from './dorms.service';

@ApiTags('Guardian - Dorm')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/dorm')
export class GuardianDormController {
  constructor(private readonly svc: DormsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current dorm room for my child' })
  async myDorm(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');
    return this.svc.guardianDorm({
      studentAccountId: String(user.studentAccountId || ''),
    });
  }
}
