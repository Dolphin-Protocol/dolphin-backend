import { Module } from '@nestjs/common';
import { MonopolyController } from './monopoly.controller';
import { RoomService } from './room.service';
import { Room } from 'src/entity/monopoly/room.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { SetupService } from './setup/setup.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([Room]), ConfigModule],
  controllers: [MonopolyController],
  providers: [RoomService, GameGateway, GameService, SetupService],
})
export class MonopolyModule {}
