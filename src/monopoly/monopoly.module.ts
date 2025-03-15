import { Module } from '@nestjs/common';
import { MonopolyController } from './monopoly.controller';
import { RoomService } from './room.service';
import { Room } from 'src/entity/monopoly/room.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [MonopolyController],
  providers: [RoomService, GameGateway],
})
export class MonopolyModule {}
