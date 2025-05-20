import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class History {
  @PrimaryColumn()
  id: string;

  @Column()
  roomId: string;

  @Column()
  gameObjectId: string;

  @Column()
  address: string;

  @Column()
  clientId: string;

  @Column()
  action:
    | 'startGame'
    | 'move'
    | 'fulfillAction'
    | 'buy'
    | 'pay'
    | 'chance'
    | 'jail'
    | 'rollDice'
    | 'changeTurn'
    | 'balanceUpdated'
    | 'gameClosed';

  @Column()
  actionData: string;

  @Column()
  event_seq: number;

  @Column()
  tx_digest: string;

  @Column()
  timestamp: number;
}
