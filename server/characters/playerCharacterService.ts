import { StartggClient } from '../startgg/startggClient.ts';
import {
  calculateCharacterStats,
  CHARACTER_LOOKBACK_MONTHS,
  CHARACTER_STATS_CACHE_TTL_MS,
} from './characterStats.ts';
import type { PlayerCharacterGame, PlayerCharacterStats } from './characterStats.ts';

const COMPLETED_SET_STATE = 3;
const SETS_PER_PAGE = 20;

export const PLAYER_CHARACTER_DATA_QUERY = `
  query PlayerCharacterData(
    $playerId: ID!
    $page: Int!
    $perPage: Int!
    $updatedAfter: Timestamp!
  ) {
    player(id: $playerId) {
      id
      sets(
        page: $page
        perPage: $perPage
        filters: { state: [3], hideEmpty: true, updatedAfter: $updatedAfter }
      ) {
        pageInfo { totalPages }
        nodes {
          id
          state
          event {
            videogame { id }
            tournament { startAt }
          }
          slots {
            entrant {
              id
              participants { player { id } }
            }
          }
          games {
            id
            selections {
              id
              entrant { id }
              character {
                id
                name
                images { url }
              }
            }
          }
        }
      }
    }
  }
`;

interface CharacterDataResponse {
  player: {
    sets: {
      pageInfo: { totalPages: number };
      nodes: CharacterSetNode[];
    };
  } | null;
}

interface CharacterSetNode {
  id: string | number;
  state: number;
  event?: {
    videogame?: { id: string | number } | null;
    tournament?: { startAt: number } | null;
  } | null;
  slots?: Array<{
    entrant?: {
      id: string | number;
      participants?: Array<{ player?: { id: string | number } | null }> | null;
    } | null;
  }> | null;
  games?: Array<{
    id: string | number;
    selections?: Array<{
      id: string | number;
      entrant?: { id: string | number } | null;
      character?: {
        id: string | number;
        name: string;
        images?: Array<{ url: string }> | null;
      } | null;
    }> | null;
  }> | null;
}

interface CharacterStatsCacheEntry {
  expiresAt: number;
  stats: PlayerCharacterStats;
}

export interface CharacterStatsOptions {
  lookbackMonths?: number;
  forceRefresh?: boolean;
}

export function getCharacterCutoff(now: Date, lookbackMonths: number): number {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - lookbackMonths);
  return Math.floor(cutoff.getTime() / 1000);
}

export function mapSetToCharacterGames(
  set: CharacterSetNode,
  playerId: string,
  videogameId: string,
  cutoffTimestamp: number
): PlayerCharacterGame[] {
  if (
    set.state !== COMPLETED_SET_STATE ||
    String(set.event?.videogame?.id) !== videogameId ||
    (set.event?.tournament?.startAt ?? 0) < cutoffTimestamp
  ) {
    return [];
  }

  const entrants = (set.slots ?? []).flatMap((slot) => (slot.entrant ? [slot.entrant] : []));
  const isSingles =
    entrants.length === 2 && entrants.every((entrant) => entrant.participants?.length === 1);
  if (!isSingles) return [];

  const targetEntrant = entrants.find((entrant) =>
    entrant.participants?.some((participant) => String(participant.player?.id) === playerId)
  );
  if (!targetEntrant) return [];

  return (set.games ?? []).map((game) => {
    const selection = game.selections?.find(
      (candidate) => String(candidate.entrant?.id) === String(targetEntrant.id)
    );

    return {
      gameId: String(game.id),
      playerId,
      character: selection?.character
        ? {
            id: String(selection.character.id),
            name: selection.character.name,
            imageUrl: selection.character.images?.[0]?.url ?? null,
          }
        : null,
    };
  });
}

export class PlayerCharacterService {
  private readonly cache = new Map<string, CharacterStatsCacheEntry>();

  constructor(
    private readonly client: StartggClient,
    private readonly now: () => Date = () => new Date(),
    private readonly cacheTtlMs = CHARACTER_STATS_CACHE_TTL_MS
  ) {}

  async getPlayerCharacterStats(
    playerId: string,
    videogameId: string,
    options: CharacterStatsOptions = {}
  ): Promise<PlayerCharacterStats> {
    const lookbackMonths = options.lookbackMonths ?? CHARACTER_LOOKBACK_MONTHS;
    const cacheKey = `${playerId}:${videogameId}:${lookbackMonths}`;
    const cached = this.cache.get(cacheKey);
    if (!options.forceRefresh && cached && cached.expiresAt > this.now().getTime()) {
      return cached.stats;
    }

    const cutoffTimestamp = getCharacterCutoff(this.now(), lookbackMonths);
    const games: PlayerCharacterGame[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.client.request<CharacterDataResponse>(
        PLAYER_CHARACTER_DATA_QUERY,
        { playerId, page, perPage: SETS_PER_PAGE, updatedAfter: cutoffTimestamp }
      );
      const sets = response.player?.sets;
      if (!sets) break;

      for (const set of sets.nodes) {
        games.push(...mapSetToCharacterGames(set, playerId, videogameId, cutoffTimestamp));
      }

      totalPages = sets.pageInfo.totalPages;
      const reachedCutoff =
        sets.nodes.length > 0 &&
        sets.nodes.every((set) => {
          const startAt = set.event?.tournament?.startAt;
          return startAt !== undefined && startAt < cutoffTimestamp;
        });
      if (reachedCutoff) break;
      page += 1;
    } while (page <= totalPages);

    const stats = calculateCharacterStats(games);
    this.cache.set(cacheKey, { expiresAt: this.now().getTime() + this.cacheTtlMs, stats });
    return stats;
  }
}
