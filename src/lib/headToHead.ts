import type { HeadToHeadSet } from './types';

export const HEAD_TO_HEAD_HISTORY_LIMIT = 10;

export function getSetPlayerIds(set: HeadToHeadSet) {
  return new Set(
    (set.slots ?? [])
      .flatMap((slot) => slot.entrant?.participants ?? [])
      .map((participant) => participant.player?.id)
      .filter((playerId): playerId is string => Boolean(playerId))
      .map(String)
  );
}

export function isHeadToHeadSet(
  set: HeadToHeadSet,
  player1Id: string,
  player2Id: string,
  videogameId: number
) {
  const participantPlayerIds = getSetPlayerIds(set);

  return (
    participantPlayerIds.size === 2 &&
    participantPlayerIds.has(player1Id) &&
    participantPlayerIds.has(player2Id) &&
    String(set.event.videogame?.id) === String(videogameId)
  );
}

export function getSetWinnerPlayerId(set: HeadToHeadSet) {
  const winnerEntrantId = String(set.winnerId);
  const winnerSlot = (set.slots ?? []).find(
    (slot) => String(slot.entrant?.id) === winnerEntrantId
  );
  const winnerPlayerId = winnerSlot?.entrant?.participants?.[0]?.player?.id;

  return winnerPlayerId ? String(winnerPlayerId) : null;
}

export function getRecentHeadToHeadSets(
  sets: HeadToHeadSet[],
  player1Id: string,
  player2Id: string,
  videogameId: number
) {
  return sets
    .filter((set) => isHeadToHeadSet(set, player1Id, player2Id, videogameId))
    .sort((setA, setB) => setB.event.tournament.startAt - setA.event.tournament.startAt)
    .slice(0, HEAD_TO_HEAD_HISTORY_LIMIT);
}
