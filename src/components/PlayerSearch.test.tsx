import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PlayerSearchResults } from './PlayerSearch';

describe('PlayerSearchResults', () => {
  it('usa la imagen de perfil de Start.gg y no el banner', () => {
    const markup = renderToStaticMarkup(
      <PlayerSearchResults
        players={[
          {
            id: '1',
            gamerTag: 'Jugador',
            user: {
              images: [
                { type: 'banner', url: 'https://images.start.gg/banner.png' },
                { type: 'profile', url: 'https://images.start.gg/avatar.png' },
              ],
            },
          },
        ]}
        onSelect={vi.fn()}
      />
    );

    expect(markup).toContain('https://images.start.gg/avatar.png');
    expect(markup).not.toContain('https://images.start.gg/banner.png');
  });
});
