import type { Pool, PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { runWithHistoryImportLock } from './historyImportLock.ts';

function createPool(acquired: boolean) {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [{ acquired }] })
    .mockResolvedValue({ rows: [] });
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  return { pool: { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool, query, release };
}

describe('runWithHistoryImportLock', () => {
  it('ejecuta y libera el bloqueo exclusivo', async () => {
    const { pool, query, release } = createPool(true);
    const action = vi.fn().mockResolvedValue('imported');

    await expect(runWithHistoryImportLock(pool, action)).resolves.toEqual({
      acquired: true,
      value: 'imported',
    });

    expect(query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1, $2) AS acquired', [
      1386,
      3,
    ]);
    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [1386, 3]);
    expect(release).toHaveBeenCalledOnce();
  });

  it('no inicia una segunda importación mientras el bloqueo está ocupado', async () => {
    const { pool, query, release } = createPool(false);
    const action = vi.fn();

    await expect(runWithHistoryImportLock(pool, action)).resolves.toEqual({ acquired: false });

    expect(action).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalledWith('SELECT pg_advisory_unlock($1, $2)', [1386, 3]);
    expect(release).toHaveBeenCalledOnce();
  });
});
