import { Socket } from 'socket.io';
import { io } from 'socket.io-client';

let roomId: any;
let joined = false;
const socketIO = io('http://localhost:3003');
// const socketIO = io('http://5.183.11.9:3003');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
socketIO.on('connection', (socket: Socket) => {
  console.log('connected to server');
});

socketIO.on('rooms', (data) => {
  //check if there are any rooms
  console.log(data);
  console.log(data.rooms?.[0]?.members);
  roomId = data.rooms?.[0]?.roomId;
  // setRoomsState(data.rooms);
});

socketIO.on('error', (data) => {
  console.log('error', data);
});

socketIO.on('userLeft', (data) => {
  console.log('userLeft', data);
});

setInterval(() => {
  if (roomId && !joined) {
    socketIO.emit('joinRoom', {
      // address: '123', //error: You are already in this room
      address:
        '0x746652a63d7efef47246a0437999ea3442d19991d82d8edf4ad8067b7e74f0be',
      roomId: roomId,
    });
    joined = true;
  }
}, 1000);
