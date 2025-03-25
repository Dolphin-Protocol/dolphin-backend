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
  }): Promise<{ success: boolean; message: string | RoomType }> {
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
      message: {
        roomId,
        members: [
          {
            clientId,
            address,
            isCreator: true,
          },
        ],
        createdAt: room.createdAt,
      },
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
  }): Promise<{ success: boolean; message: string | RoomType }> {
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
      message: {
        roomId,
        members: [
          ...roomMembers.map((roomMember) => ({
            clientId: roomMember.clientId,
            address: roomMember.address,
            isCreator: roomMember.isCreator,
          })),
          {
            clientId,
            address,
            isCreator: false,
          },
        ],
        createdAt: room.createdAt,
      },
    };
  }

  async leaveRoom({ clientId }: { clientId: string }): Promise<{
    success: boolean;
    message: string | RoomType;
  }> {
    const roomMembers = await this.roomRepository.find({
      where: { clientId: clientId },
    });
    if (roomMembers.length === 0) {
      return {
        success: false,
        message: 'You are not in any room',
      };
    }
    await this.roomRepository.delete({ clientId });
    return {
      success: true,
      message: {
        roomId: roomMembers[0].roomId,
        members: roomMembers.map((roomMember) => ({
          clientId: roomMember.clientId,
          address: roomMember.address,
          isCreator: roomMember.isCreator,
        })),
        createdAt: roomMembers[0].createdAt,
      },
    };
  }
}
