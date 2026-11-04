import type { Pool } from 'pg';

const HISTORY_IMPORT_LOCK_NAMESPACE = 1386;
const HISTORY_IMPORT_LOCK_KEY = 3;

export async function runWithHistoryImportLock<T>(
  pool: Pool,
  action: () => Promise<T>
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const client = await pool.connect();
  let acquired = false;

  try {
    const lock = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [HISTORY_IMPORT_LOCK_NAMESPACE, HISTORY_IMPORT_LOCK_KEY]
    );
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) return { acquired: false };

    return { acquired: true, value: await action() };
  } finally {
    if (acquired) {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [
        HISTORY_IMPORT_LOCK_NAMESPACE,
        HISTORY_IMPORT_LOCK_KEY,
      ]);
    }
    client.release();
  }
}
