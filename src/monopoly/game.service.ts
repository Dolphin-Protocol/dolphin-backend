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
  getOwnedGames,
  HouseCellClass,
  MonopolyGame,
  newIdleCell,
  setupGameCreation,
} from '@sui-dolphin/monopoly-sdk';
import { History } from 'src/entity/monopoly/history.entity';
import { Transaction, TransactionResult } from '@mysten/sui/transactions';

import { ConfigService } from '@nestjs/config';
import { Ed25519Keypair } from '@mysten/sui/dist/cjs/keypairs/ed25519';
import { HOUSE_CELL_SIZE, packageId } from './constants';
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
    console.log(members, 'members');
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
    console.log(ptb, 'ptb');
    const result = await executeTransaction(this.suiClient, admin, ptb, {
      showEvents: true,
      showEffects: true,
      showInput: true,
    });
    console.log(result, 'result');
    const event: SuiEvent = result.events.find(
      (event) => event.type === `${packageId}::monopoly::GameCreatedEvent`,
    ) as SuiEvent;

    const data = event.parsedJson as GameCreatedEvent;
    console.log(data, 'data');
    for (const player of data.players) {
      const id = `${event.id.txDigest}-${event.id.eventSeq}-${player}`;
      const history = this.historyRepository.create({
        id,
        roomId,
        gameObjectId: data.game,
        address: player,
        clientId: members.find((m) => m.address === player)?.clientId,
        action: 'startGame',
        actionData: '',
        event_seq: Number(event.id.eventSeq),
        tx_digest: event.id.txDigest,
        timestamp: Number(result.timestampMs ?? Date.now()),
      });
      await this.historyRepository.save(history);
    }
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

    // let's create 5x4 borad game, requiring 20 cells
    //
    // import required cells;
    const vec = [...Array(HOUSE_CELL_SIZE).keys()];
    vec.forEach((idx) => {
      if (idx % 5 == 0) {
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

  async getGameStateByRoomId({ roomId }: { roomId: string }) {
    if (!roomId) {
      return;
    }
    const { admin } = this.setupService.loadKeypair();

    const [histories, ownedGames] = await Promise.all([
      this.historyRepository.find({
        where: {
          roomId,
          action: 'startGame',
        },
      }) ?? [],
      getOwnedGames(this.suiClient, admin.toSuiAddress()) ?? [],
    ]);
    if (!histories.length) {
      return;
    }
    // console.log(histories, 'histories');
    // console.log(ownedGames, 'ownedGames');

    const gameId = histories[0]?.gameObjectId;
    const targetGame = ownedGames.find((game) => game.id === gameId);
    if (!targetGame) {
      return;
    }
    const game = new MonopolyGame(targetGame);
    // console.log(game, 'game');
    const cellSize = game.game.cells.size;
    const cellDf = game.game.cells.id;
    const cellIds: string[] = [];
    // const cellIds = await Promise.all(
    //   Array.from(Array(Number(cellSize))).map(async (_, i) => {
    //     console.log(i, 'i');
    //     const cellDfContent = await this.suiClient.getDynamicFieldObject({
    //       parentId: cellDf,
    //       name: {
    //         type: 'u64',
    //         value: i.toString(),
    //       },
    //     });
    //     console.log('cellDfContent', cellDfContent);
    //     return cellDfContent?.data?.objectId;
    //   }),
    // );
    for (let i = 0; i < Number(cellSize); i++) {
      const cellDfContent = await this.suiClient.getDynamicFieldObject({
        parentId: cellDf,
        name: {
          type: 'u64',
          value: i.toString(),
        },
      });
      cellIds.push(cellDfContent?.data?.objectId);
      await this.waitfor429();
    }
    const cellsInfo = await this.suiClient.multiGetObjects({
      ids: cellIds,
      options: {
        showContent: true,
      },
    });
    const cells = cellsInfo.map((cell) => {
      return (cell.data?.content as any)?.fields;
    });

    const playersState = histories.map((history) => {
      const balance = game.game.balanceManager.balances.contents.find(
        (b) => b.key === history.address,
      );
      const position = game.game.playerPosition.contents.find(
        (p) => p.key === history.address,
      );
      return {
        address: history.address,
        balance: Number(balance?.value?.value),
        position: Number(position?.value),
      };
    });

    console.log(playersState, 'playersState');
    return {
      roomInfo: {
        roomId,
        gameId,
        gameState: 'started',
      },
      playersState,
      houseCell: cells.map((cell) => {
        if (cell?.house) {
          return {
            id: cell.id.id,
            owner: cell.owner,
            level: Number(cell.level),
            position: Number(cell.name),
            buyPrice: cell.house.fields.buy_prices.fields.contents?.map(
              (item: { fields: { key: string; value: string } }) => ({
                level: item.fields.key,
                price: item.fields.value,
              }),
            ),
            sellPrice: cell.house.fields.sell_prices.fields.contents?.map(
              (item: { fields: { key: string; value: string } }) => ({
                level: item.fields.key,
                price: item.fields.value,
              }),
            ),
            rentPrice: cell.house.fields.tolls.fields.contents?.map(
              (item: { fields: { key: string; value: string } }) => ({
                level: item.fields.key,
                price: item.fields.value,
              }),
            ),
          };
        } else {
          return {
            id: cell.id.id,
            position: Number(cell.name),
          };
        }
      }),
    };
  }

  async waitfor429() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 100);
    });
  }
}
