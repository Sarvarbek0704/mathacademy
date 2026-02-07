import {
  Controller,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard } from '../../common/guards/access.guard';
import { StudentsService } from './students.service';

@ApiTags('Guardian - Student')
@ApiBearerAuth('access-token')
@UseGuards(AccessGuard)
@Controller('guardian/student')
export class GuardianStudentController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  async me(@Req() req: any) {
    const user = req.user;
    if (!user || user.type !== 'GUARDIAN')
      throw new UnauthorizedException('NOT_GUARDIAN');

    const studentAccountId = String(user.studentAccountId || '');
    if (!studentAccountId)
      throw new UnauthorizedException('NO_STUDENT_ACCOUNT');

    const data = await this.students.guardianMe({ studentAccountId });
    if (!data) throw new NotFoundException('STUDENT_NOT_FOUND');
    return data;
  }
}
