import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContractStatus, PaymentStatus } from '../contract-status.enum';
import { Apartment } from './apartment.entity';
import { Client } from './client.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Apartment, { onDelete: 'RESTRICT' })
  apartment: Apartment;

  @Column('uuid')
  apartmentId: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  client: Client;

  @Column('uuid')
  clientId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  seller: User | null;

  @Column('uuid', { nullable: true })
  sellerId: string | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column('uuid')
  organizationId: string;

  @Column({ type: 'date' })
  contractDate: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  amount: string;

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.PENDING,
  })
  status: ContractStatus;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
