import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { logger } from '../utils/logger.ts';
import { readTournamentTierWorkbook } from '../tournaments/tournamentTierImporter.ts';
import { TournamentTierRepository } from '../tournaments/tournamentTierRepository.ts';
import { parseTournamentTierImportOptions } from './tournamentTierImportOptions.ts';

function loadProjectEnvironment() {
  for (const filename of ['.env', '.env.local']) {
    const path = resolve(process.cwd(), filename);
    if (existsSync(path)) loadEnvFile(path);
  }
}

async function main() {
  loadProjectEnvironment();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Falta configurar `DATABASE_URL` en `.env.local`.');

  const options = parseTournamentTierImportOptions(process.argv.slice(2));
  const parsed = await readTournamentTierWorkbook(resolve(options.filePath), options.sheetName);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const imported = await new TournamentTierRepository(pool).import(parsed.records);
    console.log(
      JSON.stringify(
        {
          rowsRead: parsed.rowsRead,
          updated: imported.updated,
          unchanged: imported.unchanged,
          unsupported: parsed.unsupportedLinks.length,
          notFound: imported.notFound.length,
          rejected: parsed.rejected.length,
          unsupportedLinks: parsed.unsupportedLinks,
          notFoundSlugs: imported.notFound,
          rejectedRows: parsed.rejected,
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
  logger.error(
    error instanceof Error ? error.message : 'Error desconocido al importar tiers de torneos.',
    error
  );
  process.exitCode = 1;
});
