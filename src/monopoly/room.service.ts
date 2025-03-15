import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from 'src/entity/monopoly/room.entity';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
  ) {}
  async getRooms() {
    const roomMembers = await this.roomRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
    const rooms = [];
    roomMembers.forEach((roomMember) => {
      if (rooms.find((room) => room.id === roomMember.id)) {
        rooms
          .find((room) => room.id === roomMember.id)
          .members.push(roomMember.clientId);
      } else {
        rooms.push({ ...roomMember, members: [roomMember.clientId] });
      }
    });
    return rooms;
  }

  async createRoom({
    roomId,
    clientId,
    address,
  }: {
    roomId: string;
    clientId: string;
    address: string;
  }) {
    const room = this.roomRepository.create({
      id: uuidv4(),
      roomId,
      address,
      isCreator: true,
      clientId,
      createdAt: new Date(),
    });
    return await this.roomRepository.save(room);
  }
  async joinRoom({
    roomId,
    clientId,
    address,
  }: {
    roomId: string;
    clientId: string;
    address: string;
  }) {
    const roomMembers = await this.roomRepository.find({
      where: { id: roomId },
    });
    if (roomMembers.length >= 4) {
      throw new Error('Room is full');
    }
    if (roomMembers.find((roomMember) => roomMember.clientId === clientId)) {
      throw new Error('You are already in this room');
    }
    const room = this.roomRepository.create({
      id: uuidv4(),
      roomId,
      address,
      isCreator: false,
      clientId,
      createdAt: new Date(),
    });
    return await this.roomRepository.save(room);
  }

  async leaveRoom({ clientId }: { clientId: string }) {
    return await this.roomRepository.delete({
      clientId,
    });
  }
}
