import { Pool } from 'pg';
import { loadEnvFile } from 'node:process';
loadEnvFile('.env.local');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const queries = {
  progress: 'SELECT * FROM history_import_progress',
  counts: "SELECT count(*) FILTER (WHERE status='completed') completed,count(*) FILTER (WHERE status='pending') pending,count(*) total FROM rating_periods",
  totals: 'SELECT (SELECT count(*) FROM tournaments) tournaments,(SELECT count(*) FROM sets) sets',
  locks: "SELECT l.pid,l.classid,l.objid,a.query,a.state FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory'",
  sessions: 'SELECT pid,usename,state,query FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()'
  ,rate: 'SELECT next_request_at FROM startgg_api_rate_limits ORDER BY next_request_at DESC LIMIT 1'
};
for (const [name, sql] of Object.entries(queries)) {
  const result = await pool.query(sql);
  console.log(`---${name}`);
  console.log(JSON.stringify(result.rows));
}
await pool.end();
