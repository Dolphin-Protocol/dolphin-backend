import { Controller, Get, Query } from '@nestjs/common';
import { RoomService } from './room.service';
import { GameService } from './game.service';
import { SetupService } from './setup/setup.service';

@Controller('monopoly')
export class MonopolyController {
  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly setupService: SetupService,
  ) {}

  @Get('rooms')
  async getRooms() {
    return this.roomService.getRooms();
  }

  @Get('admin')
  async getAdmin() {
    return this.gameService.getAdminCap();
  }

  @Get('mock-create-game')
  async mockCreateGame() {
    return this.gameService.startGame('1');
  }

  @Get('mock-player-roll-dice')
  async mockPlayerRollDice(@Query('player') player: string) {
    const { player1, player2 } = this.setupService.loadKeypair();
    const keypair = player === '1' ? player1 : player2;
    return this.gameService.playerRollDice(keypair);
  }

  @Get('mock-player-buy')
  async mockPlayerBuy(@Query('player') player: string) {
    const { player1, player2 } = this.setupService.loadKeypair();
    const keypair = player === '1' ? player1 : player2;
    return this.gameService.playerBuy(keypair);
  }

  @Get('delete-all-room')
  async deleteAllRoom() {
    return this.roomService.deleteAllRoom();
  }
}
