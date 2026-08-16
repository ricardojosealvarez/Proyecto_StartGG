export interface ImportCommandOptions {
  from: Date;
  to: Date;
  maxTournaments?: number;
}

const DEFAULT_IMPORT_DAYS = 30;
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

export function parseImportOptions(
  argumentsList: string[],
  now = new Date()
): ImportCommandOptions {
  const defaultFrom = new Date(now.getTime() - DEFAULT_IMPORT_DAYS * 24 * 60 * 60 * 1000);
  const from = parseDate(readArgument(argumentsList, 'from'), defaultFrom);
  const to = parseDate(readArgument(argumentsList, 'to'), now, true);
  const maxValue = readArgument(argumentsList, 'max-tournaments');
  const maxTournaments =
    maxValue === 'all' ? undefined : Number(maxValue ?? DEFAULT_MAX_TOURNAMENTS);

  if (maxTournaments !== undefined && (!Number.isInteger(maxTournaments) || maxTournaments <= 0)) {
    throw new Error('`--max-tournaments` debe ser un entero positivo o `all`.');
  }

  return { from, to, maxTournaments };
}
