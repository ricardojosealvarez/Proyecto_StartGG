import { describe, expect, it, vi } from 'vitest';
import { StartggClient } from './startggClient.ts';

function createResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('StartggClient', () => {
  it('envía el token y devuelve los datos GraphQL', async () => {
    const fetcher = vi.fn().mockResolvedValue(createResponse({ data: { value: 42 } }));
    const client = new StartggClient('secret-token', {
      fetcher,
      minimumRequestIntervalMs: 0,
    });

    const result = await client.request<{ value: number }>('query Test { value }', {
      page: 1,
    });

    expect(result).toEqual({ value: 42 });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.start.gg/gql/alpha',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      })
    );
  });

  it('reintenta una respuesta limitada antes de completar', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(createResponse({ message: 'Rate limit exceeded - api-token' }, 429))
      .mockResolvedValueOnce(createResponse({ data: { value: 7 } }));
    const client = new StartggClient('secret-token', {
      fetcher,
      minimumRequestIntervalMs: 0,
      maxRetries: 1,
    });

    await expect(client.request<{ value: number }>('query Test { value }', {})).resolves.toEqual({
      value: 7,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('propaga los errores GraphQL', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      createResponse({
        errors: [{ message: 'Query complexity too high.' }],
      })
    );
    const client = new StartggClient('secret-token', {
      fetcher,
      minimumRequestIntervalMs: 0,
    });

    await expect(client.request('query Test { value }', {})).rejects.toThrow(
      'Query complexity too high.'
    );
  });
});
