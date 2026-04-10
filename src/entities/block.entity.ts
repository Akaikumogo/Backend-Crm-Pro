import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { Floor } from './floor.entity';

@Entity('blocks')
@Unique(['branchId', 'code'])
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @ManyToOne(() => Branch, (b) => b.blocks, { onDelete: 'CASCADE' })
  branch: Branch;

  @Column('uuid')
  branchId: string;

  @OneToMany(() => Floor, (floor) => floor.block)
  floors: Floor[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
