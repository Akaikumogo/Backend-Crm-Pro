import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../user-role.enum';
import { Branch } from './branch.entity';
import { Organization } from './organization.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'varchar', nullable: true })
  fullName: string | null;

  @ManyToOne(() => Organization, (o) => o.users, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  organization: Organization | null;

  @Column('uuid', { nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Branch, { onDelete: 'SET NULL', nullable: true })
  branch: Branch | null;

  @Column('uuid', { nullable: true })
  branchId: string | null;

  /** STAFF only; null = legacy full access (see JwtStrategy). */
  @Column({ type: 'jsonb', nullable: true })
  permissions: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
