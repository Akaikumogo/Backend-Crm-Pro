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
      !filename.endsWith('.sql')
    ) {
      throw new BadRequestException('Invalid filename');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
  }

  async createDump() {
    await this.ensureDir();
    const name = `db_${Date.now()}.sql`;
    const filePath = join(this.dir, name);

    const host = this.config.get<string>('DB_HOST', 'localhost');
    const port = this.config.get<string>('DB_PORT', '5432');
    const username = this.config.get<string>('DB_USERNAME', 'postgres');
    const password = this.config.get<string>('DB_PASSWORD', 'postgres');
    const database = this.config.get<string>('DB_NAME', 'shoxsaroy');

    await new Promise<void>((resolve, reject) => {
      execFile(
        'pg_dump',
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
          '--no-owner',
          '--no-acl',
        ],
        { env: { ...process.env, PGPASSWORD: password }, maxBuffer: 1024 * 1024 * 512 },
        (err, _stdout, stderr) => {
          if (err) {
            reject(
              new InternalServerErrorException(stderr || 'pg_dump failed'),
            );
            return;
          }
          resolve();
        },
      );
    });

    const s = await stat(filePath);
    return { filename: name, size: s.size };
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
    return new StreamableFile(stream, {
      type: 'application/sql',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  async list() {
    await this.ensureDir();
    const files = await readdir(this.dir);
    const rows = await Promise.all(
      files
        .filter((f) => f.endsWith('.sql'))
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
}
