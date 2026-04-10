import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Block } from './block.entity';
import { Organization } from './organization.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @ManyToOne(() => Organization, (o) => o.branches, { onDelete: 'CASCADE' })
  organization: Organization;

  @Column('uuid')
  organizationId: string;

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  blockedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  blockedReason: string | null;

  @Column({ default: false })
  isVip: boolean;

  @Column({ type: 'varchar', nullable: true })
  mqttUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  mqttUsername: string | null;

  /** AES-GCM ciphertext (base64) */
  @Column({ type: 'text', nullable: true })
  mqttPasswordEncrypted: string | null;

  @Column({ type: 'varchar', nullable: true })
  mqttTopic: string | null;

  @OneToMany(() => Block, (b) => b.branch)
  blocks: Block[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
