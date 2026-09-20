import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerAnalytics } from './PlayerAnalytics';

describe('PlayerAnalytics', () => {
  it('mantiene el acceso de vuelta al perfil', () => {
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <PlayerAnalytics
          player={{ id: '10', gamerTag: 'Vidad' }}
          videogameId={1386}
          tournamentMode="online"
          onBack={() => undefined}
        />
      </QueryClientProvider>
    );
    expect(markup).toContain('Volver al perfil');
    expect(markup).toContain('Estadísticas del jugador');
    expect(markup).toContain('Online');
  });
});
