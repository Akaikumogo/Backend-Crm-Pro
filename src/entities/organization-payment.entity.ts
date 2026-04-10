import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity('organization_payments')
export class OrganizationPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column('uuid')
  organizationId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'date' })
  paidAt: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  createdBy: User | null;

  @Column('uuid', { nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
