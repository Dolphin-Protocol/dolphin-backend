import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Room {
  @PrimaryColumn()
  id: string;

  @Column()
  roomId: string;

  @Column()
  isCreator: boolean;

  @Column()
  address: string;

  @Column()
  clientId: string;

  @Column()
  createdAt: Date;
}
