import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { PostgresStartggRateLimiter } from './postgresRateLimiter.ts';

describe('PostgresStartggRateLimiter', () => {
  it('reserva un hueco global sin almacenar el token', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ scheduled_at: new Date() }] });
    const limiter = new PostgresStartggRateLimiter({ query } as unknown as Pool, 'secret', 875);
    await limiter.reserve();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('startgg_api_rate_limits'), [
      expect.stringMatching(/^[a-f0-9]{64}$/),
      875,
    ]);
    expect(query.mock.calls[0][1][0]).not.toBe('secret');
  });
});
