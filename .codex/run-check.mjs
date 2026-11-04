import pg from 'pg';
import fs from 'fs';
const url = fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const c = new pg.Client({ connectionString: url });
await c.connect();
const qs = [
  "SELECT 'cursor|'||scope_key||'|'||tournament_page||'|'||tournament_index||'|'||status FROM history_import_progress ORDER BY updated_at DESC LIMIT 10",
  "SELECT 'locks|'||COALESCE(string_agg(classid||','||objid,','),'none') FROM pg_locks WHERE locktype='advisory' AND granted",
  "SELECT 'sessions|'||count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()",
  "SELECT 'periods|'||count(*)||'|'||count(*) FILTER (WHERE status='completed')||'|'||count(*) FILTER (WHERE status<>'completed') FROM rating_periods",
  "SELECT 'counts|'||(SELECT count(*) FROM tournaments)||'|'||(SELECT count(*) FROM sets)"
];
for (const q of qs) { const r = await c.query(q); for (const x of r.rows) console.log(Object.values(x)[0]); }
await c.end();
