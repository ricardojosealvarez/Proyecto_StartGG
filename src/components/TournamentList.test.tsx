import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TournamentList } from './TournamentList';

describe('TournamentList', () => {
  it('muestra los filtros de modalidad', () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <TournamentList
          player={{ id: '10', gamerTag: 'Vidad' }}
          videogameId={1386}
          tournamentMode="offline"
          onTournamentModeChange={() => undefined}
          onBack={() => undefined}
        />
      </QueryClientProvider>
    );

    expect(markup).toContain('Todos los torneos del jugador');
    expect(markup).toContain('Vidad');
    expect(markup).toContain('Offline');
    expect(markup).toContain('Online');
    expect(markup).toContain('aria-pressed="true"');
  });
});
