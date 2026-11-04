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
  loadImportProgress?(scopeKey: string): Promise<HistoryImportProgress | null>;
  saveImportProgress?(scopeKey: string, progress: HistoryImportProgress): Promise<void>;
}

export interface HistoryImportProgress {
  page: number;
  tournamentIndex: number;
  status: 'running' | 'completed';
}

export interface HistoryImportOptions {
  from: Date;
  to: Date;
  maxTournaments?: number;
  refresh?: boolean;
}

export interface HistoryImportSummary {
  tournamentsSeen: number;
  tournamentsSaved: number;
  setsSaved: number;
  completed?: boolean;
}

const TOURNAMENT_CONCURRENCY = 3;

async function mapWithConcurrency<T, TResult>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<TResult>
): Promise<TResult[]> {
  const results: TResult[] = [];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
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
    completed: false,
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

  return { ...summary, completed: true };
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
    completed: false,
  };
  const afterDate = Math.floor(options.from.getTime() / 1000);
  const beforeDate = Math.floor(options.to.getTime() / 1000);
  const scopeKey = `ultimate:${afterDate}:${beforeDate}`;
  const savedProgress = options.refresh
    ? null
    : await repository.loadImportProgress?.(scopeKey);
  if (savedProgress?.status === 'completed') return { ...summary, completed: true };
  let page = savedProgress?.page ?? 1;
  let tournamentIndex = savedProgress?.tournamentIndex ?? 0;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await source.getTournamentPage(page, afterDate, beforeDate);
    totalPages = result.totalPages;

    const remainingLimit =
      options.maxTournaments === undefined
        ? undefined
        : options.maxTournaments - summary.tournamentsSeen;
    const pageTournaments = result.tournaments.slice(
      tournamentIndex,
      remainingLimit === undefined ? undefined : tournamentIndex + remainingLimit
    );

    for (let offset = 0; offset < pageTournaments.length; offset += TOURNAMENT_CONCURRENCY) {
      const batch = pageTournaments.slice(offset, offset + TOURNAMENT_CONCURRENCY);
      const imported = await mapWithConcurrency(batch, TOURNAMENT_CONCURRENCY, (tournament) =>
        importTournamentSummaries(source, repository, [tournament])
      );
      for (const tournamentSummary of imported) {
        summary.tournamentsSeen += tournamentSummary.tournamentsSeen;
        summary.tournamentsSaved += tournamentSummary.tournamentsSaved;
        summary.setsSaved += tournamentSummary.setsSaved;
      }
      tournamentIndex += batch.length;
      const pageCompleted = tournamentIndex >= result.tournaments.length;
      await repository.saveImportProgress?.(scopeKey, {
        page: pageCompleted ? page + 1 : page,
        tournamentIndex: pageCompleted ? 0 : tournamentIndex,
        status: 'running',
      });
      if (
        options.maxTournaments !== undefined &&
        summary.tournamentsSeen >= options.maxTournaments
      ) {
        return summary;
      }
    }

    page += 1;
    tournamentIndex = 0;
  }

  await repository.saveImportProgress?.(scopeKey, {
    page: Math.max(1, totalPages),
    tournamentIndex: 0,
    status: 'completed',
  });

  return { ...summary, completed: true };
}
