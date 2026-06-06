/**
 * Seeds the current backend schema from showroom/src/assets/etaj.
 *
 * It creates:
 * - one organization
 * - one public branch
 * - 3 blocks (A/B/C)
 * - floors from plan/appartment templates
 * - for_sale apartments, numbered by floor (301, 302...)
 */
import { randomUUID } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

type QueryResult<T> = { rows: T[] };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = unknown>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
};

const { Client } = require('pg') as {
  Client: new (config: Record<string, unknown>) => PgClient;
};

type IdRow = { id: string };
type CountRow = { count: string };

function loadDotenv(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

function parseLevels(template: string) {
  return template
    .replace(/\.png$/, '')
    .split('_')
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value));
}

function listTemplateLevels(folder: string) {
  if (!existsSync(folder)) return new Set<number>();
  const levels = new Set<number>();
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.png')) {
      for (const level of parseLevels(entry.name)) levels.add(level);
    }
    if (entry.isDirectory()) {
      for (const level of parseLevels(entry.name)) levels.add(level);
    }
  }
  return levels;
}

function apartmentTemplateForLevel(blockFolder: string, level: number) {
  const folder = resolve(blockFolder, 'appartment');
  if (!existsSync(folder)) return null;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.isDirectory() && parseLevels(entry.name).includes(level)) {
      return resolve(folder, entry.name);
    }
  }
  return null;
}

async function ensureRow(
  client: PgClient,
  selectSql: string,
  selectValues: unknown[],
  insertSql: string,
  insertValues: unknown[],
) {
  const existing = await client.query<IdRow>(selectSql, selectValues);
  if (existing.rows[0]) return existing.rows[0].id;
  const inserted = await client.query<IdRow>(insertSql, insertValues);
  return inserted.rows[0].id;
}

async function main() {
  const backendRoot = resolve(__dirname, '..');
  const workspaceRoot = resolve(backendRoot, '..');
  loadDotenv(resolve(backendRoot, '.env'));

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'shoxsaroy',
  });
  await client.connect();

  const assetsRoot = resolve(workspaceRoot, 'showroom/src/assets/etaj');
  if (!existsSync(assetsRoot)) {
    throw new Error(`Assets folder not found: ${assetsRoot}`);
  }

  try {
    await client.query('BEGIN');

    const organizationId = await ensureRow(
      client,
      `SELECT id FROM organizations WHERE name = $1`,
      ['Shohsaroy'],
      `INSERT INTO organizations (
        id, name, "isBlocked", "blockedAt", "blockedReason", "isVip",
        "paymentDueAt", "lastNotifiedPaymentDueAt", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, false, NULL, NULL, true, NULL, NULL, now(), now())
      RETURNING id`,
      [randomUUID(), 'Shohsaroy'],
    );

    const branchId = await ensureRow(
      client,
      `SELECT id FROM branches WHERE "organizationId" = $1 AND code = $2`,
      [organizationId, 'showroom'],
      `INSERT INTO branches (
        id, name, code, "organizationId", "isBlocked", "blockedAt",
        "blockedReason", "isVip", "mqttUrl", "mqttUsername",
        "mqttPasswordEncrypted", "mqttTopic", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, false, NULL, NULL, true, NULL, NULL, NULL, NULL, now(), now())
      RETURNING id`,
      [randomUUID(), 'Showroom', 'showroom', organizationId],
    );

    let blocks = 0;
    let floors = 0;
    let apartments = 0;

    for (const blockNumber of [1, 2, 3]) {
      const blockFolder = resolve(assetsRoot, `blok ${blockNumber}`);
      if (!existsSync(blockFolder)) continue;
      const code = ['A', 'B', 'C'][blockNumber - 1];
      const blockId = await ensureRow(
        client,
        `SELECT id FROM blocks WHERE "branchId" = $1 AND code = $2`,
        [branchId, code],
        `INSERT INTO blocks (id, code, name, "branchId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, now(), now())
         RETURNING id`,
        [randomUUID(), code, `${blockNumber}-blok`, branchId],
      );
      blocks += 1;

      const levels = new Set<number>([
        ...listTemplateLevels(resolve(blockFolder, 'plan')),
        ...listTemplateLevels(resolve(blockFolder, 'appartment')),
      ]);
      const sortedLevels = [...levels].sort((a, b) => a - b);

      for (const level of sortedLevels) {
        const floorId = await ensureRow(
          client,
          `SELECT id FROM floors WHERE "blockId" = $1 AND level = $2`,
          [blockId, level],
          `INSERT INTO floors (
            id, level, name, "planImageUrl", hotspots, "blockId", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, NULL, NULL, $4, now(), now())
          RETURNING id`,
          [randomUUID(), level, `${level}-etaj`, blockId],
        );
        floors += 1;

        const apartmentFolder = apartmentTemplateForLevel(blockFolder, level);
        if (!apartmentFolder) continue;
        const units = readdirSync(apartmentFolder, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
          .map((entry) => Number(entry.name.replace(/\.png$/, '')))
          .filter((unit) => Number.isInteger(unit))
          .sort((a, b) => a - b);

        for (const unit of units) {
          const number = `${level * 100 + unit}`;
          const exists = await client.query<CountRow>(
            `SELECT count(*)::text AS count FROM apartments WHERE "floorId" = $1 AND number = $2`,
            [floorId, number],
          );
          if (Number(exists.rows[0]?.count ?? 0) > 0) continue;
          await client.query(
            `INSERT INTO apartments (
              id, number, status, "areaSqm", rooms, "priceTotal", "pricePerSqm",
              "imageUrl", "floorId", "soldById", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, 'for_sale', NULL, NULL, NULL, NULL, NULL, $3, NULL, now(), now())`,
            [randomUUID(), number, floorId],
          );
          apartments += 1;
        }
      }
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        { ok: true, organizationId, branchId, blocks, floors, apartments },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
