import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';
import { User } from './user.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  blockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  blockedReason: string | null;

  @Column({ default: false })
  isVip: boolean;

  @Column({ type: 'date', nullable: true })
  paymentDueAt: string | null;

  /** Cron idempotency: last paymentDueAt value we already notified for */
  @Column({ type: 'date', nullable: true })
  lastNotifiedPaymentDueAt: string | null;

  @OneToMany(() => Branch, (b) => b.organization)
  branches: Branch[];

  @OneToMany(() => User, (u) => u.organization)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
