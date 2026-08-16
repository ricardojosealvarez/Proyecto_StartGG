import { describe, expect, it } from 'vitest';
import { calculateCharacterStats } from './characterStats.ts';
import type { PlayerCharacterGame } from './characterStats.ts';

function game(gameId: string, characterId?: string, name?: string): PlayerCharacterGame {
  return {
    gameId,
    playerId: 'player-1',
    character: characterId ? { id: characterId, name: name ?? characterId } : null,
  };
}

describe('calculateCharacterStats', () => {
  it('calcula un único personaje', () => {
    const stats = calculateCharacterStats([game('1', '155', 'Byleth'), game('2', '155', 'Byleth')]);

    expect(stats.primaryCharacter).toMatchObject({ name: 'Byleth', games: 2, usage: 1 });
    expect(stats.secondaryCharacters).toEqual([]);
    expect(stats.characterDataCoverage).toBe(1);
  });

  it('no añade secundarios cuando el principal ya cubre al menos el 66 %', () => {
    const games = [
      ...Array.from({ length: 7 }, (_, index) => game(`b-${index}`, '155', 'Byleth')),
      ...Array.from({ length: 3 }, (_, index) => game(`j-${index}`, '62', 'Joker')),
    ];

    const stats = calculateCharacterStats(games);

    expect(stats.primaryCharacter?.name).toBe('Byleth');
    expect(stats.secondaryCharacters).toEqual([]);
  });

  it('añade los personajes necesarios hasta cubrir al menos el 66 %', () => {
    const games = [
      ...Array.from({ length: 4 }, (_, index) => game(`a-${index}`, '1', 'Alpha')),
      ...Array.from({ length: 3 }, (_, index) => game(`b-${index}`, '2', 'Beta')),
      ...Array.from({ length: 2 }, (_, index) => game(`c-${index}`, '3', 'Gamma')),
      game('d-0', '4', 'Delta'),
    ];

    const stats = calculateCharacterStats(games);

    expect(stats.primaryCharacter).toMatchObject({ name: 'Alpha', usage: 0.4 });
    expect(stats.secondaryCharacters).toHaveLength(1);
    expect(stats.secondaryCharacters[0]).toMatchObject({ name: 'Beta', usage: 0.3 });
    expect(
      [stats.primaryCharacter, ...stats.secondaryCharacters].reduce(
        (total, character) => total + (character?.usage ?? 0),
        0
      )
    ).toBeGreaterThanOrEqual(0.66);
  });

  it('refleja cambios de personaje por game', () => {
    const stats = calculateCharacterStats([
      game('1', '155', 'Byleth'),
      game('2', '62', 'Joker'),
      game('3', '155', 'Byleth'),
    ]);

    expect(stats.characterUsage.map(({ name, games }) => ({ name, games }))).toEqual([
      { name: 'Byleth', games: 2 },
      { name: 'Joker', games: 1 },
    ]);
  });

  it('incluye games sin selections solo en el denominador de cobertura', () => {
    const stats = calculateCharacterStats([
      game('1', '155', 'Byleth'),
      game('2'),
      game('3'),
      game('4'),
      game('5'),
    ]);

    expect(stats.gamesAnalyzed).toBe(5);
    expect(stats.gamesWithCharacterData).toBe(1);
    expect(stats.primaryCharacter?.usage).toBe(1);
    expect(stats.characterDataCoverage).toBe(0.2);
    expect(stats.characterConfidence).toBe('low');
  });

  it('devuelve none cuando no hay datos utilizables', () => {
    expect(calculateCharacterStats([])).toMatchObject({
      primaryCharacter: null,
      gamesAnalyzed: 0,
      characterDataCoverage: 0,
      characterConfidence: 'none',
    });
    expect(calculateCharacterStats([game('1')])).toMatchObject({
      primaryCharacter: null,
      gamesAnalyzed: 1,
      characterConfidence: 'none',
    });
  });

  it('elimina selections duplicadas', () => {
    const duplicate = game('1', '155', 'Byleth');
    const stats = calculateCharacterStats([duplicate, duplicate]);

    expect(stats.gamesAnalyzed).toBe(1);
    expect(stats.primaryCharacter?.games).toBe(1);
  });

  it('resuelve empates por characterId ascendente', () => {
    const stats = calculateCharacterStats([game('1', '10', 'Ten'), game('2', '2', 'Two')]);

    expect(stats.characterUsage.map((character) => character.characterId)).toEqual(['2', '10']);
  });
});
