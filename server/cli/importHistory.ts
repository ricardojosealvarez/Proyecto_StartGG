import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { parseImportOptions } from './importOptions.ts';
import { importUltimateHistory } from '../history/historyImporter.ts';
import { PostgresHistoryRepository } from '../history/postgresHistoryRepository.ts';
import { StartggHistorySource } from '../history/startggHistorySource.ts';
import { processPendingRatingPeriods } from '../ratings/ratingPeriodProcessor.ts';
import { StartggClient } from '../startgg/startggClient.ts';

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

  const options = parseImportOptions(process.argv.slice(2));
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const source = new StartggHistorySource(new StartggClient(apiKey));
    const repository = new PostgresHistoryRepository(pool);
    const importSummary = await importUltimateHistory(source, repository, options);
    const processedPeriods = await processPendingRatingPeriods(pool);

    console.log(
      JSON.stringify(
        {
          interval: {
            from: options.from.toISOString(),
            to: options.to.toISOString(),
          },
          ...importSummary,
          ratingPeriodsProcessed: processedPeriods.length,
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
