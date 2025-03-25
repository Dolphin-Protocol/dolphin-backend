import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { RoomService } from './room.service';
import { RoomType } from './monopoly.type';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly roomService: RoomService) {}
  @WebSocketServer()
  server: Server;

  async emitRooms() {
    const rooms = await this.roomService.getRooms();
    this.server.emit('rooms', { rooms });
  }

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.emitRooms();
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const result = await this.roomService.leaveRoom({
      clientId: client.id,
    });
    if (result.success) {
      const room = result.message as RoomType;
      this.server.to(room.roomId).emit('userLeft', {
        room: {
          roomId: room.roomId,
          members: room.members,
          createdAt: room.createdAt,
        },
      });
      this.emitRooms();
    }
  }

  @SubscribeMessage('rooms')
  async handleRooms(@ConnectedSocket() client: Socket) {
    const rooms = await this.roomService.getRooms();
    client.emit('rooms', { rooms });
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody()
    data: {
      address: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.address) {
      return;
    }
    const roomId = uuidv4();
    client.join(roomId);
    const result = await this.roomService.createRoom({
      roomId,
      clientId: client.id,
      address: data.address,
    });
    if (!result.success) {
      client.emit('error', {
        message: result.message,
      });
      return;
    }
    const room = result.message as RoomType;
    this.server.to(roomId).emit('roomCreated', {
      room: {
        roomId,
        members: room.members,
        createdAt: room.createdAt,
      },
    });
    this.emitRooms();
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody()
    data: {
      address: string;
      roomId: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.address || !data.roomId) {
      return;
    }
    client.join(data.roomId);
    const result = await this.roomService.joinRoom({
      roomId: data.roomId,
      clientId: client.id,
      address: data.address,
    });
    if (!result.success) {
      client.emit('error', {
        message: result.message,
      });
      return;
    }
    const room = result.message as RoomType;
    this.server.to(data.roomId).emit('userJoined', {
      room: {
        roomId: room.roomId,
        members: room.members,
        createdAt: room.createdAt,
      },
    });
    this.emitRooms();
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const result = await this.roomService.leaveRoom({
      clientId: client.id,
    });
    if (!result.success) {
      client.emit('error', {
        message: result.message,
      });
      return;
    }
    const room = result.message as RoomType;
    this.server.to(room.roomId).emit('userLeft', {
      room: {
        roomId: room.roomId,
        members: room.members,
        createdAt: room.createdAt,
      },
    });
    this.emitRooms();
  }
}
