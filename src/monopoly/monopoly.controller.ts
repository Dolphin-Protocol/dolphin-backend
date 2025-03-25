import { Controller, Get } from '@nestjs/common';
import { RoomService } from './room.service';

@Controller('monopoly')
export class MonopolyController {
  constructor(private readonly roomService: RoomService) {}

  @Get('rooms')
  async getRooms() {
    return this.roomService.getRooms();
  }
}
