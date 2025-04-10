import { io, Socket } from 'socket.io-client';
const socketIO = io('http://localhost:3003');
// const socketIO = io('http://5.183.11.9:3003');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
socketIO.on('connection', (socket: Socket) => {
  console.log('connected to server');
});

socketIO.on('roomCreated', (data) => {
  console.log('roomCreated', data);
});

socketIO.on('userJoined', (data) => {
  console.log('userJoined', data);
});

socketIO.on('rooms', (data) => {
  //check if there are any rooms
  console.log(data);
  console.log(data.rooms?.[0]?.members);

  // setRoomsState(data.rooms);
});

socketIO.on('error', (data) => {
  console.log('error', data);
});

socketIO.on('userLeft', (data) => {
  console.log('userLeft', data);
});

setTimeout(() => {
  socketIO.emit('createRoom', {
    address:
      '0x75afb4e868035ae16dc00bfc88f9eb534afe5d003a84a46e8f5ca4830760c88c',
  });
}, 1000);

setTimeout(() => {
  socketIO.emit('startGame');
  console.log('startGame');
}, 6000);

socketIO.on('gameStarting', (data) => {
  console.log('gameStarting', data);
});

socketIO.on('actionRequest', (data) => {
  console.log('actionRequest', data);
});
