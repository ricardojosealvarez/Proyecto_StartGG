import type { RequestRateLimiter } from './postgresRateLimiter.ts';

const STARTGG_API_URL = 'https://api.start.gg/gql/alpha';
const DEFAULT_MINIMUM_REQUEST_INTERVAL_MS = 800;
const DEFAULT_MAX_RETRIES = 3;

type Fetcher = typeof fetch;

interface GraphqlPayload<TData> {
  data?: TData;
  errors?: Array<{ message?: string }>;
  message?: string;
}

export interface StartggClientOptions {
  fetcher?: Fetcher;
  minimumRequestIntervalMs?: number;
  maxRetries?: number;
  rateLimiter?: RequestRateLimiter;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function getPayloadError<TData>(payload: GraphqlPayload<TData>) {
  const graphqlMessage = payload.errors
    ?.map((error) => error.message)
    .filter((message): message is string => Boolean(message))
    .join(' ');

  return graphqlMessage || payload.message || null;
}

function isRateLimitError(statusCode: number, message: string | null) {
  return statusCode === 429 || Boolean(message?.toLowerCase().includes('rate limit'));
}

export class StartggClient {
  private readonly fetcher: Fetcher;
  private readonly minimumRequestIntervalMs: number;
  private readonly maxRetries: number;
  private readonly rateLimiter?: RequestRateLimiter;
  private nextRequestAt = 0;
  private requestGate: Promise<void> = Promise.resolve();

  constructor(
    private readonly apiKey: string,
    options: StartggClientOptions = {}
  ) {
    if (!apiKey.trim()) {
      throw new Error('Falta configurar `STARTGG_API_KEY`.');
    }

    this.fetcher = options.fetcher ?? fetch;
    this.minimumRequestIntervalMs =
      options.minimumRequestIntervalMs ?? DEFAULT_MINIMUM_REQUEST_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.rateLimiter = options.rateLimiter;
  }

  async request<TData>(query: string, variables: Record<string, unknown>) {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      await this.reserveRequestSlot();
      const response = await this.fetcher(STARTGG_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      const payload = (await response.json()) as GraphqlPayload<TData>;
      const errorMessage = getPayloadError(payload);

      if (isRateLimitError(response.status, errorMessage) && attempt < this.maxRetries) {
        const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? 0);
        const retryDelayMs = Math.max(
          retryAfterSeconds * 1000,
          this.minimumRequestIntervalMs * 2 ** attempt
        );
        await sleep(retryDelayMs);
        continue;
      }

      if (!response.ok || errorMessage) {
        throw new Error(errorMessage ?? `Start.gg respondió con ${response.status}.`);
      }

      if (!payload.data) {
        throw new Error('Start.gg no devolvió datos.');
      }

      return payload.data;
    }

    throw new Error('Start.gg agotó los reintentos permitidos.');
  }

  private async reserveRequestSlot() {
    if (this.rateLimiter) {
      await this.rateLimiter.reserve();
      return;
    }

    let release!: () => void;
    const previous = this.requestGate;
    this.requestGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    this.nextRequestAt = Date.now() + this.minimumRequestIntervalMs;
    release();
  }
}
