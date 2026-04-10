import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ApartmentStatus } from '../apartment-status.enum';
import { Floor } from './floor.entity';
import { User } from './user.entity';

@Entity('apartments')
@Unique(['floorId', 'number'])
export class Apartment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  number: string;

  @Column({
    type: 'enum',
    enum: ApartmentStatus,
    default: ApartmentStatus.FOR_SALE,
  })
  status: ApartmentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  areaSqm: string | null;

  @Column({ type: 'int', nullable: true })
  rooms: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  priceTotal: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  pricePerSqm: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @ManyToOne(() => Floor, (floor) => floor.apartments, { onDelete: 'CASCADE' })
  floor: Floor;

  @Column('uuid')
  floorId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  soldBy: User | null;

  @Column('uuid', { nullable: true })
  soldById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
