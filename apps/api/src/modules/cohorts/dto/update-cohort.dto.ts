import { PartialType } from '@nestjs/swagger';
import { CreateCohortDto } from './create-cohort.dto';

export class UpdateCohortDto extends PartialType(CreateCohortDto) {}
