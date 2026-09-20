import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PlayerProfileHeader } from './PlayerProfileHeader';

describe('PlayerProfileHeader', () => {
  it('muestra la identidad, el personaje principal y las acciones', () => {
    const markup = renderToStaticMarkup(
      <PlayerProfileHeader
        player={{ id: '1', gamerTag: 'Vidad', user: { images: [], bio: 'Jugador' } }}
        videogameId={1386}
        characterStats={{
          primaryCharacter: {
            characterId: '1',
            name: 'R.O.B.',
            imageUrl: null,
            games: 10,
            usage: 0.9,
          },
          secondaryCharacters: [
            {
              characterId: '2',
              name: 'Joker',
              imageUrl: null,
              games: 2,
              usage: 0.2,
            },
          ],
          characterUsage: [],
          gamesWithCharacterData: 10,
          gamesAnalyzed: 10,
          characterDataCoverage: 1,
          characterConfidence: 'high',
        }}
        isLoadingCharacterStats={false}
        rankings={[{ title: 'Global', rank: 12 }]}
        onOpenAnalytics={vi.fn()}
        onRefresh={vi.fn()}
        isRefreshing={false}
      />
    );

    expect(markup).toContain('Información del jugador');
    expect(markup).toContain('Vidad');
    expect(markup).toContain('R.O.B.');
    expect(markup).toContain('Joker');
    expect(markup).toContain('Personaje complementario');
    expect(markup).toContain('Ver estadísticas');
    expect(markup).toContain('Actualizar');
    expect(markup).toContain('Global');
    expect(markup).toContain('#12');
  });
});
