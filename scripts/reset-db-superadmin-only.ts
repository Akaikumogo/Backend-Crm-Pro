/**
 * Deletes all business data and all users except one superadmin.
 * Requires CONFIRM=YES and SUPERADMIN_EMAIL in env.
 *
 * Run: CONFIRM=YES SUPERADMIN_EMAIL=you@x.com npx ts-node -P tsconfig.json scripts/reset-db-superadmin-only.ts
 */
import { Client } from 'pg';

async function main() {
  if (process.env.CONFIRM !== 'YES') {
    console.error('Refusing to run: set environment CONFIRM=YES');
    process.exit(1);
  }
  const email = (process.env.SUPERADMIN_EMAIL ?? '').toLowerCase().trim();
  if (!email) {
    console.error('Set SUPERADMIN_EMAIL to the superadmin account to keep');
    process.exit(1);
  }

  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'shoxsaroy',
  });
  await client.connect();

  try {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'superadmin' AND LOWER(TRIM(email)) = $1`,
      [email],
    );
    if (!rows.length) {
      console.error(`No superadmin user with email ${email}`);
      process.exit(1);
    }
    const keepId = rows[0].id;

    await client.query('BEGIN');
    await client.query(`DELETE FROM contracts`);
    await client.query(`DELETE FROM clients`);
    await client.query(`DELETE FROM apartments`);
    await client.query(`DELETE FROM floors`);
    await client.query(`DELETE FROM blocks`);
    await client.query(`DELETE FROM branches`);
    await client.query(`DELETE FROM organization_payments`);
    await client.query(`DELETE FROM superadmin_notifications`);
    await client.query(`DELETE FROM users WHERE id <> $1`, [keepId]);
    await client.query(`DELETE FROM organizations`);
    await client.query('COMMIT');
    console.log('Done. Only superadmin', email, 'remains; org/branch/building data cleared.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
