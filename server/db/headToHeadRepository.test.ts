import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PostgresHeadToHeadRepository } from './headToHeadRepository';

describe('PostgresHeadToHeadRepository', () => {
  it('devuelve todo el historial local entre ambos jugadores', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          startgg_set_id: 'set-1',
          winner_player_id: '100',
          display_score: 'Player 1 3 - Player 2 2',
          completed_at: new Date('2026-01-01T00:00:00Z'),
          event_name: 'Singles',
          tournament_name: 'Tournament',
          player1_tag: 'Player 1',
          player2_tag: 'Player 2',
        },
      ],
    });
    const repository = new PostgresHeadToHeadRepository({ query } as unknown as Pool);

    const history = await repository.getHistory('100', '200', 1386);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: 'set-1', winnerPlayerId: '100' });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY sets.completed_at DESC'), [
      '100',
      '200',
      1386,
    ]);
  });
});
