// settleGameCreation
export type GameCreatedEvent = {
  gameObjectId: string;
  addresses: string[];
};

// playerMove
export type RollDiceEvent = {
  address: string;
  dice: number;
};

//initializeParams
export type JailEvent = {
  address: string;
  position: number;
  round: number;
};

//initializeParams
export type TollEvent = {
  address: string;
  position: number;
  change: number;
};

//initializeParams
export type HouseEvent = {
  address: string;
  position: number;
  level: number;
};

//initializeParams
export type ChanceEvent = {
  type: 'balance' | 'jail' | 'toll' | 'house';
  //
  description: string;
  target?: string; // balance, jail
  round: number; // jail
  balance?: number; // balance

  position?: number; // toll, house
  level?: number; // house
  times?: number; // toll
};

// executeBuy
export type BuyEvent = {
  address: string;
  position: number;
  buyOrNot: boolean;
};

// settleBuy
export type SettleBuyEvent = {
  address: string;
  position: number;
  level?: number;
  buyOrNot: boolean;
};
