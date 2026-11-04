import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { parseImportOptions } from './importOptions.ts';
import { importUltimateHistory } from '../history/historyImporter.ts';
import { runWithHistoryImportLock } from '../history/historyImportLock.ts';
import { PostgresHistoryRepository } from '../history/postgresHistoryRepository.ts';
import { StartggHistorySource } from '../history/startggHistorySource.ts';
import { StartggClient } from '../startgg/startggClient.ts';
import { PostgresStartggRateLimiter } from '../startgg/postgresRateLimiter.ts';

function loadProjectEnvironment() {
  for (const filename of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), filename);
    if (existsSync(path)) loadEnvFile(path);
  }
}

function addOneMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()));
}

function createImportSummary() {
  return { tournamentsSeen: 0, tournamentsSaved: 0, setsSaved: 0 };
}

async function main() {
  loadProjectEnvironment();

  const apiKey = process.env.STARTGG_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!apiKey) throw new Error('Falta configurar `STARTGG_API_KEY` en `.env.local`.');
  if (!databaseUrl) throw new Error('Falta configurar `DATABASE_URL` en `.env.local`.');

  const options = parseImportOptions(process.argv.slice(2));
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const source = new StartggHistorySource(
      new StartggClient(apiKey, {
        maxRetries: 0,
        rateLimiter: new PostgresStartggRateLimiter(pool, apiKey),
      })
    );
    const repository = new PostgresHistoryRepository(pool);
    const importRun = await runWithHistoryImportLock(pool, async () => {
      const summary = createImportSummary();
      const intervals: Array<{ from: string; to: string }> = [];
      let from = options.from;
      let to = options.to;
      let firstInterval = true;

      while (true) {
        const remainingLimit =
          options.maxTournaments === undefined
            ? undefined
            : options.maxTournaments - summary.tournamentsSeen;
        if (remainingLimit !== undefined && remainingLimit <= 0) break;

        const interval = { from: from.toISOString(), to: to.toISOString() };
        const result = await importUltimateHistory(source, repository, {
          ...options,
          from,
          to,
          maxTournaments: remainingLimit,
          refresh: firstInterval && options.refresh,
        });
        intervals.push(interval);
        summary.tournamentsSeen += result.tournamentsSeen;
        summary.tournamentsSaved += result.tournamentsSaved;
        summary.setsSaved += result.setsSaved;

        if (options.maxTournaments === undefined || !result.completed) {
          break;
        }

        from = to;
        to = addOneMonth(to);
        firstInterval = false;
      }

      return { ...summary, intervals };
    });

    if (!importRun.acquired) {
      console.log('Ya hay un importador histórico activo; se conserva su cursor persistente.');
      return;
    }

    const importSummary = importRun.value;

    console.log(
      JSON.stringify(
        {
          interval: {
            from: options.from.toISOString(),
            to: options.to.toISOString(),
          },
          ...importSummary,
          ratingPeriodsProcessed: 0,
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
  console.error(
    error instanceof Error ? error.message : 'Error desconocido al importar el historial.'
  );
  process.exitCode = 1;
});
