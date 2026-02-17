// apps/api/src/modules/displays/dto/update-display.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateDisplayDto } from './create-display.dto';

export class UpdateDisplayDto extends PartialType(CreateDisplayDto) {}
