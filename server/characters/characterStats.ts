export const CHARACTER_LOOKBACK_MONTHS = 12;
export const CHARACTER_STATS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const MIN_FEATURED_CHARACTER_COVERAGE = 0.66;

export const CHARACTER_CONFIDENCE = {
  MIN_MEDIUM_GAMES: 5,
  MIN_HIGH_GAMES: 15,
  MIN_MEDIUM_COVERAGE: 0.25,
  MIN_HIGH_COVERAGE: 0.5,
} as const;

export type CharacterConfidence = 'none' | 'low' | 'medium' | 'high';

export interface CharacterUsage {
  characterId: string;
  name: string;
  imageUrl: string | null;
  games: number;
  usage: number;
}

export interface PlayerCharacterStats {
  primaryCharacter: CharacterUsage | null;
  secondaryCharacters: CharacterUsage[];
  characterUsage: CharacterUsage[];
  gamesWithCharacterData: number;
  gamesAnalyzed: number;
  characterDataCoverage: number;
  characterConfidence: CharacterConfidence;
}

export interface PlayerCharacterGame {
  gameId: string;
  playerId: string;
  character: {
    id: string;
    name: string;
    imageUrl?: string | null;
  } | null;
}

export function getCharacterConfidence(
  gamesWithCharacterData: number,
  coverage: number
): CharacterConfidence {
  if (gamesWithCharacterData === 0) return 'none';
  if (
    gamesWithCharacterData < CHARACTER_CONFIDENCE.MIN_MEDIUM_GAMES ||
    coverage < CHARACTER_CONFIDENCE.MIN_MEDIUM_COVERAGE
  ) {
    return 'low';
  }
  if (
    gamesWithCharacterData < CHARACTER_CONFIDENCE.MIN_HIGH_GAMES ||
    coverage < CHARACTER_CONFIDENCE.MIN_HIGH_COVERAGE
  ) {
    return 'medium';
  }
  return 'high';
}

export function calculateCharacterStats(games: PlayerCharacterGame[]): PlayerCharacterStats {
  const gamesAnalyzed = new Set(games.map((game) => game.gameId)).size;
  const countedSelections = new Set<string>();
  const usageByCharacter = new Map<
    string,
    { name: string; imageUrl: string | null; games: number }
  >();
  const gamesWithData = new Set<string>();

  for (const game of games) {
    if (!game.character) continue;

    const duplicateKey = `${game.gameId}:${game.playerId}:${game.character.id}`;
    if (countedSelections.has(duplicateKey)) continue;

    countedSelections.add(duplicateKey);
    gamesWithData.add(game.gameId);
    const current = usageByCharacter.get(game.character.id);
    usageByCharacter.set(game.character.id, {
      name: current?.name ?? game.character.name,
      imageUrl: current?.imageUrl ?? game.character.imageUrl ?? null,
      games: (current?.games ?? 0) + 1,
    });
  }

  const gamesWithCharacterData = gamesWithData.size;
  const characterDataCoverage = gamesAnalyzed > 0 ? gamesWithCharacterData / gamesAnalyzed : 0;
  const characterUsage = [...usageByCharacter.entries()]
    .map(([characterId, value]) => ({
      characterId,
      name: value.name,
      imageUrl: value.imageUrl,
      games: value.games,
      usage: value.games / gamesWithCharacterData,
    }))
    .sort((first, second) => {
      if (first.games !== second.games) return second.games - first.games;
      return first.characterId.localeCompare(second.characterId, undefined, { numeric: true });
    });
  const primaryCharacter = characterUsage[0] ?? null;
  const secondaryCharacters: CharacterUsage[] = [];
  let featuredCoverage = primaryCharacter?.usage ?? 0;

  for (const character of characterUsage.slice(1)) {
    if (featuredCoverage >= MIN_FEATURED_CHARACTER_COVERAGE) break;
    secondaryCharacters.push(character);
    featuredCoverage += character.usage;
  }

  return {
    primaryCharacter,
    secondaryCharacters,
    characterUsage,
    gamesWithCharacterData,
    gamesAnalyzed,
    characterDataCoverage,
    characterConfidence: getCharacterConfidence(gamesWithCharacterData, characterDataCoverage),
  };
}
