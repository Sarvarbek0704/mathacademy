import { PartialType } from '@nestjs/swagger';
import { CreateDormDto } from './create-dorm.dto';

export class UpdateDormDto extends PartialType(CreateDormDto) {}
