import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, createPool } from './db';

/** Applies SQL migrations from apps/api/drizzle. Used locally and in the Render build. */
export async function runMigrations(connectionString: string) {
  const pool = createPool(connectionString);
  try {
    await migrate(createDb(pool), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('✓ Migrations applied'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
