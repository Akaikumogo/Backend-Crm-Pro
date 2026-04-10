import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Apartment } from './apartment.entity';
import { Block } from './block.entity';

export type FloorHotspot = {
  apartmentId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

@Entity('floors')
export class Floor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  level: number;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  planImageUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  hotspots: FloorHotspot[] | null;

  @ManyToOne(() => Block, (block) => block.floors, { onDelete: 'CASCADE' })
  block: Block;

  @Column('uuid')
  blockId: string;

  @OneToMany(() => Apartment, (apartment) => apartment.floor)
  apartments: Apartment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
