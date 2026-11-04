import type { PoolClient } from 'pg';

export const RATING_LOCK_NAMESPACE = 1386;
export const RATING_WORKER_LOCK = 2;

export async function lockRatingData(client: PoolClient) {
  await client.query('SELECT pg_advisory_xact_lock($1, $2)', [RATING_LOCK_NAMESPACE, 1]);
}
