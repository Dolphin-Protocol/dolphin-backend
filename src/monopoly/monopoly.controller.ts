import { Controller, Get } from '@nestjs/common';
import { RoomService } from './room.service';
import { GameService } from './game.service';

@Controller('monopoly')
export class MonopolyController {
  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

  @Get('rooms')
  async getRooms() {
    return this.roomService.getRooms();
  }

  @Get('admin')
  async getAdmin() {
    return this.gameService.getAdminKeypair();
  }
}
