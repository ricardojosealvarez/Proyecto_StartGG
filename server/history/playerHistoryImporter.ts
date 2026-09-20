import type {
  HistoryImportRepository,
  HistoryImportSummary,
  HistorySource,
} from './historyImporter.ts';
import { importTournamentSummaries } from './historyImporter.ts';
import type { PlayerTournamentPage, TournamentSummary } from './historyTypes.ts';
import { getTournamentRegion } from './tournamentRegions.ts';
import type { TournamentRegion } from './tournamentRegions.ts';

export interface PlayerHistorySource extends HistorySource {
  getPlayerTournamentPage(playerId: string, page: number): Promise<PlayerTournamentPage>;
}

export interface PlayerHistoryImportOptions {
  playerId: string;
  from: Date;
  to: Date;
  regions: TournamentRegion[];
  maxTournaments?: number;
}

export interface PlayerHistoryImportSummary extends HistoryImportSummary {
  candidateTournaments: number;
  selectedTournaments: number;
  tournamentsByRegion: Record<TournamentRegion, number>;
}

export interface PlayerHistoryRefreshSummary extends HistoryImportSummary {
  candidateTournaments: number;
}

function mergeTournament(
  tournaments: Map<string, TournamentSummary>,
  tournament: TournamentSummary
) {
  const existing = tournaments.get(tournament.id);
  if (!existing) {
    tournaments.set(tournament.id, { ...tournament, events: [...tournament.events] });
    return;
  }

  for (const event of tournament.events) {
    if (!existing.events.some((candidate) => candidate.id === event.id)) {
      existing.events.push(event);
    }
  }
}

async function getPlayerTournaments(source: PlayerHistorySource, playerId: string) {
  const candidates = new Map<string, TournamentSummary>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await source.getPlayerTournamentPage(playerId, page);
    totalPages = result.totalPages;
    for (const tournament of result.tournaments) mergeTournament(candidates, tournament);
    page += 1;
  }

  return candidates;
}

function assertValidOptions(options: PlayerHistoryImportOptions) {
  if (!options.playerId.trim()) throw new Error('`playerId` es obligatorio.');
  if (options.from >= options.to) throw new Error('La fecha `from` debe ser anterior a `to`.');
  if (options.regions.length === 0) throw new Error('Debe indicarse al menos una región.');
  if (options.maxTournaments !== undefined && options.maxTournaments <= 0) {
    throw new Error('`maxTournaments` debe ser mayor que cero.');
  }
}

export async function importPlayerHistory(
  source: PlayerHistorySource,
  repository: HistoryImportRepository,
  options: PlayerHistoryImportOptions
): Promise<PlayerHistoryImportSummary> {
  assertValidOptions(options);
  const candidates = await getPlayerTournaments(source, options.playerId);

  const selectedRegions = new Set(options.regions);
  const selected = [...candidates.values()]
    .filter((tournament) => {
      const region = getTournamentRegion(tournament.countryCode);
      const startsAt = new Date(tournament.startAt * 1000);
      return (
        region && selectedRegions.has(region) && startsAt >= options.from && startsAt <= options.to
      );
    })
    .sort((left, right) => left.startAt - right.startAt || left.id.localeCompare(right.id))
    .slice(0, options.maxTournaments);
  const tournamentsByRegion: Record<TournamentRegion, number> = { EU: 0, US: 0 };

  for (const tournament of selected) {
    const region = getTournamentRegion(tournament.countryCode);
    if (region) tournamentsByRegion[region] += 1;
  }

  const imported = await importTournamentSummaries(source, repository, selected);
  return {
    candidateTournaments: candidates.size,
    selectedTournaments: selected.length,
    tournamentsByRegion,
    ...imported,
  };
}

export async function refreshPlayerHistory(
  source: PlayerHistorySource,
  repository: HistoryImportRepository,
  playerId: string
): Promise<PlayerHistoryRefreshSummary> {
  if (!playerId.trim()) throw new Error('`playerId` es obligatorio.');

  const candidates = await getPlayerTournaments(source, playerId);
  const tournaments = [...candidates.values()].sort(
    (left, right) => left.startAt - right.startAt || left.id.localeCompare(right.id)
  );
  const imported = await importTournamentSummaries(source, repository, tournaments);

  return {
    candidateTournaments: candidates.size,
    ...imported,
  };
}
