import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

const DEFAULT_REQUEST_INTERVAL_MS = 875;

export interface RequestRateLimiter {
  reserve(): Promise<void>;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export class PostgresStartggRateLimiter implements RequestRateLimiter {
  private readonly tokenHash: string;

  constructor(
    private readonly pool: Pool,
    apiKey: string,
    private readonly requestIntervalMs = DEFAULT_REQUEST_INTERVAL_MS
  ) {
    this.tokenHash = createHash('sha256').update(apiKey).digest('hex');
  }

  async reserve() {
    const result = await this.pool.query<{ scheduled_at: Date }>(
      `
        INSERT INTO startgg_api_rate_limits (token_hash, next_request_at)
        VALUES ($1, NOW() + $2 * INTERVAL '1 millisecond')
        ON CONFLICT (token_hash) DO UPDATE SET
          next_request_at = GREATEST(startgg_api_rate_limits.next_request_at, NOW())
            + $2 * INTERVAL '1 millisecond'
        RETURNING next_request_at - $2 * INTERVAL '1 millisecond' AS scheduled_at
      `,
      [this.tokenHash, this.requestIntervalMs]
    );
    const waitMs = Math.max(0, result.rows[0].scheduled_at.getTime() - Date.now());
    if (waitMs > 0) await sleep(waitMs);
  }
}
