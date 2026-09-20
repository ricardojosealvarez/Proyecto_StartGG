import ExcelJS from 'exceljs';
import type { Cell, Worksheet } from 'exceljs';

export interface TournamentTierRecord {
  rowNumber: number;
  slug: string;
  startggUrl: string;
  tierPoints: number;
  tier: string;
}

export interface RejectedTournamentTierRow {
  rowNumber: number;
  reason: string;
}

export interface ParsedTournamentTiers {
  rowsRead: number;
  records: TournamentTierRecord[];
  unsupportedLinks: string[];
  rejected: RejectedTournamentTierRow[];
}

interface ColumnIndexes {
  link: number;
  points: number;
  tier: number;
}

function cellValue(cell: Cell): unknown {
  const value = cell.value;

  if (value && typeof value === 'object') {
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink;
    if ('result' in value) return value.result;
    if ('text' in value && typeof value.text === 'string') return value.text;
  }

  return value;
}

function cellText(cell: Cell) {
  const value = cellValue(cell);
  return value === null || value === undefined ? '' : String(value).trim();
}

function findColumns(worksheet: Worksheet): { headerRowNumber: number; columns: ColumnIndexes } {
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const headers = new Map<string, number>();

    row.eachCell((cell, columnNumber) => {
      headers.set(cellText(cell).toLowerCase(), columnNumber);
    });

    const link = headers.get('link');
    const points = headers.get('points');
    const tier = headers.get('tier');
    if (link && points && tier)
      return { headerRowNumber: rowNumber, columns: { link, points, tier } };
  }

  throw new Error('No se encontraron los encabezados Link, Points y Tier.');
}

export function normalizeStartggSlug(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!['start.gg', 'smash.gg'].includes(hostname)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  const tournamentIndex = segments.indexOf('tournament');
  const slug = segments[tournamentIndex + 1];
  return tournamentIndex >= 0 && slug ? `tournament/${slug}` : null;
}

function parsePoints(cell: Cell) {
  const value = cellValue(cell);
  const points = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isInteger(points) && points >= 0 ? points : null;
}

function sameRecord(left: TournamentTierRecord, right: TournamentTierRecord) {
  return (
    left.startggUrl === right.startggUrl &&
    left.tierPoints === right.tierPoints &&
    left.tier === right.tier
  );
}

export function parseTournamentTierWorksheet(worksheet: Worksheet): ParsedTournamentTiers {
  const { headerRowNumber, columns } = findColumns(worksheet);
  const records = new Map<string, TournamentTierRecord>();
  const conflictedSlugs = new Set<string>();
  const unsupportedLinks: string[] = [];
  const rejected: RejectedTournamentTierRow[] = [];
  let rowsRead = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const link = cellText(row.getCell(columns.link));
    const tier = cellText(row.getCell(columns.tier)).toUpperCase();
    if (!link) continue;

    rowsRead += 1;
    const slug = normalizeStartggSlug(link);
    if (!slug) {
      unsupportedLinks.push(link);
      continue;
    }

    const tierPoints = parsePoints(row.getCell(columns.points));
    if (tierPoints === null) {
      rejected.push({ rowNumber, reason: 'Points debe ser un entero no negativo.' });
      continue;
    }
    if (!tier) {
      rejected.push({ rowNumber, reason: 'Tier no puede estar vacío.' });
      continue;
    }

    const record = { rowNumber, slug, startggUrl: link, tierPoints, tier };
    const existing = records.get(slug);
    if (existing && !sameRecord(existing, record)) {
      conflictedSlugs.add(slug);
      records.delete(slug);
      rejected.push({
        rowNumber,
        reason: `Datos contradictorios para ${slug} (primera fila: ${existing.rowNumber}).`,
      });
      continue;
    }
    if (!existing && !conflictedSlugs.has(slug)) records.set(slug, record);
  }

  return { rowsRead, records: [...records.values()], unsupportedLinks, rejected };
}

export async function readTournamentTierWorkbook(filePath: string, sheetName = 'Index') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) throw new Error(`No existe la hoja ${sheetName}.`);
  return parseTournamentTierWorksheet(worksheet);
}
