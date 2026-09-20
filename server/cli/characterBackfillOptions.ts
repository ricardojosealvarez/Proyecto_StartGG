export interface CharacterBackfillOptions {
  maxPlayers: number;
}

const DEFAULT_MAX_PLAYERS = 25;

export function parseCharacterBackfillOptions(argumentsList: string[]): CharacterBackfillOptions {
  const rawValue = argumentsList
    .find((argument) => argument.startsWith('--max-players='))
    ?.split('=', 2)[1];
  const maxPlayers = Number(rawValue ?? DEFAULT_MAX_PLAYERS);

  if (!Number.isInteger(maxPlayers) || maxPlayers <= 0 || maxPlayers > DEFAULT_MAX_PLAYERS) {
    throw new Error('`--max-players` debe ser un entero entre 1 y 25.');
  }

  return { maxPlayers };
}

export function isCharacterBackfillRateLimit(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('rate limit') ||
    message.includes('threshold for recent request time') ||
    message.includes("unexpected token '<'")
  );
}
