import { describe, expect, it } from 'vitest';
import {
  isCharacterBackfillRateLimit,
  parseCharacterBackfillOptions,
} from './characterBackfillOptions.ts';

describe('parseCharacterBackfillOptions', () => {
  it('limita por defecto la carga a 25 jugadores', () => {
    expect(parseCharacterBackfillOptions([])).toEqual({ maxPlayers: 25 });
  });

  it('acepta un lote conservador menor', () => {
    expect(parseCharacterBackfillOptions(['--max-players=5'])).toEqual({ maxPlayers: 5 });
  });

  it('rechaza lotes superiores a 25', () => {
    expect(() => parseCharacterBackfillOptions(['--max-players=26'])).toThrow(
      '`--max-players` debe ser un entero entre 1 y 25.'
    );
  });

  it('trata la respuesta HTML del límite como parada conservadora', () => {
    expect(
      isCharacterBackfillRateLimit(
        new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`)
      )
    ).toBe(true);
  });
});
