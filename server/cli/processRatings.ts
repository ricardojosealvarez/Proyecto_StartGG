import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { processPendingRatingPeriods } from '../ratings/ratingPeriodProcessor.ts';

async function main() {
  for (const filename of ['.env', '.env.local']) {
    if (existsSync(filename)) loadEnvFile(filename);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta configurar `DATABASE_URL`.');

  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => !/^--max-periods=\d+$/.test(arg))) {
    throw new Error('Uso: npm run ratings:process -- [--max-periods=<entero positivo>]');
  }
  const maxPeriods = args.length ? Number(args[0].split('=')[1]) : undefined;
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: 'startgg-ratings-worker',
    connectionTimeoutMillis: 5000,
    statement_timeout: 120000,
  });
  try {
    const startedAt = performance.now();
    const processed = await processPendingRatingPeriods(pool, {
      maxPeriods,
      onPeriod: (period) => console.log(JSON.stringify({ type: 'period', ...period })),
    });
    console.log(
      JSON.stringify({
        type: 'summary',
        periodsProcessed: processed.length,
        elapsedMs: Math.round(performance.now() - startedAt),
      })
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Error al procesar Glicko-2.');
  process.exitCode = 1;
});
