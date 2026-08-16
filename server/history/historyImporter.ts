import { mapCompletedSinglesSet } from './setMapper.ts';
import type {
  ImportedEvent,
  ImportedSet,
  ImportedTournament,
  SetPage,
  TournamentPage,
  TournamentSummary,
} from './historyTypes.ts';

export interface HistorySource {
  getTournamentPage(page: number, afterDate: number, beforeDate: number): Promise<TournamentPage>;
  getSetPage(eventId: string, page: number): Promise<SetPage>;
}

export interface HistoryImportRepository {
  saveTournament(tournament: ImportedTournament): Promise<{
    changed: boolean;
    setsSaved: number;
  }>;
}

export interface HistoryImportOptions {
  from: Date;
  to: Date;
  maxTournaments?: number;
}

export interface HistoryImportSummary {
  tournamentsSeen: number;
  tournamentsSaved: number;
  setsSaved: number;
}

function assertValidOptions(options: HistoryImportOptions) {
  if (Number.isNaN(options.from.getTime()) || Number.isNaN(options.to.getTime())) {
    throw new Error('El intervalo de importación contiene una fecha inválida.');
  }

  if (options.from >= options.to) {
    throw new Error('La fecha `from` debe ser anterior a `to`.');
  }

  if (options.maxTournaments !== undefined && options.maxTournaments <= 0) {
    throw new Error('`maxTournaments` debe ser mayor que cero.');
  }
}

async function loadEvent(
  source: HistorySource,
  tournament: TournamentSummary,
  event: TournamentSummary['events'][number]
): Promise<ImportedEvent> {
  const sets: ImportedSet[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await source.getSetPage(event.id, page);
    totalPages = result.totalPages;

    for (const set of result.sets) {
      const importedSet = mapCompletedSinglesSet(set, event.id, tournament);
      if (importedSet) sets.push(importedSet);
    }

    page += 1;
  }

  return { ...event, sets };
}

async function loadTournament(source: HistorySource, tournament: TournamentSummary) {
  const events: ImportedEvent[] = [];

  for (const event of tournament.events) {
    events.push(await loadEvent(source, tournament, event));
  }

  const latestSetTime = events
    .flatMap((event) => event.sets)
    .reduce((latest, set) => Math.max(latest, set.completedAt.getTime()), 0);
  const completedAt = new Date(
    tournament.endAt ? tournament.endAt * 1000 : latestSetTime || tournament.startAt * 1000
  );

  return {
    ...tournament,
    completedAt,
    events,
  } satisfies ImportedTournament;
}

export async function importTournamentSummaries(
  source: HistorySource,
  repository: HistoryImportRepository,
  tournaments: TournamentSummary[]
): Promise<HistoryImportSummary> {
  const summary: HistoryImportSummary = {
    tournamentsSeen: 0,
    tournamentsSaved: 0,
    setsSaved: 0,
  };

  for (const tournament of tournaments) {
    summary.tournamentsSeen += 1;
    const importedTournament = await loadTournament(source, tournament);
    const setCount = importedTournament.events.reduce(
      (total, event) => total + event.sets.length,
      0
    );
    if (setCount === 0) continue;

    const saved = await repository.saveTournament(importedTournament);
    summary.tournamentsSaved += 1;
    summary.setsSaved += saved.setsSaved;
  }

  return summary;
}

export async function importUltimateHistory(
  source: HistorySource,
  repository: HistoryImportRepository,
  options: HistoryImportOptions
): Promise<HistoryImportSummary> {
  assertValidOptions(options);

  const summary: HistoryImportSummary = {
    tournamentsSeen: 0,
    tournamentsSaved: 0,
    setsSaved: 0,
  };
  const afterDate = Math.floor(options.from.getTime() / 1000);
  const beforeDate = Math.floor(options.to.getTime() / 1000);
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await source.getTournamentPage(page, afterDate, beforeDate);
    totalPages = result.totalPages;

    for (const tournament of result.tournaments) {
      if (
        options.maxTournaments !== undefined &&
        summary.tournamentsSeen >= options.maxTournaments
      ) {
        return summary;
      }

      const imported = await importTournamentSummaries(source, repository, [tournament]);
      summary.tournamentsSeen += imported.tournamentsSeen;
      summary.tournamentsSaved += imported.tournamentsSaved;
      summary.setsSaved += imported.setsSaved;
    }

    page += 1;
  }

  return summary;
}
