import { Glicko2 } from 'glicko2';
import type { Player } from 'glicko2';

export const DEFAULT_GLICKO2_RATING = 1500;
export const DEFAULT_GLICKO2_DEVIATION = 350;
export const DEFAULT_GLICKO2_VOLATILITY = 0.06;
export const DEFAULT_GLICKO2_TAU = 0.5;

export interface PlayerRating {
  playerId: string;
  rating: number;
  deviation: number;
  volatility: number;
  matchesPlayed: number;
}

export interface CompletedMatch {
  winnerPlayerId: string;
  loserPlayerId: string;
}

export interface Glicko2Settings {
  tau?: number;
  initialRating?: number;
  initialDeviation?: number;
  initialVolatility?: number;
}

function createDefaultRating(playerId: string): PlayerRating {
  return {
    playerId,
    rating: DEFAULT_GLICKO2_RATING,
    deviation: DEFAULT_GLICKO2_DEVIATION,
    volatility: DEFAULT_GLICKO2_VOLATILITY,
    matchesPlayed: 0,
  };
}

function createRatingManager(settings: Glicko2Settings) {
  return new Glicko2({
    tau: settings.tau ?? DEFAULT_GLICKO2_TAU,
    rating: settings.initialRating ?? DEFAULT_GLICKO2_RATING,
    rd: settings.initialDeviation ?? DEFAULT_GLICKO2_DEVIATION,
    vol: settings.initialVolatility ?? DEFAULT_GLICKO2_VOLATILITY,
    volatility_algorithm: 'newprocedure',
  });
}

function validateMatch(match: CompletedMatch) {
  if (!match.winnerPlayerId || !match.loserPlayerId) {
    throw new Error('Cada set debe incluir ganador y perdedor.');
  }

  if (match.winnerPlayerId === match.loserPlayerId) {
    throw new Error('Un jugador no puede enfrentarse contra sí mismo.');
  }
}

export function calculateRatingPeriod(
  currentRatings: PlayerRating[],
  matches: CompletedMatch[],
  settings: Glicko2Settings = {}
) {
  const ratingsByPlayerId = new Map<string, PlayerRating>();

  for (const rating of currentRatings) {
    if (ratingsByPlayerId.has(rating.playerId)) {
      throw new Error(`Rating duplicado para el jugador ${rating.playerId}.`);
    }

    ratingsByPlayerId.set(rating.playerId, rating);
  }

  for (const match of matches) {
    validateMatch(match);

    if (!ratingsByPlayerId.has(match.winnerPlayerId)) {
      ratingsByPlayerId.set(match.winnerPlayerId, createDefaultRating(match.winnerPlayerId));
    }

    if (!ratingsByPlayerId.has(match.loserPlayerId)) {
      ratingsByPlayerId.set(match.loserPlayerId, createDefaultRating(match.loserPlayerId));
    }
  }

  const manager = createRatingManager(settings);
  const playersByPlayerId = new Map<string, Player>();

  for (const rating of ratingsByPlayerId.values()) {
    playersByPlayerId.set(
      rating.playerId,
      manager.makePlayer(rating.rating, rating.deviation, rating.volatility)
    );
  }

  const periodMatches: Array<[Player, Player, number]> = matches.map((match) => {
    const winner = playersByPlayerId.get(match.winnerPlayerId);
    const loser = playersByPlayerId.get(match.loserPlayerId);

    if (!winner || !loser) {
      throw new Error('No se pudo construir el periodo de rating.');
    }

    return [winner, loser, 1];
  });

  manager.updateRatings(periodMatches);

  const matchCounts = new Map<string, number>();
  for (const match of matches) {
    matchCounts.set(match.winnerPlayerId, (matchCounts.get(match.winnerPlayerId) ?? 0) + 1);
    matchCounts.set(match.loserPlayerId, (matchCounts.get(match.loserPlayerId) ?? 0) + 1);
  }

  return [...ratingsByPlayerId.values()]
    .map((rating): PlayerRating => {
      const player = playersByPlayerId.get(rating.playerId);

      if (!player) {
        throw new Error(`No se encontró el rating de ${rating.playerId}.`);
      }

      return {
        playerId: rating.playerId,
        rating: player.getRating(),
        deviation: player.getRd(),
        volatility: player.getVol(),
        matchesPlayed: rating.matchesPlayed + (matchCounts.get(rating.playerId) ?? 0),
      };
    })
    .sort((ratingA, ratingB) => ratingA.playerId.localeCompare(ratingB.playerId));
}

export function predictWinProbability(
  player: PlayerRating,
  opponent: PlayerRating,
  settings: Glicko2Settings = {}
) {
  const manager = createRatingManager(settings);
  const ratedPlayer = manager.makePlayer(player.rating, player.deviation, player.volatility);
  const ratedOpponent = manager.makePlayer(
    opponent.rating,
    opponent.deviation,
    opponent.volatility
  );

  return manager.predict(ratedPlayer, ratedOpponent);
}
