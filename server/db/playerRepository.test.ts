import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresPlayerRepository } from './playerRepository';

describe('PostgresPlayerRepository', () => {
  it('busca por gamer_tag y devuelve identificadores de Start.gg', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ startgg_player_id: '123', gamer_tag: 'MkLeo' }],
    });
    const repository = new PostgresPlayerRepository({ query } as unknown as Pool);

    await expect(repository.searchByGamerTag('  leo  ', 8)).resolves.toEqual([
      { id: '123', gamerTag: 'MkLeo', user: null },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('gamer_tag ILIKE'), ['leo', 8]);
  });
});
