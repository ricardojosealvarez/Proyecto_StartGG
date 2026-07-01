import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlayerSearch } from './components/PlayerSearch';
import { PlayerStats } from './components/PlayerStats';
import { HeadToHead } from './components/HeadToHead';
import { GamepadIcon } from 'lucide-react';
import { PlayerSummary } from './lib/types';

const queryClient = new QueryClient();

function App() {
  const [selectedPlayer1, setSelectedPlayer1] = useState<PlayerSummary | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<PlayerSummary | null>(null);
  const [mode, setMode] = useState<'stats' | 'headToHead'>('stats');

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <GamepadIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Smash Start.gg Stats</h1>
                  <p className="text-sm text-gray-600">
                    MVP centrado en jugadores de Super Smash Bros. con datos de Start.gg.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setMode('stats')}
                  className={`px-4 py-2 rounded-lg ${
                    mode === 'stats'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Estadísticas
                </button>
                <button
                  onClick={() => setMode('headToHead')}
                  className={`px-4 py-2 rounded-lg ${
                    mode === 'headToHead'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Head to Head
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <section className="mb-8 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 px-6 py-6 text-white shadow-lg">
            <div className="max-w-3xl">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Fase 1
              </div>
              <h2 className="text-2xl font-bold">Base más clara y más estable para Smash</h2>
              <p className="mt-2 text-sm text-slate-100">
                Esta primera iteración prioriza búsqueda más clara, manejo de errores y un
                flujo de comparación más robusto para seguir sets entre jugadores.
              </p>
            </div>
          </section>

          {mode === 'stats' ? (
            <div className="space-y-8">
              <PlayerSearch
                label="Buscar jugador de Smash"
                selectedPlayer={selectedPlayer1}
                onPlayerSelect={setSelectedPlayer1}
                onClearSelection={() => setSelectedPlayer1(null)}
              />
              {selectedPlayer1 && <PlayerStats playerId={selectedPlayer1.id} />}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">Jugador 1</h3>
                  <PlayerSearch
                    label="Tag del jugador 1"
                    selectedPlayer={selectedPlayer1}
                    onPlayerSelect={setSelectedPlayer1}
                    onClearSelection={() => setSelectedPlayer1(null)}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Jugador 2</h3>
                  <PlayerSearch
                    label="Tag del jugador 2"
                    selectedPlayer={selectedPlayer2}
                    onPlayerSelect={setSelectedPlayer2}
                    onClearSelection={() => setSelectedPlayer2(null)}
                  />
                </div>
              </div>

              {selectedPlayer1 && selectedPlayer2 && (
                <HeadToHead
                  player1Id={selectedPlayer1.id}
                  player2Id={selectedPlayer2.id}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
