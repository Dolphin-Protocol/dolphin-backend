import { Injectable } from '@nestjs/common';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { ConfigService } from '@nestjs/config';
import {
  getHouseRegistry,
  getOwnedGames,
  HouseCellClass,
  SharedObjectInput,
} from '@sui-dolphin/monopoly-sdk';

import { chanceRegistryConfig } from '../constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { History } from 'src/entity/monopoly/history.entity';
import { MonopolyGame } from '@sui-dolphin/monopoly-sdk';
import {
  ChanceCellClass,
  getChanceRegistry,
} from '@sui-dolphin/monopoly-sdk/cells/chance_cell';
@Injectable()
export class SetupService {
  private suiClient: SuiClient;
  constructor(
    private configService: ConfigService,
    @InjectRepository(History)
    private historyRepository: Repository<History>,
  ) {
    this.suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  }

  getSuiClient() {
    return this.suiClient;
  }

  loadKeypair() {
    const privateKey = this.configService.get('ADMIN_PRIVATE_KEY');
    const player1PrivateKey = this.configService.get('PLAYER_1_PRIVATE_KEY');
    const player2PrivateKey = this.configService.get('PLAYER_2_PRIVATE_KEY');

    const { secretKey: adminSecretKey } = decodeSuiPrivateKey(privateKey);
    const admin = Ed25519Keypair.fromSecretKey(adminSecretKey);

    const { secretKey: player1SecretKey } =
      decodeSuiPrivateKey(player1PrivateKey);
    const player1 = Ed25519Keypair.fromSecretKey(player1SecretKey);

    const { secretKey: player2SecretKey } =
      decodeSuiPrivateKey(player2PrivateKey);
    const player2 = Ed25519Keypair.fromSecretKey(player2SecretKey);

    return {
      admin,
      player1,
      player2,
    };
  }

  async getHouseRegistry() {
    const houseRegistryConfig = {
      objectId:
        '0xcc0f76b05ed305bb65bf015ceaac4adf15463d6740d0dddca232649798071352',
      initialSharedVersion: 390467302,
    } as SharedObjectInput;
    const houseRegistry = await getHouseRegistry(
      this.suiClient as any, // Type cast to avoid type mismatch
      houseRegistryConfig.objectId,
    );
    const houseClass = new HouseCellClass({
      registry: houseRegistry,
      config: houseRegistryConfig,
    });
    return {
      houseRegistry,
      houseClass,
    };
  }

  async getChanceRegistry() {
    const chanceRegistry = await getChanceRegistry(
      this.suiClient as any, // Type cast to avoid type mismatch
      chanceRegistryConfig.objectId,
    );
    const chanceClass = new ChanceCellClass({
      registry: chanceRegistry,
      config: chanceRegistryConfig,
    });
    return {
      chanceRegistry,
      chanceClass,
    };
  }

  async getGameByPlayerAddress(playerAddress: string) {
    const { admin } = this.loadKeypair();
    const history = await this.historyRepository.findOne({
      where: {
        address: playerAddress,
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const ownedGames = await getOwnedGames(
      this.suiClient,
      admin.toSuiAddress(),
    );
    const ownedGame = ownedGames?.find(
      (game) => game.id === history.gameObjectId,
    );
    if (!ownedGame) {
      console.error('No ownedGame found');
      return;
    }
    const game = new MonopolyGame(ownedGame);
    return game;
  }

  async getTurnCapByAddress(game: MonopolyGame, address: string) {
    const turnCaps = await game.getOwnedTurnCap(this.suiClient, address);
    if (!turnCaps.length) {
      console.error('No turnCaps found');
      return;
    }
    return turnCaps.find((turnCap) => turnCap.game === game.game.id);
  }
}
