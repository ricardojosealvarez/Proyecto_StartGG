import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerCharacterStats } from '../lib/types';
import { PlayerCharacterSummary } from './PlayerStats';

const baseStats: PlayerCharacterStats = {
  primaryCharacter: {
    characterId: '155',
    name: 'Byleth',
    imageUrl: 'https://images.start.gg/byleth.png',
    games: 4,
    usage: 0.8,
  },
  secondaryCharacters: [],
  characterUsage: [],
  gamesWithCharacterData: 4,
  gamesAnalyzed: 10,
  characterDataCoverage: 0.4,
  characterConfidence: 'low',
};

describe('PlayerCharacterSummary', () => {
  it('avisa cuando la estimación tiene pocos datos', () => {
    const markup = renderToStaticMarkup(<PlayerCharacterSummary stats={baseStats} />);

    expect(markup).toContain('Más utilizado · datos limitados');
    expect(markup).toContain('Byleth · 80 %');
    expect(markup).toContain('4 · 40 %');
  });

  it('muestra los personajes complementarios necesarios', () => {
    const markup = renderToStaticMarkup(
      <PlayerCharacterSummary
        stats={{
          ...baseStats,
          primaryCharacter: { ...baseStats.primaryCharacter!, usage: 0.4 },
          secondaryCharacters: [
            {
              characterId: '62',
              name: 'Joker',
              imageUrl: null,
              games: 3,
              usage: 0.3,
            },
          ],
        }}
      />
    );

    expect(markup).toContain('Byleth · 40 %');
    expect(markup).toContain('Joker · 30 %');
    expect(markup).toContain('Personaje complementario');
  });

  it('no inventa un personaje cuando no hay datos', () => {
    const markup = renderToStaticMarkup(
      <PlayerCharacterSummary
        stats={{
          ...baseStats,
          primaryCharacter: null,
          gamesWithCharacterData: 0,
          characterDataCoverage: 0,
          characterConfidence: 'none',
        }}
      />
    );

    expect(markup).toContain('Personaje principal no disponible.');
  });
});
