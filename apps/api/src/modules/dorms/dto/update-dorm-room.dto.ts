import { PartialType } from '@nestjs/swagger';
import { CreateDormRoomDto } from './create-dorm-room.dto';

export class UpdateDormRoomDto extends PartialType(CreateDormRoomDto) {}
