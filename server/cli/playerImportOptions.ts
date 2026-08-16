import type { TournamentRegion } from '../history/tournamentRegions.ts';

export interface PlayerImportCommandOptions {
  playerId: string;
  from: Date;
  to: Date;
  regions: TournamentRegion[];
  maxTournaments?: number;
}

const ULTIMATE_RELEASE_DATE = new Date('2018-12-07T00:00:00.000Z');
const DEFAULT_MAX_TOURNAMENTS = 25;

function readArgument(argumentsList: string[], name: string) {
  return argumentsList.find((argument) => argument.startsWith(`--${name}=`))?.split('=', 2)[1];
}

function parseDate(value: string | undefined, fallback: Date, endOfDay = false) {
  if (!value) return fallback;

  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}${suffix}` : value);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${value}.`);
  return date;
}

function parseRegions(value: string | undefined): TournamentRegion[] {
  const regions = (value ?? 'EU,US')
    .split(',')
    .map((region) => region.trim().toUpperCase())
    .filter(Boolean);

  if (regions.some((region) => region !== 'EU' && region !== 'US')) {
    throw new Error('`--regions` solo admite EU y US.');
  }

  return [...new Set(regions)] as TournamentRegion[];
}

export function parsePlayerImportOptions(
  argumentsList: string[],
  now = new Date()
): PlayerImportCommandOptions {
  const playerId = readArgument(argumentsList, 'player-id')?.trim() ?? '';
  const from = parseDate(readArgument(argumentsList, 'from'), ULTIMATE_RELEASE_DATE);
  const to = parseDate(readArgument(argumentsList, 'to'), now, true);
  const regions = parseRegions(readArgument(argumentsList, 'regions'));
  const maxValue = readArgument(argumentsList, 'max-tournaments');
  const maxTournaments =
    maxValue === 'all' ? undefined : Number(maxValue ?? DEFAULT_MAX_TOURNAMENTS);

  if (!playerId) throw new Error('Falta `--player-id`.');
  if (from >= to) throw new Error('La fecha `from` debe ser anterior a `to`.');
  if (maxTournaments !== undefined && (!Number.isInteger(maxTournaments) || maxTournaments <= 0)) {
    throw new Error('`--max-tournaments` debe ser un entero positivo o `all`.');
  }

  return { playerId, from, to, regions, maxTournaments };
}
