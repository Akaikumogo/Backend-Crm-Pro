import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const BACKUPS_DIR = join(process.cwd(), 'backups');

const TABLES_TO_BACKUP = [
  'organizations',
  'branches',
  'users',
  'blocks',
  'floors',
  'apartments',
  'clients',
  'contracts',
  'organization_payments',
  'superadmin_notifications',
];

/** Splits SQL text into individual statements, respecting dollar-quoted blocks. */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';
  let i = 0;

  while (i < sql.length) {
    // Skip single-line comments when not in a dollar-quote
    if (!inDollarQuote && sql[i] === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }

    if (!inDollarQuote && sql[i] === '$') {
      // Find the closing $ of the tag (e.g. "$" or "$tag$")
      const end = sql.indexOf('$', i + 1);
      if (end !== -1) {
        const tag = sql.slice(i, end + 1);
        inDollarQuote = true;
        dollarTag = tag;
        current += tag;
        i = end + 1;
        continue;
      }
    } else if (inDollarQuote && sql.slice(i, i + dollarTag.length) === dollarTag) {
      current += dollarTag;
      i += dollarTag.length;
      inDollarQuote = false;
      dollarTag = '';
      continue;
    }

    if (!inDollarQuote && sql[i] === ';') {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    } else {
      current += sql[i];
    }
    i++;
  }

  const last = current.trim();
  if (last) statements.push(last);

  return statements.filter((s) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > 0 && !t.startsWith('--');
  });
}

@Injectable()
export class MigrationRunnerService implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(
    @InjectDataSource()
    private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.run();
    } catch (err) {
      this.logger.error(
        `MigrationRunner kritik xato: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async run() {
    await this.ensureTrackingTable();
    const pending = await this.pendingFiles();

    if (!pending.length) {
      this.logger.log('Migrations: barcha migratsiyalar allaqachon qo\'llanilgan');
      return;
    }

    this.logger.log(
      `Migrations: ${pending.length} ta yangi SQL topildi: [${pending.join(', ')}]`,
    );
    this.logger.log('Migrations: migratsiyadan oldin backup olinmoqda...');
    const backupFile = await this.takeJsonBackup();
    this.logger.log(`Migrations: backup saqlandi -> backups/${backupFile}`);

    for (const filename of pending) {
      await this.applyFile(filename);
    }

    this.logger.log(`Migrations: ${pending.length} ta migratsiya muvaffaqiyatli qo'llanildi`);
  }

  private async ensureTrackingTable() {
    await this.ds.query(`
      CREATE TABLE IF NOT EXISTS __applied_migrations (
        id        SERIAL      PRIMARY KEY,
        filename  TEXT        UNIQUE NOT NULL,
        appliedAt TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  private async pendingFiles(): Promise<string[]> {
    let files: string[];
    try {
      files = await readdir(MIGRATIONS_DIR);
    } catch {
      return [];
    }

    const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
    if (!sqlFiles.length) return [];

    const rows = await this.ds.query<{ filename: string }[]>(
      'SELECT filename FROM __applied_migrations',
    );
    const applied = new Set(rows.map((r) => r.filename));
    return sqlFiles.filter((f) => !applied.has(f));
  }

  private async takeJsonBackup(): Promise<string> {
    await mkdir(BACKUPS_DIR, { recursive: true });

    const tables: Record<string, unknown[]> = {};
    for (const tbl of TABLES_TO_BACKUP) {
      try {
        tables[tbl] = await this.ds.query(`SELECT * FROM "${tbl}"`);
      } catch {
        tables[tbl] = [];
      }
    }

    const snapshot = {
      v: 1,
      createdAt: new Date().toISOString(),
      reason: 'pre-migration-auto-backup',
      tables,
    };

    const filename = `pre_migration_${Date.now()}.json`;
    await writeFile(
      join(BACKUPS_DIR, filename),
      JSON.stringify(snapshot, null, 2),
    );
    return filename;
  }

  private async applyFile(filename: string) {
    const filePath = join(MIGRATIONS_DIR, filename);
    const raw = await readFile(filePath, 'utf8');
    const statements = splitSqlStatements(raw);

    this.logger.log(
      `Migration qo'llanilmoqda: ${filename} (${statements.length} ta statement)`,
    );

    for (const stmt of statements) {
      try {
        await this.ds.query(stmt);
      } catch (err) {
        const pgCode = (err as { code?: string }).code;
        if (this.isIdempotentError(pgCode)) {
          this.logger.warn(
            `  SKIP (${filename}): allaqachon mavjud [${pgCode}] — ${stmt.slice(0, 80)}...`,
          );
          continue;
        }
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`  XATO (${filename}): ${msg}\n  SQL: ${stmt}`);
        throw err;
      }
    }

    await this.ds.query(
      'INSERT INTO __applied_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [filename],
    );
    this.logger.log(`  OK: ${filename}`);
  }

  /**
   * PostgreSQL DDL "already exists" error codes — migration idempotency.
   * 42710 = duplicate_object (type/role/schema)
   * 42P07 = duplicate_table
   * 42701 = duplicate_column
   * 42723 = duplicate_function
   * 42P16 = invalid_table_definition (constraints)
   */
  private isIdempotentError(code: string | undefined): boolean {
    return ['42710', '42P07', '42701', '42723', '42P16'].includes(code ?? '');
  }

  /** Manual trigger endpoint uchun (admin panel) */
  async runManually(): Promise<{ applied: string[]; backup: string | null }> {
    await this.ensureTrackingTable();
    const pending = await this.pendingFiles();
    if (!pending.length) {
      return { applied: [], backup: null };
    }
    const backupFile = await this.takeJsonBackup();
    for (const f of pending) {
      await this.applyFile(f);
    }
    return { applied: pending, backup: backupFile };
  }
}
