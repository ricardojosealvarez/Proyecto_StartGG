import type { RecentStanding } from './types';

export type TournamentMode = 'all' | 'online' | 'offline';

export function filterStandingsByMode(results: RecentStanding[], mode: TournamentMode) {
  if (mode === 'all') return results;
  const isOnline = mode === 'online';
  return results.filter((result) => result.entrant.event.tournament.isOnline === isOnline);
}
