import { loadEnvFile } from 'node:process';
import { Pool } from 'pg';
loadEnvFile('.env.local');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const queries = [
  'SELECT scope_key,tournament_page,tournament_index,status,updated_at FROM history_import_progress ORDER BY updated_at DESC',
  'SELECT (SELECT COUNT(*)::int FROM tournaments) tournaments, (SELECT COUNT(*)::int FROM sets) sets, (SELECT COUNT(*)::int FROM rating_periods) periods, (SELECT COUNT(*)::int FROM rating_periods WHERE status=\'completed\') completed, (SELECT COUNT(*)::int FROM rating_periods WHERE status=\'pending\') pending',
  'SELECT COUNT(*) FILTER (WHERE startgg_set_id IS NULL)::int null_ids, (COUNT(*)-COUNT(DISTINCT startgg_set_id))::int dupes FROM sets',
  'SELECT classid,objid,pid,granted FROM pg_locks WHERE locktype=\'advisory\' AND classid=1386',
  'SELECT pid,state,query FROM pg_stat_activity WHERE datname=current_database() AND state<>\'idle\''
];
for (const query of queries) { console.log('---'); console.log((await pool.query(query)).rows); }
await pool.end();
