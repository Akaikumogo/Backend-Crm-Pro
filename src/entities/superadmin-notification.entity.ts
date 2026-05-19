import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

export enum SuperadminNotificationType {
  PAYMENT_DUE = 'payment_due',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
}

@Entity('superadmin_notifications')
export class SuperadminNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: SuperadminNotificationType })
  type: SuperadminNotificationType;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  organization: Organization | null;

  @Column('uuid', { nullable: true })
  organizationId: string | null;

  /** Populated for PASSWORD_RESET_REQUEST notifications */
  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  requestedUser: User | null;

  @Column('uuid', { nullable: true })
  requestedUserId: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isApproved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
