import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Room } from '../entity/monopoly/room.entity';
import { RoomType } from './monopoly.type';
@Injectable()
export class RoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async getRooms(): Promise<RoomType[]> {
    const roomMembers = await this.roomRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
    const rooms: Record<string, RoomType> = {};
    roomMembers.forEach((roomMember) => {
      rooms[roomMember.roomId] = {
        roomId: roomMember.roomId,
        members: rooms[roomMember.roomId]?.members
          ? [
              ...rooms[roomMember.roomId].members,
              {
                clientId: roomMember.clientId,
                address: roomMember.address,
                isCreator: roomMember.isCreator,
              },
            ]
          : [
              {
                clientId: roomMember.clientId,
                address: roomMember.address,
                isCreator: roomMember.isCreator,
              },
            ],
        createdAt: roomMember.createdAt,
      };
    });
    return Object.values(rooms);
  }

  async createRoom({
    roomId,
    clientId,
    address,
  }: {
    roomId: string;
    clientId: string;
    address: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!address) {
      return {
        success: false,
        message: 'Address is required',
      };
    }
    const clientMember = await this.roomRepository.find({
      where: { clientId: clientId },
    });
    const addressMember = await this.roomRepository.find({
      where: { address: address },
    });
    if (clientMember.length >= 1 || addressMember.length >= 1) {
      return {
        success: false,
        message: 'You are already in a room',
      };
    }
    const room = this.roomRepository.create({
      id: uuidv4(),
      roomId,
      address,
      isCreator: true,
      clientId,
      createdAt: new Date(),
    });
    await this.roomRepository.save(room);
    return {
      success: true,
      message: 'Room created successfully',
    };
  }
  async joinRoom({
    roomId,
    clientId,
    address,
  }: {
    roomId: string;
    clientId: string;
    address: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!roomId) {
      return {
        success: false,
        message: 'Room ID is required',
      };
    }
    if (!address) {
      return {
        success: false,
        message: 'Address is required',
      };
    }

    const roomMembers = await this.roomRepository.find({
      where: { roomId: roomId },
    });
    const clientMember = roomMembers.find(
      (roomMember) => roomMember.clientId === clientId,
    );
    const addressMember = roomMembers.find(
      (roomMember) => roomMember.address === address,
    );
    if (clientMember || addressMember) {
      return {
        success: false,
        message: 'You are already in this room',
      };
    }

    const roomCreator = roomMembers.find((roomMember) => roomMember.isCreator);
    const room = this.roomRepository.create({
      id: uuidv4(),
      roomId,
      address,
      isCreator: false,
      clientId,
      createdAt: roomCreator.createdAt,
    });
    await this.roomRepository.save(room);
    return {
      success: true,
      message: 'Joined room successfully',
    };
  }

  async leaveRoom({ clientId }: { clientId: string }) {
    return await this.roomRepository.delete({
      clientId,
    });
  }
}
