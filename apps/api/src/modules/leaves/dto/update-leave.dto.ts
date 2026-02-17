// apps/api/src/modules/leaves/dto/update-leave.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateLeaveDto } from './create-leave.dto';

export class UpdateLeaveDto extends PartialType(CreateLeaveDto) {}
