import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SetupService } from './setup/setup.service';
import { Room } from 'src/entity/monopoly/room.entity';
import { Repository } from 'typeorm';
import { SuiClient } from '@mysten/sui/dist/cjs/client';
import { getOwnedAdminCaps } from '@sui-dolphin/monopoly-sdk';
import { History } from 'src/entity/monopoly/history.entity';
@Injectable()
export class GameService {
  private suiClient: SuiClient;
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(History)
    private historyRepository: Repository<History>,
    private setupService: SetupService,
  ) {
    this.suiClient = this.setupService.getSuiClient();
  }

  async createGame(roomId: string) {
    // const room = await this.roomRepository.findOne({
    //   where: { id: roomId },
    // });
    // if (!room) {
    //   throw new Error('Room not found');
    // }
    console.log(roomId);
  }

  async getAdminKeypair() {
    const admin = await this.setupService.loadKeypair();
    console.log(admin);
    const adminCaps = await getOwnedAdminCaps(
      this.suiClient,
      admin.admin.toSuiAddress(),
    );
    console.log(adminCaps);
    return admin;
  }

  async startGame(roomId: string) {
    // call setupGameCreation
    const members = await this.roomRepository.find({
      where: {
        roomId,
      },
    });
    if (members.length < 2) {
      return;
    }
    // create game
  }
}
