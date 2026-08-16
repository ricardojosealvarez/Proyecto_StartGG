import type { ImportedSet, SetSlot, StartggSet, TournamentSummary } from './historyTypes.ts';

const COMPLETED_SET_STATE = 3;

function getSinglesPlayer(slot: SetSlot) {
  const participants = slot.entrant?.participants ?? [];
  if (participants.length !== 1) return null;

  const participant = participants[0];
  if (!participant.player?.id) return null;

  return {
    entrantId: String(slot.entrant?.id),
    player: {
      id: String(participant.player.id),
      gamerTag: participant.gamerTag || participant.player.gamerTag,
    },
  };
}

export function mapCompletedSinglesSet(
  set: StartggSet,
  eventId: string,
  tournament: TournamentSummary
): ImportedSet | null {
  if (set.state !== COMPLETED_SET_STATE || set.winnerId === null || set.slots.length !== 2) {
    return null;
  }

  const competitors = set.slots.map(getSinglesPlayer);
  if (competitors.some((competitor) => !competitor)) return null;

  const resolvedCompetitors = competitors.filter(
    (competitor): competitor is NonNullable<typeof competitor> => Boolean(competitor)
  );
  const winnerIndex = resolvedCompetitors.findIndex(
    (competitor) => competitor.entrantId === String(set.winnerId)
  );
  if (winnerIndex === -1) return null;

  const winner = resolvedCompetitors[winnerIndex].player;
  const loser = resolvedCompetitors[winnerIndex === 0 ? 1 : 0].player;
  if (winner.id === loser.id) return null;

  const completedAt = set.completedAt ?? tournament.endAt ?? tournament.startAt;

  return {
    id: set.id,
    eventId,
    winner,
    loser,
    completedAt: new Date(completedAt * 1000),
    rawPayload: {
      state: set.state,
      winnerEntrantId: String(set.winnerId),
      displayScore: set.displayScore,
      usedFallbackCompletionTime: set.completedAt === null,
    },
  };
}
