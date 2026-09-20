import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type { TournamentTierRecord } from './tournamentTierImporter.ts';

interface TournamentTierRow extends QueryResultRow {
  id: string;
  startgg_url: string | null;
  tier_points: number | null;
  tier: string | null;
}

export interface TournamentTierImportResult {
  updated: number;
  unchanged: number;
  notFound: string[];
}

function isUnchanged(row: TournamentTierRow, record: TournamentTierRecord) {
  return (
    row.startgg_url === record.startggUrl &&
    row.tier_points === record.tierPoints &&
    row.tier === record.tier
  );
}

async function importRecord(client: PoolClient, record: TournamentTierRecord) {
  const result = await client.query<TournamentTierRow>(
    `
      SELECT id, startgg_url, tier_points, tier
      FROM tournaments
      WHERE slug = $1
      FOR UPDATE
    `,
    [record.slug]
  );
  const tournament = result.rows[0];
  if (!tournament) return 'not-found';
  if (isUnchanged(tournament, record)) return 'unchanged';

  await client.query(
    `
      UPDATE tournaments
      SET startgg_url = $1, tier_points = $2, tier = $3, updated_at = NOW()
      WHERE id = $4
    `,
    [record.startggUrl, record.tierPoints, record.tier, tournament.id]
  );
  return 'updated';
}

export class TournamentTierRepository {
  constructor(private readonly pool: Pool) {}

  async import(records: TournamentTierRecord[]): Promise<TournamentTierImportResult> {
    const client = await this.pool.connect();
    const summary: TournamentTierImportResult = { updated: 0, unchanged: 0, notFound: [] };

    try {
      await client.query('BEGIN');
      for (const record of records) {
        const result = await importRecord(client, record);
        if (result === 'not-found') summary.notFound.push(record.slug);
        else summary[result] += 1;
      }
      await client.query('COMMIT');
      return summary;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
