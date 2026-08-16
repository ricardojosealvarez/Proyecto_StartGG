import { describe, expect, it } from 'vitest';
import { parseImportOptions } from './importOptions.ts';

describe('parseImportOptions', () => {
  it('interpreta un intervalo explícito y un límite', () => {
    expect(
      parseImportOptions(['--from=2026-07-01', '--to=2026-07-31', '--max-tournaments=10'])
    ).toEqual({
      from: new Date('2026-07-01T00:00:00.000Z'),
      to: new Date('2026-07-31T23:59:59.999Z'),
      maxTournaments: 10,
    });
  });

  it('permite importar todo el intervalo solicitado', () => {
    expect(
      parseImportOptions(['--max-tournaments=all'], new Date('2026-08-13T12:00:00Z')).maxTournaments
    ).toBeUndefined();
  });

  it('rechaza límites inválidos', () => {
    expect(() => parseImportOptions(['--max-tournaments=0'])).toThrow(
      '`--max-tournaments` debe ser un entero positivo o `all`.'
    );
  });
});
