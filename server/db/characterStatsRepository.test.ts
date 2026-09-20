import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { PostgresCharacterStatsRepository } from './characterStatsRepository.ts';

const stats = {
  primaryCharacter: null,
  secondaryCharacters: [],
  characterUsage: [],
  gamesWithCharacterData: 0,
  gamesAnalyzed: 0,
  characterDataCoverage: 0,
  characterConfidence: 'none' as const,
};

describe('PostgresCharacterStatsRepository', () => {
  it('recupera estadísticas persistidas', async () => {
    const calculatedAt = new Date('2026-08-18T10:00:00Z');
    const expiresAt = new Date('2026-08-19T10:00:00Z');
    const query = vi.fn().mockResolvedValue({
      rows: [{ stats, calculated_at: calculatedAt, expires_at: expiresAt }],
    });
    const repository = new PostgresCharacterStatsRepository({ query } as unknown as Pool);

    await expect(repository.get('player-1', '1386', 12)).resolves.toEqual({
      stats,
      calculatedAt,
      expiresAt,
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM player_character_stats'), [
      'player-1',
      '1386',
      12,
    ]);
  });

  it('inserta o actualiza por jugador, videojuego y periodo', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repository = new PostgresCharacterStatsRepository({ query } as unknown as Pool);
    const calculatedAt = new Date('2026-08-18T10:00:00Z');
    const expiresAt = new Date('2026-08-19T10:00:00Z');

    await repository.upsert('player-1', '1386', 12, { stats, calculatedAt, expiresAt });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (player_id, videogame_id, lookback_months)'),
      ['player-1', '1386', 12, JSON.stringify(stats), calculatedAt, expiresAt]
    );
  });

  it('selecciona candidatos recientes todavía no almacenados', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ startgg_player_id: '10' }, { startgg_player_id: '20' }],
    });
    const repository = new PostgresCharacterStatsRepository({ query } as unknown as Pool);

    await expect(repository.listCandidates('1386', 12, 25)).resolves.toEqual(['10', '20']);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN player_character_stats'),
      ['1386', 12, 25]
    );
  });
});
