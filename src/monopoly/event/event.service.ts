import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameGateway } from '../game.gateway';
import { History } from '../../entity/monopoly/history.entity';
import {
  HOUSE_CELL_SIZE,
  monopolyType,
  packageId,
  upgradedPackageId,
} from '../constants';
import {
  PaginatedEvents,
  PaginatedObjectsResponse,
  SuiClient,
  SuiEvent,
} from '@mysten/sui/client';
import { SetupService } from '../setup/setup.service';
import { GameService } from '../game.service';
import {
  ChangeTurnEvent,
  GameClosedEvent,
} from '@sui-dolphin/monopoly-sdk/_generated/monopoly/monopoly/structs';
import { BuyArgument } from '@sui-dolphin/monopoly-sdk/_generated/monopoly/house-cell/structs';
import { ActionRequestEvent } from '@sui-dolphin/monopoly-sdk/_generated/monopoly/event/structs';
import { Action } from '@sui-dolphin/monopoly-sdk';
import { BalanceUpdateEvent } from '@sui-dolphin/monopoly-sdk/_generated/monopoly/balance-manager/structs';

@Injectable()
export class EventService {
  private readonly suiClient: SuiClient;
  private readonly limit = 20;
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    private readonly gameGateway: GameGateway,
    private readonly setupService: SetupService,
    private readonly gameService: GameService,
  ) {
    this.suiClient = this.setupService.getSuiClient();
  }

  @Cron('*/2 * * * * *')
  async handleRollDiceEvent() {
    const lastHistory = await this.historyRepository.findOne({
      where: {
        action: 'rollDice',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const events = await this.queryEvents({
      module: 'monopoly',
      packageId,
      eventType: 'RollDiceEvent',
      nextCursor: lastHistory
        ? {
            eventSeq: lastHistory.event_seq.toString(),
            txDigest: lastHistory.tx_digest,
          }
        : undefined,
    });
    for (const event of events) {
      await this.playerMove(event);
    }
  }

  @Cron('*/3 * * * * *')
  async handleChangeTurnEvent_() {
    const lastHistory = await this.historyRepository.findOne({
      where: {
        action: 'changeTurn',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const events = await this.queryEvents({
      module: 'monopoly',
      packageId,
      eventType: 'ChangeTurnEvent',
      nextCursor: lastHistory
        ? {
            eventSeq: lastHistory.event_seq.toString(),
            txDigest: lastHistory.tx_digest,
          }
        : undefined,
    });
    for (const event of events) {
      await this.handleChangeTurnEvent(event);
    }
    const lastPlayer = await this.historyRepository.findOne({
      where: {
        action: 'startGame',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    if (!lastPlayer) {
      return;
    }
    const turns = await this.historyRepository.find({
      where: {
        action: 'changeTurn',
        address: lastPlayer.address,
        roomId: lastPlayer.roomId,
      },
    });
    if (turns.length >= 10) {
      await this.gameService.closeGame(lastPlayer.address);
    }
  }

  @Cron('*/4 * * * * *')
  async handlePlayerBuyEvent() {
    const lastHistory = await this.historyRepository.findOne({
      where: {
        action: 'buy',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const events = await this.queryEvents({
      module: 'house_cell',
      packageId: upgradedPackageId,
      eventType: 'PlayerBuyOrUpgradeHouseEvent',
      nextCursor: lastHistory
        ? {
            eventSeq: lastHistory.event_seq.toString(),
            txDigest: lastHistory.tx_digest,
          }
        : undefined,
    });
    for (const event of events) {
      await this.playerBuy(event);
    }
  }

  @Cron('*/5 * * * * *')
  async handleBalanceUpdatedEvent() {
    const lastHistory = await this.historyRepository.findOne({
      where: {
        action: 'balanceUpdated',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const events = await this.queryEvents({
      module: 'balance_manager',
      packageId,
      eventType: `BalanceUpdateEvent<${monopolyType}>`,
      nextCursor: lastHistory
        ? {
            eventSeq: lastHistory.event_seq.toString(),
            txDigest: lastHistory.tx_digest,
          }
        : undefined,
    });
    for (const event of events) {
      await this.playerBalanceUpdated(event);
    }
  }

  @Cron('*/5 * * * * *')
  async handleGameClosedEvent() {
    const lastHistory = await this.historyRepository.findOne({
      where: {
        action: 'gameClosed',
      },
      order: {
        timestamp: 'DESC',
      },
    });
    const events = await this.queryEvents({
      module: 'monopoly',
      packageId,
      eventType: 'GameClosedEvent',
      nextCursor: lastHistory
        ? {
            eventSeq: lastHistory.event_seq.toString(),
            txDigest: lastHistory.tx_digest,
          }
        : undefined,
    });
    console.log(events, 'events');
    console.log('game closed event');
    for (const event of events) {
      await this.playerClosedGame(event);
    }
  }

  async playerMove(event: SuiEvent) {
    // console.log(event, 'event');
    const rollDiceEvent = event.parsedJson as {
      game: string;
      player: string;
      dice_num: string;
    };
    const history = await this.historyRepository.findOne({
      where: {
        gameObjectId: rollDiceEvent.game,
      },
    });
    if (!history) {
      return;
    }
    await this.historyRepository.save({
      id: `${event.id.txDigest}-${event.id.eventSeq}`,
      roomId: history.roomId,
      gameObjectId: history.gameObjectId,
      address: rollDiceEvent.player,
      clientId: history.clientId,
      action: 'rollDice',
      actionData: JSON.stringify(event.parsedJson),
      event_seq: Number(event.id.eventSeq),
      tx_digest: event.id.txDigest,
      timestamp: Number(event.timestampMs ?? Date.now()),
    });

    const gameState = await this.gameService.getGameStateByRoomId({
      roomId: history.roomId,
    });

    const originalPosition = gameState.playersState.find(
      (p) => p.address === rollDiceEvent.player,
    )?.position;
    console.log(originalPosition, 'originalPosition');
    console.log(rollDiceEvent, 'rollDiceEvent');
    const playerPosition =
      (originalPosition + Number(rollDiceEvent.dice_num)) % HOUSE_CELL_SIZE;
    const houseCell = gameState.houseCell.find(
      (cell) => cell.position === playerPosition,
    );
    const isHouseCell = Boolean(houseCell?.buyPrice);
    const hasOwner = Boolean(houseCell?.owner);
    console.log(houseCell, 'houseCell');
    console.log(isHouseCell, 'isHouseCell');
    // check what action to take by the dice result
    // if action is buy or upgrade, resolve the emit action request event of the transaction to the frontend
    // if action is other, do nothing
    if (isHouseCell) {
      if (
        !hasOwner ||
        (hasOwner &&
          houseCell?.owner?.toLowerCase() ===
            rollDiceEvent.player?.toLowerCase())
      ) {
        const events = await this.gameService.resolvePlayerMove(
          rollDiceEvent.player,
          Action.BUY_OR_UPGRADE,
        );
        this.gameGateway.server.to(history.roomId).emit('Move', {
          player: rollDiceEvent.player,
          position: playerPosition,
          step: Number(rollDiceEvent.dice_num),
        });
        for (const event of events) {
          if (
            event.type ===
            `${packageId}::event::ActionRequestEvent<${packageId}::house_cell::BuyArgument>`
          ) {
            const actionRequestEvent =
              event.parsedJson as ActionRequestEvent<BuyArgument>;
            this.gameGateway.server.to(history.roomId).emit('ActionRequest', {
              player: actionRequestEvent.player,
              houseCell,
            });
          }
        }
      } else {
        const events = await this.gameService.resolvePlayerMove(
          rollDiceEvent.player,
          Action.PAY,
        );
        this.gameGateway.server.to(history.roomId).emit('Move', {
          player: rollDiceEvent.player,
          position: playerPosition,
          step: Number(rollDiceEvent.dice_num),
        });
        for (const event of events) {
          console.log(event, 'event');
          if (event.type === `${packageId}::house_cell::PayHouseTollEvent`) {
            const payHouseTollEvent = event.parsedJson as {
              player: string;
              paid_amount: string;
              payee: string;
              level: string;
            };
            console.log(payHouseTollEvent, 'payHouseTollEvent');
            this.gameGateway.server.to(history.roomId).emit('PayHouseToll', {
              player: payHouseTollEvent.player,
              houseCell,
              paidAmount: Number(payHouseTollEvent.paid_amount),
              payee: payHouseTollEvent.payee,
              level: Number(payHouseTollEvent.level),
              event: payHouseTollEvent,
            });
          }
        }
      }
    } else {
      await this.gameService.resolvePlayerMove(
        rollDiceEvent.player,
        Action.DO_NOTHING,
      );
      this.gameGateway.server.to(history.roomId).emit('Move', {
        player: rollDiceEvent.player,
        position: playerPosition,
        step: Number(rollDiceEvent.dice_num),
      });
    }
  }

  async handleChangeTurnEvent(event: SuiEvent) {
    const changeTurnEvent = event.parsedJson as ChangeTurnEvent;
    const history = await this.historyRepository.findOne({
      where: {
        gameObjectId: changeTurnEvent.game,
      },
    });
    if (!history) {
      return;
    }
    await this.historyRepository.save({
      id: `${event.id.txDigest}-${event.id.eventSeq}`,
      roomId: history.roomId,
      gameObjectId: history.gameObjectId,
      address: changeTurnEvent.player,
      clientId: history.clientId,
      action: 'changeTurn',
      actionData: JSON.stringify(event.parsedJson),
      event_seq: Number(event.id.eventSeq),
      tx_digest: event.id.txDigest,
      timestamp: Number(event.timestampMs ?? Date.now()),
    });

    this.gameGateway.server.to(history.roomId).emit('ChangeTurn', {
      player: changeTurnEvent.player,
    });
  }

  async playerBuy(event: SuiEvent) {
    const playerBuyOrUpgradeHouseEvent = event.parsedJson as {
      action_request: string;
      game: string;
      player: string;
      purchased: boolean;
    };
    const history = await this.historyRepository.findOne({
      where: {
        gameObjectId: playerBuyOrUpgradeHouseEvent.game,
      },
    });
    if (!history) {
      return;
    }
    await this.historyRepository.save({
      id: `${event.id.txDigest}-${event.id.eventSeq}`,
      roomId: history.roomId,
      gameObjectId: history.gameObjectId,
      address: playerBuyOrUpgradeHouseEvent.player,
      clientId: history.clientId,
      action: 'buy',
      actionData: JSON.stringify(event.parsedJson),
      event_seq: Number(event.id.eventSeq),
      tx_digest: event.id.txDigest,
      timestamp: Number(event.timestampMs ?? Date.now()),
    });
    await this.gameService.settleBuyOrUpgradeAction(
      playerBuyOrUpgradeHouseEvent.player,
      playerBuyOrUpgradeHouseEvent.action_request,
    );
    const gameState = await this.gameService.getGameStateByRoomId({
      roomId: history.roomId,
    });

    this.gameGateway.server.to(history.roomId).emit('Buy', {
      player: playerBuyOrUpgradeHouseEvent.player,
      purchased: playerBuyOrUpgradeHouseEvent.purchased,
      houseCell: gameState.houseCell.find(
        (cell) =>
          Number(cell.position) ===
          Number(
            gameState.playersState.find(
              (p) => p.address === playerBuyOrUpgradeHouseEvent.player,
            )?.position,
          ),
      ),
    });
  }

  async queryEvents({
    module,
    packageId,
    eventType,
    nextCursor,
  }: {
    module: string;
    packageId: string;
    eventType: string;
    nextCursor?: PaginatedEvents['nextCursor'];
  }) {
    let hasNextPage = false;

    const data: PaginatedEvents['data'] = [];
    // console.log(`${packageId}::${module}::${eventType}`);
    do {
      const event = await this.suiClient.queryEvents({
        query: {
          // MoveEventModule: {
          //   package: packageId,
          //   module,
          // },
          MoveEventType: `${packageId}::${module}::${eventType}`,
        },
        limit: this.limit,
        cursor: nextCursor,
        order: 'ascending',
      });
      hasNextPage = event.hasNextPage;
      nextCursor = event.nextCursor;
      data.push(...event.data);
    } while (hasNextPage);

    return data;
  }

  async queryOwnedObjects({
    owner,
    module,
    packageId,
    type,
    nextCursor,
  }: {
    owner: string;
    module: string;
    packageId: string;
    type: string;
    nextCursor?: PaginatedObjectsResponse['nextCursor'];
  }) {
    let hasNextPage = false;

    const data: PaginatedObjectsResponse['data'] = [];
    do {
      const event = await this.suiClient.getOwnedObjects({
        owner,
        filter: {
          StructType: `${packageId}::${module}::${type}`,
        },
        limit: this.limit,
        cursor: nextCursor,
        options: {
          showContent: true,
        },
      });
      hasNextPage = event.hasNextPage;
      nextCursor = event.nextCursor;
      data.push(...event.data);
    } while (hasNextPage);

    return data;
  }

  async queryObjects({ ids }: { ids: string[] }) {
    const objects = await this.suiClient.multiGetObjects({
      ids,
      options: {
        showContent: true,
      },
    });
    return objects;
  }

  async playerBalanceUpdated(event: SuiEvent) {
    console.log('playerBalanceUpdated');
    const balanceUpdateEvent = event.parsedJson as BalanceUpdateEvent<any>;
    console.log(balanceUpdateEvent, 'balanceUpdateEvent');
    const history = await this.historyRepository.findOne({
      where: {
        address: balanceUpdateEvent.owner,
      },
      order: {
        timestamp: 'DESC',
      },
    });
    if (!history) {
      return;
    }
    console.log(balanceUpdateEvent, 'balanceUpdateEvent');

    const result = await this.historyRepository.save({
      id: `${event.id.txDigest}-${event.id.eventSeq}`,
      roomId: history.roomId,
      gameObjectId: history.gameObjectId,
      address: balanceUpdateEvent.owner,
      clientId: history.clientId,
      action: 'balanceUpdated',
      actionData: JSON.stringify(event.parsedJson),
      event_seq: Number(event.id.eventSeq),
      tx_digest: event.id.txDigest,
      timestamp: Number(event.timestampMs ?? Date.now()),
    });
    console.log(result, 'result');
    this.gameGateway.server.to(history.roomId).emit('BalanceUpdated', {
      ...balanceUpdateEvent,
    });
  }

  async playerClosedGame(event: SuiEvent) {
    const gameClosedEvent = event.parsedJson as GameClosedEvent;
    const history = await this.historyRepository.findOne({
      where: {
        gameObjectId: gameClosedEvent.game,
      },
    });
    if (!history) {
      return;
    }
    await this.historyRepository.save({
      id: `${event.id.txDigest}-${event.id.eventSeq}`,
      roomId: history.roomId,
      gameObjectId: history.gameObjectId,
      address: gameClosedEvent.winners[0],
      clientId: history.clientId,
      action: 'gameClosed',
      actionData: JSON.stringify(event.parsedJson),
      event_seq: Number(event.id.eventSeq),
      tx_digest: event.id.txDigest,
      timestamp: Number(event.timestampMs ?? Date.now()),
    });
    this.gameGateway.server.to(history.roomId).emit('GameClosed', {
      game: gameClosedEvent.game,
      winners: gameClosedEvent.winners,
    });
  }
}
