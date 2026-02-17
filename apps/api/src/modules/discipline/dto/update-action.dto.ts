// apps/api/src/modules/discipline/dto/update-action.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateDisciplineActionDto } from './create-action.dto';

export class UpdateDisciplineActionDto extends PartialType(
  CreateDisciplineActionDto,
) {}
