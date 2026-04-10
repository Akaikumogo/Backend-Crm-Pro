import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Apartment } from '../entities/apartment.entity';
import { Block } from '../entities/block.entity';
import { Branch } from '../entities/branch.entity';
import { Client } from '../entities/client.entity';
import { Contract } from '../entities/contract.entity';
import { Floor } from '../entities/floor.entity';
import { OrganizationPayment } from '../entities/organization-payment.entity';
import { Organization } from '../entities/organization.entity';
import { SuperadminNotification } from '../entities/superadmin-notification.entity';
import { User } from '../entities/user.entity';

type JsonBackupV1 = {
  v: 1;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

@Injectable()
export class AdminBackupsService {
  private readonly dir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.dir = join(process.cwd(), 'backups');
  }

  async ensureDir() {
    await mkdir(this.dir, { recursive: true });
  }

  private assertSafeFilename(filename: string) {
    if (
      !filename ||
      filename.includes('/') ||
      filename.includes('..') ||
      (!filename.endsWith('.sql') && !filename.endsWith('.json'))
    ) {
      throw new BadRequestException('Invalid filename');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
  }

  async createDump() {
    await this.ensureDir();
    const name = `db_${Date.now()}.json`;
    const filePath = join(this.dir, name);
    const backup = await this.createJsonBackup();
    await writeFile(filePath, JSON.stringify(backup));

    const s = await stat(filePath);
    return { filename: name, size: s.size };
  }

  private async createJsonBackup(): Promise<JsonBackupV1> {
    const tables: JsonBackupV1['tables'] = {
      organizations: await this.dataSource.getRepository(Organization).find(),
      branches: await this.dataSource.getRepository(Branch).find(),
      users: await this.dataSource
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .getMany(),
      blocks: await this.dataSource.getRepository(Block).find(),
      floors: await this.dataSource.getRepository(Floor).find(),
      apartments: await this.dataSource.getRepository(Apartment).find(),
      clients: await this.dataSource.getRepository(Client).find(),
      contracts: await this.dataSource.getRepository(Contract).find(),
      organization_payments: await this.dataSource
        .getRepository(OrganizationPayment)
        .find(),
      superadmin_notifications: await this.dataSource
        .getRepository(SuperadminNotification)
        .find(),
    };
    return { v: 1, createdAt: new Date().toISOString(), tables };
  }

  async getDownloadStream(filename: string): Promise<StreamableFile> {
    this.assertSafeFilename(filename);
    const filePath = join(this.dir, filename);
    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException('Backup not found');
    }
    const stream = createReadStream(filePath);
    const type = filename.endsWith('.json') ? 'application/json' : 'application/sql';
    return new StreamableFile(stream, {
      type,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  async list() {
    await this.ensureDir();
    const files = await readdir(this.dir);
    const rows = await Promise.all(
      files
        .filter((f) => f.endsWith('.sql') || f.endsWith('.json'))
        .map(async (f) => {
          const p = join(this.dir, f);
          const s = await stat(p);
          return { filename: f, size: s.size, mtimeMs: s.mtimeMs };
        }),
    );
    return rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  async saveUpload(originalName: string, buf: Buffer) {
    await this.ensureDir();
    const safe = originalName.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const name = `${Date.now()}_${safe || 'backup.sql'}`;
    const p = join(this.dir, name);
    await writeFile(p, buf);
    return { filename: name };
  }

  async restore(filename: string, clearAndWrite = true) {
    this.assertSafeFilename(filename);
    const filePath = join(this.dir, filename);
    await this.ensureDir();

    if (filename.endsWith('.json')) {
      const json = await (async () => {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw) as JsonBackupV1;
      })();
      return this.restoreJson(json, clearAndWrite);
    }

    const host = this.config.get<string>('DB_HOST', 'localhost');
    const port = this.config.get<string>('DB_PORT', '5432');
    const username = this.config.get<string>('DB_USERNAME', 'postgres');
    const password = this.config.get<string>('DB_PASSWORD', 'postgres');
    const database = this.config.get<string>('DB_NAME', 'shoxsaroy');

    if (clearAndWrite) {
      await this.dataSource.query('DROP SCHEMA public CASCADE');
      await this.dataSource.query('CREATE SCHEMA public');
    }

    await new Promise<void>((resolve, reject) => {
      execFile(
        'psql',
        [
          '-h',
          host,
          '-p',
          port,
          '-U',
          username,
          '-d',
          database,
          '-f',
          filePath,
        ],
        { env: { ...process.env, PGPASSWORD: password } },
        (err, _stdout, stderr) => {
          if (err) {
            reject(
              new InternalServerErrorException(
                stderr || 'Restore failed (psql)',
              ),
            );
            return;
          }
          resolve();
        },
      );
    });

    return { ok: true, filename, clearAndWrite };
  }

  private async restoreJson(json: JsonBackupV1, clearAndWrite: boolean) {
    if (!json || json.v !== 1 || !json.tables) {
      throw new BadRequestException('Invalid backup json');
    }

    if (clearAndWrite) {
      await this.dataSource.query('DROP SCHEMA public CASCADE');
      await this.dataSource.query('CREATE SCHEMA public');
      // Needed for uuid primary keys default in Postgres
      await this.dataSource.query(
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
      );
      await this.dataSource.synchronize();
    }

    const t = json.tables;
    const tx = async () => {
      const insertMany = async <T>(
        entity: { new (): T },
        rows: unknown[],
      ) => {
        const list = (rows ?? []) as T[];
        if (!list.length) return;
        await this.dataSource.getRepository(entity).insert(list);
      };

      await insertMany(Organization, t.organizations ?? []);
      await insertMany(Branch, t.branches ?? []);
      await insertMany(User, t.users ?? []);
      await insertMany(Block, t.blocks ?? []);
      await insertMany(Floor, t.floors ?? []);
      await insertMany(Apartment, t.apartments ?? []);
      await insertMany(Client, t.clients ?? []);
      await insertMany(Contract, t.contracts ?? []);
      await insertMany(OrganizationPayment, t.organization_payments ?? []);
      await insertMany(
        SuperadminNotification,
        t.superadmin_notifications ?? [],
      );
    };

    try {
      await this.dataSource.transaction(async () => tx());
    } catch (e) {
      throw new InternalServerErrorException(
        e instanceof Error ? e.message : 'Restore failed',
      );
    }

    return { ok: true, filename: 'json', clearAndWrite };
  }
}
