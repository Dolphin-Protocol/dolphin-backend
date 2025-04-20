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

// websocket
export type Action = 'BUY' | 'UPGRADE' | 'PAY_RENT' | 'CHANCE' | 'JAIL';

export type WsTurnEvent = {
  player: string;
};

export type WsRollDiceEvent = {
  player: string;
  dice: number;
};

// only buy or upgrade
export type WsBuyOrUpgradeRequestEvent = {
  player: string;
};

export type WsActionResultEvent = {
  player: string;
  isMyTurn: boolean;
  action: Action;
  eventParams: Record<string, string>;
};
