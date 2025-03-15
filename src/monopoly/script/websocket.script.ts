import { io, Socket } from 'socket.io-client';
let roomId;
const socketIO = io('http://5.183.11.9:3003');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
socketIO.on('connection', (socket: Socket) => {
  console.log('connected to server');
});

socketIO.on('roomCreated', (data) => {
  console.log('roomCreated', data);
  roomId = data.roomId;
});

socketIO.on('userJoined', (data) => {
  console.log('userJoined', data);
  roomId = data.roomId;
});

socketIO.on('rooms', (data) => {
  //check if there are any rooms
  console.log('rooms', data);

  // setRoomsState(data.rooms);

  //////////////////////////////////////////////////////////////
  //just for testing
  //check if client is already in a room
  if (roomId) {
    return;
  }

  //check if there are any rooms to join, if not create a new one
  if (data.rooms.length > 0) {
    socketIO.emit('joinRoom', {
      address: '123',
      roomId: data.rooms[0].roomId,
    });
  } else {
    socketIO.emit('createRoom', {
      address: '234',
    });
  }
});

// socketIO.emit("leaveRoom");
