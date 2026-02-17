// apps/api/src/modules/competitions/dto/update-competition.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCompetitionDto } from './create-competition.dto';

export class UpdateCompetitionDto extends PartialType(CreateCompetitionDto) {}
