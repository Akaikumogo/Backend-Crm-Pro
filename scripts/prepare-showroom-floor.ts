/**
 * Creates missing target floors in SHOWROOM_BLOCK_ID and clones apartments from
 * SHOWROOM_SOURCE_FLOOR_ID as for_sale, shifting numeric apartment numbers by
 * floor delta * SHOWROOM_SHIFT_STEP. Also remaps hotspots to new apartment IDs.
 *
 * Required env:
 * SHOWROOM_BLOCK_ID=uuid
 * SHOWROOM_SOURCE_FLOOR_ID=uuid
 * SHOWROOM_TARGET_FLOOR_LEVELS=2,3,4
 *
 * Optional:
 * SHOWROOM_SHIFT_STEP=100
 * SHOWROOM_COPY_PLAN=true
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

type QueryResult<T> = { rows: T[] };
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = unknown>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
};

const { Client } = require('pg') as {
  Client: new (config: Record<string, unknown>) => PgClient;
};

type SourceFloor = {
  id: string;
  level: number;
  name: string | null;
  planImageUrl: string | null;
  hotspots: unknown[] | null;
  blockId: string;
};

type ApartmentRow = {
  id: string;
  number: string;
  areaSqm: string | null;
  rooms: number | null;
  priceTotal: string | null;
  pricePerSqm: string | null;
  imageUrl: string | null;
};

type FloorRow = {
  id: string;
  level: number;
};

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

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} in backend/.env`);
  }
  return value;
}

function parseLevels(value: string) {
  const levels = value
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isInteger(x));
  if (!levels.length) {
    throw new Error('SHOWROOM_TARGET_FLOOR_LEVELS must contain numbers');
  }
  return [...new Set(levels)].sort((a, b) => a - b);
}

function transformNumber(
  numberStr: string,
  sourceLevel: number,
  targetLevel: number,
  shiftStep: number,
) {
  const trimmed = numberStr.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  if (!Number.isSafeInteger(number)) return null;
  return String(number + (targetLevel - sourceLevel) * shiftStep);
}

async function main() {
  loadDotenv(resolve(__dirname, '..', '.env'));

  const blockId = requiredEnv('SHOWROOM_BLOCK_ID');
  const sourceFloorId = requiredEnv('SHOWROOM_SOURCE_FLOOR_ID');
  const targetLevels = parseLevels(requiredEnv('SHOWROOM_TARGET_FLOOR_LEVELS'));
  const shiftStep = Number(process.env.SHOWROOM_SHIFT_STEP ?? '100');
  const copyPlan = process.env.SHOWROOM_COPY_PLAN !== 'false';

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'shoxsaroy',
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    const sourceResult = await client.query<SourceFloor>(
      `SELECT id, level, name, "planImageUrl", hotspots, "blockId"
       FROM floors
       WHERE id = $1`,
      [sourceFloorId],
    );
    const source = sourceResult.rows[0];
    if (!source) throw new Error('SHOWROOM_SOURCE_FLOOR_ID not found');
    if (source.blockId !== blockId) {
      throw new Error(
        'SHOWROOM_SOURCE_FLOOR_ID is not inside SHOWROOM_BLOCK_ID',
      );
    }

    const apartmentsResult = await client.query<ApartmentRow>(
      `SELECT id, number, "areaSqm", rooms, "priceTotal", "pricePerSqm", "imageUrl"
       FROM apartments
       WHERE "floorId" = $1
       ORDER BY number ASC`,
      [sourceFloorId],
    );
    if (!apartmentsResult.rows.length) {
      throw new Error('Source floor has no apartments to clone');
    }

    let floorsCreated = 0;
    let apartmentsCreated = 0;
    let skippedConflict = 0;
    let skippedNonNumeric = 0;

    for (const level of targetLevels) {
      if (level === source.level) continue;

      const floorResult = await client.query<FloorRow>(
        `SELECT id, level FROM floors WHERE "blockId" = $1 AND level = $2`,
        [blockId, level],
      );
      let targetFloor = floorResult.rows[0];
      if (!targetFloor) {
        const inserted = await client.query<FloorRow>(
          `INSERT INTO floors (id, level, name, "planImageUrl", hotspots, "blockId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, NULL, $5, now(), now())
           RETURNING id, level`,
          [
            randomUUID(),
            level,
            `${level}-etaj`,
            copyPlan ? source.planImageUrl : null,
            blockId,
          ],
        );
        targetFloor = inserted.rows[0];
        floorsCreated += 1;
      }

      const aptIdMap = new Map<string, string>();
      for (const apartment of apartmentsResult.rows) {
        const number = transformNumber(
          apartment.number,
          source.level,
          level,
          shiftStep,
        );
        if (!number) {
          skippedNonNumeric += 1;
          continue;
        }

        const exists = await client.query<{ id: string }>(
          `SELECT id FROM apartments WHERE "floorId" = $1 AND number = $2`,
          [targetFloor.id, number],
        );
        if (exists.rows[0]) {
          skippedConflict += 1;
          aptIdMap.set(apartment.id, exists.rows[0].id);
          continue;
        }

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO apartments (
             id, number, status, "areaSqm", rooms, "priceTotal", "pricePerSqm",
             "imageUrl", "floorId", "soldById", "createdAt", "updatedAt"
           )
           VALUES (
             $1, $2, 'for_sale', $3, $4, $5, $6,
             $7, $8, NULL, now(), now()
           )
           RETURNING id`,
          [
            randomUUID(),
            number,
            apartment.areaSqm,
            apartment.rooms,
            apartment.priceTotal,
            apartment.pricePerSqm,
            apartment.imageUrl,
            targetFloor.id,
          ],
        );
        aptIdMap.set(apartment.id, inserted.rows[0].id);
        apartmentsCreated += 1;
      }

      if (copyPlan) {
        const hotspots: unknown[] | null = Array.isArray(source.hotspots)
          ? source.hotspots.map((item: unknown) => {
              if (!item || typeof item !== 'object') return item;
              const hotspot = item as { apartmentId?: string };
              return {
                ...hotspot,
                apartmentId: hotspot.apartmentId
                  ? (aptIdMap.get(hotspot.apartmentId) ?? hotspot.apartmentId)
                  : hotspot.apartmentId,
              };
            })
          : source.hotspots;
        await client.query(
          `UPDATE floors
           SET "planImageUrl" = $1, hotspots = $2, "updatedAt" = now()
           WHERE id = $3`,
          [source.planImageUrl, JSON.stringify(hotspots), targetFloor.id],
        );
      }
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          ok: true,
          blockId,
          sourceFloorId,
          targetLevels,
          floorsCreated,
          apartmentsCreated,
          skippedConflict,
          skippedNonNumeric,
        },
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
