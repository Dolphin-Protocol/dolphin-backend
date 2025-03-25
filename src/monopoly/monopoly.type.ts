export type RoomMember = {
  clientId: string;
  address: string;
  isCreator: boolean;
};

export type RoomType = {
  roomId: string;
  members: RoomMember[];
  createdAt: Date;
};
