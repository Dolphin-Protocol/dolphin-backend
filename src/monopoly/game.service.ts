import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SetupService } from './setup/setup.service';
import { Room } from 'src/entity/monopoly/room.entity';
import { Repository } from 'typeorm';
import { SuiClient, SuiEvent } from '@mysten/sui/client';
import {
  Action,
  executeTransaction,
  getOwnedAdminCaps,
  HouseCellClass,
  MonopolyGame,
  newIdleCell,
  setupGameCreation,
} from '@sui-dolphin/monopoly-sdk';
import { History } from 'src/entity/monopoly/history.entity';
import { Transaction, TransactionResult } from '@mysten/sui/transactions';

import { ConfigService } from '@nestjs/config';
import { Ed25519Keypair } from '@mysten/sui/dist/cjs/keypairs/ed25519';
import { packageId } from './constants';
import { ChanceCellClass } from '@sui-dolphin/monopoly-sdk/cells/chance_cell';
import {
  ActionRequest,
  AdminCap,
  GameCreatedEvent,
  TurnCap,
} from '@sui-dolphin/monopoly-sdk/_generated/monopoly/monopoly/structs';
import { Cell } from '@sui-dolphin/monopoly-sdk/_generated/monopoly/cell/structs';
import { HouseCell } from '@sui-dolphin/monopoly-sdk/_generated/monopoly/house-cell/structs';
import { TypeArgument } from '@sui-dolphin/monopoly-sdk/_generated/_framework/reified';
@Injectable()
export class GameService {
  private suiClient: SuiClient;
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(History)
    private historyRepository: Repository<History>,
    private setupService: SetupService,
    private configService: ConfigService,
  ) {
    this.suiClient = this.setupService.getSuiClient();
  }

  async getAdminCap() {
    const { admin } = this.setupService.loadKeypair();
    const adminCaps = await getOwnedAdminCaps(
      this.suiClient as any, // Type cast to avoid type mismatch
      admin.toSuiAddress(),
    );
    return {
      adminCap: adminCaps[0],
      admin,
    };
  }

  async startGame(roomId: string) {
    // call setupGameCreation
    const { admin } = this.setupService.loadKeypair();
    const members = await this.roomRepository.find({
      where: {
        roomId,
      },
    });
    console.log(members);
    if (members.length < 2) {
      return;
    }
    const [{ houseClass }, { chanceClass }, { adminCap }] = await Promise.all([
      this.setupService.getHouseRegistry(),
      this.setupService.getChanceRegistry(),
      this.getAdminCap(),
    ]);
    // create game
    const ptb = this.createGameWithOnlyHouseCellExample(
      houseClass,
      chanceClass,
      adminCap,
      members.map((member) => member.address),
      admin.toSuiAddress(),
    );
    const result = await executeTransaction(this.suiClient, admin, ptb, {
      showEvents: true,
      showEffects: true,
      showInput: true,
    });
    const event: SuiEvent = result.events.find(
      (event) => event.type === `${packageId}::monopoly::GameCreatedEvent`,
    ) as SuiEvent;

    const data = event.parsedJson as GameCreatedEvent;
    await Promise.all(
      data?.players?.map((player) => {
        const id = `${event.id.txDigest}-${event.id.eventSeq}-${player}`;
        const history = this.historyRepository.create({
          id,
          roomId,
          gameObjectId: data.game,
          address: player,
          clientId: members.find((m) => m.address === player)?.clientId,
          action: 'startGame',
          actionData: JSON.stringify(event),
          event_seq: Number(event.id.eventSeq),
          tx_digest: event.id.txDigest,
          timestamp: Number(result.timestampMs ?? Date.now()),
        });
        return this.historyRepository.save(history);
      }),
    );

    return {
      players: members.filter(
        (member) => member.address !== admin.toSuiAddress(),
      ),
      gameId: data.game,
    };
  }

  async resolvePlayerMove(
    address: string,
    action: Action,
  ): Promise<SuiEvent[]> {
    const { chanceClass } = await this.setupService.getChanceRegistry();
    const { admin } = this.setupService.loadKeypair();
    const game = await this.setupService.getGameByPlayerAddress(address);
    const turnCap = await this.setupService.getTurnCapByAddress(
      game,
      game.game.id,
    );

    const events = await this.adminExecutePlayerMove(
      this.suiClient,
      game,
      chanceClass,
      admin,
      turnCap,
      action,
    );
    return events;
  }

  async settleBuyOrUpgradeAction(address: string, actionRequestId: string) {
    const { admin } = this.setupService.loadKeypair();
    const game = await this.setupService.getGameByPlayerAddress(address);
    console.log(actionRequestId, 'actionRequestId');
    const actionRequests = await game.getOwnedActionRequest(
      this.suiClient,
      game.game.id,
      Action.BUY_OR_UPGRADE,
    );
    console.log(actionRequests, 'actionRequests');
    const actionRequest = actionRequests.find(
      (action) => action.id === actionRequestId,
    );
    if (!actionRequest) {
      console.error('No actionRequest found');
      return;
    }
    return this.adminSettleBuyOrUpgradeAction(
      this.suiClient,
      game,
      admin,
      actionRequest,
    );
  }

  // frontend
  async playerRollDice(player: Ed25519Keypair) {
    const game = await this.setupService.getGameByPlayerAddress(
      player.toSuiAddress(),
    );
    if (!game) {
      console.error('No game found');
      return;
    }
    const turnCap = await this.setupService.getTurnCapByAddress(
      game,
      player.toSuiAddress(),
    );
    if (!turnCap) {
      console.error('No turnCap found');
      return;
    }
    await this.playerRequestMove(this.suiClient, game, player, turnCap);
  }

  async playerBuy(player: Ed25519Keypair) {
    const game = await this.setupService.getGameByPlayerAddress(
      player.toSuiAddress(),
    );

    const actionRequest = await game.getOwnedActionRequest(
      this.suiClient,
      player.toSuiAddress(),
      Action.BUY_OR_UPGRADE,
    );
    if (!actionRequest.length) {
      console.error('No actionRequest found');
      return;
    }
    await this.playerExecuteBuyOrUpgradeAction(
      this.suiClient,
      game,
      player,
      actionRequest[0],
      {
        purchased: true,
      },
    );
  }

  // inner function
  createGameWithOnlyHouseCellExample(
    houseClass: HouseCellClass,
    chanceClass: ChanceCellClass,
    adminCap: AdminCap,
    players: string[],
    admin: string,
  ) {
    let ptb = new Transaction();
    const cells: { cell: TransactionResult; typeName: string }[] = [];

    // let's create 4x4 borad game, requiring 12 cells
    //
    // import required cells;
    const vec = [...Array(12).keys()];
    vec.forEach((idx) => {
      if (idx % 4 == 0) {
        // jail cell
        const { cell, ptb: ptb_ } = newIdleCell(idx.toString(), ptb);
        cells.push({ typeName: Cell.$typeName, cell });
        ptb = ptb_;
      } else {
        // hose cell
        const { cell, ptb: ptb_ } = houseClass.newCell(idx.toString(), ptb);

        cells.push({ typeName: HouseCell.$typeName, cell });

        ptb = ptb_;
      }
    });

    const maxRound = 4n;
    const maxSteps = 6;
    const salary = 100n;
    const initialFunds = 2000n;

    ptb = setupGameCreation(
      adminCap,
      players,
      maxRound,
      maxSteps,
      salary,
      cells,
      initialFunds,
      admin,
      ptb,
    );

    return ptb;
  }

  async playerRequestMove(
    client: SuiClient,
    monopolyGame: MonopolyGame,
    player: Ed25519Keypair,
    turnCap: TurnCap,
  ) {
    const ptb = monopolyGame.playerMove(player.toSuiAddress(), turnCap);

    const response = await executeTransaction(client, player, ptb, {
      showEvents: true,
    });

    return response.events;
  }

  async adminExecutePlayerMove(
    client: SuiClient,
    monopolyGame: MonopolyGame,
    chanceCellClass: ChanceCellClass,
    admin: Ed25519Keypair,
    turnCap: TurnCap,
    action: Action,
  ) {
    const ptb = monopolyGame.adminExecutePlayerMove(
      turnCap,
      action,
      chanceCellClass,
    );

    const response = await executeTransaction(client, admin, ptb, {
      showEvents: true,
    });

    return response.events;
  }

  async playerExecuteBuyOrUpgradeAction<P extends TypeArgument>(
    client: SuiClient,
    monopolyGame: MonopolyGame,
    player: Ed25519Keypair,
    actionRequest: ActionRequest<P>,
    args: {
      purchased: boolean;
    },
  ) {
    const ptb = monopolyGame.playerExecuteBuyOrUpgarde(
      actionRequest,
      args.purchased,
    );

    await executeTransaction(client, player, ptb, {
      showEvents: true,
    });
  }

  async adminSettleBuyOrUpgradeAction<P extends TypeArgument>(
    client: SuiClient,
    monopolyGame: MonopolyGame,
    admin: Ed25519Keypair,
    actionRequest: ActionRequest<P>,
  ) {
    const ptb = monopolyGame.settleBuyOrUpgradeAction(actionRequest);

    const result = await executeTransaction(client, admin, ptb, {
      showEvents: true,
    });
    console.log(result, 'result');
    return result.events;
  }

  async getGameTurnAddress(clientId: string) {
    const history = await this.historyRepository.findOne({
      where: {
        clientId,
      },
    });
    const turnHistory = await this.historyRepository.findOne({
      where: {
        roomId: history.roomId,
        action: 'changeTurn',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    if (!turnHistory) {
      return;
    }
    return turnHistory.address;
  }
}
