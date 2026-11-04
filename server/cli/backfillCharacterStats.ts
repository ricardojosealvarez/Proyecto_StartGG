import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { CHARACTER_LOOKBACK_MONTHS } from '../characters/characterStats.ts';
import { PlayerCharacterService } from '../characters/playerCharacterService.ts';
import { PostgresCharacterStatsRepository } from '../db/characterStatsRepository.ts';
import { StartggClient } from '../startgg/startggClient.ts';
import { PostgresStartggRateLimiter } from '../startgg/postgresRateLimiter.ts';
import {
  isCharacterBackfillRateLimit,
  parseCharacterBackfillOptions,
} from './characterBackfillOptions.ts';

const ULTIMATE_VIDEOGAME_ID = '1386';
const REQUEST_INTERVAL_MS = 1_000;

function loadProjectEnvironment() {
  for (const filename of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), filename);
    if (existsSync(path)) loadEnvFile(path);
  }
}

async function main() {
  loadProjectEnvironment();
  const apiKey = process.env.STARTGG_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!apiKey) throw new Error('Falta configurar `STARTGG_API_KEY` en `.env.local`.');
  if (!databaseUrl) throw new Error('Falta configurar `DATABASE_URL` en `.env.local`.');

  const { maxPlayers } = parseCharacterBackfillOptions(process.argv.slice(2));
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const repository = new PostgresCharacterStatsRepository(pool);
    const candidates = await repository.listCandidates(
      ULTIMATE_VIDEOGAME_ID,
      CHARACTER_LOOKBACK_MONTHS,
      maxPlayers
    );
    const service = new PlayerCharacterService(
      new StartggClient(apiKey, {
        minimumRequestIntervalMs: REQUEST_INTERVAL_MS,
        maxRetries: 0,
        rateLimiter: new PostgresStartggRateLimiter(pool, apiKey),
      }),
      undefined,
      undefined,
      repository
    );
    const loaded: string[] = [];
    let stoppedByRateLimit = false;

    for (const playerId of candidates) {
      try {
        await service.getPlayerCharacterStats(playerId, ULTIMATE_VIDEOGAME_ID, {
          forceRefresh: true,
        });
        loaded.push(playerId);
      } catch (error) {
        if (isCharacterBackfillRateLimit(error)) {
          stoppedByRateLimit = true;
          break;
        }
        throw error;
      }
    }

    console.log(
      JSON.stringify(
        {
          requested: maxPlayers,
          candidates: candidates.length,
          loaded: loaded.length,
          playerIds: loaded,
          stoppedByRateLimit,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Error desconocido en la carga.');
  process.exitCode = 1;
});
