import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
import { rebuildRatings } from '../ratings/rebuildRatings.ts';

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

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log(JSON.stringify(await rebuildRatings(pool), null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Error desconocido al recalcular Glicko-2.'
  );
  process.exitCode = 1;
});
