import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameGateway } from '../game.gateway';
import { History } from '../../entity/monopoly/history.entity';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(History)
    private readonly historyRepository: Repository<History>,
    private readonly gameGateway: GameGateway,
  ) {}

  @Cron('5 * * * * *')
  handleCron() {
    // Use the gateway to emit events
    // this.gameGateway.server.emit('cronUpdate', { timestamp: new Date() });
  }
}
