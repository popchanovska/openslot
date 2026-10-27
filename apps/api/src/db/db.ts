import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/** Nest injection token for the Drizzle client. */
export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export function createPool(connectionString: string) {
  return new Pool({ connectionString, max: 5, ssl: needsTls(connectionString) ? { rejectUnauthorized: false } : undefined });
}

/**
 * Public hosted databases (Render's external URL, Neon) require TLS. Local Docker and
 * Render's internal URL (a host with no dots, e.g. dpg-abc123-a) don't use it.
 */
function needsTls(connectionString: string) {
  if (/sslmode=disable/.test(connectionString)) return false;
  if (/sslmode=require/.test(connectionString)) return true;
  try {
    const host = new URL(connectionString).hostname;
    return host.includes('.') && host !== '127.0.0.1';
  } catch {
    return false;
  }
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema });
}

/** Postgres error code, unwrapping Drizzle's query error wrapper. */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  EXCLUSION_VIOLATION: '23P01',
} as const;
