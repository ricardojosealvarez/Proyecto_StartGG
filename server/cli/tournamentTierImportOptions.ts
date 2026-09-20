export interface TournamentTierImportOptions {
  filePath: string;
  sheetName: string;
}

function readArgument(argumentsList: string[], name: string) {
  return argumentsList
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

export function parseTournamentTierImportOptions(
  argumentsList: string[]
): TournamentTierImportOptions {
  const filePath = readArgument(argumentsList, 'file');
  const sheetName = readArgument(argumentsList, 'sheet') ?? 'Index';
  if (!filePath) throw new Error('Falta el parámetro obligatorio `--file=<ruta>`.');
  if (!sheetName.trim()) throw new Error('`--sheet` no puede estar vacío.');
  return { filePath, sheetName };
}
