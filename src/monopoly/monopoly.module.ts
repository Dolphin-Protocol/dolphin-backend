import { Module } from '@nestjs/common';
import { MonopolyController } from './monopoly.controller';
import { RoomService } from './room.service';
import { Room } from 'src/entity/monopoly/room.entity';
import { History } from 'src/entity/monopoly/history.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { SetupService } from './setup/setup.service';
import { ConfigModule } from '@nestjs/config';
import { EventService } from './event/event.service';

@Module({
  imports: [TypeOrmModule.forFeature([Room, History]), ConfigModule],
  controllers: [MonopolyController],
  providers: [
    RoomService,
    GameGateway,
    GameService,
    SetupService,
    EventService,
  ],
})
export class MonopolyModule {}
