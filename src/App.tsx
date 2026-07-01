import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeftRight, GamepadIcon } from 'lucide-react';
import { HeadToHead } from './components/HeadToHead';
import { PlayerSearch } from './components/PlayerSearch';
import { PlayerStats } from './components/PlayerStats';
import { hasConfiguredApiKey } from './lib/api';
import { DEFAULT_SMASH_GAME_ID, SMASH_GAMES } from './lib/smash';
import { PlayerSummary } from './lib/types';

const queryClient = new QueryClient();
const RECENT_PLAYERS_STORAGE_KEY = 'startgg-smash-recent-players';
const MAX_RECENT_PLAYERS = 6;

function readRecentPlayers() {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(RECENT_PLAYERS_STORAGE_KEY);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue) as PlayerSummary[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function mergeRecentPlayers(
  currentPlayers: PlayerSummary[],
  nextPlayer: PlayerSummary | null
) {
  if (!nextPlayer) return currentPlayers;

  const dedupedPlayers = currentPlayers.filter((player) => player.id !== nextPlayer.id);
  return [nextPlayer, ...dedupedPlayers].slice(0, MAX_RECENT_PLAYERS);
}

function App() {
  const [selectedPlayer1, setSelectedPlayer1] = useState<PlayerSummary | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<PlayerSummary | null>(null);
  const [mode, setMode] = useState<'stats' | 'headToHead'>('stats');
  const [selectedGameId, setSelectedGameId] = useState<number>(DEFAULT_SMASH_GAME_ID);
  const [recentPlayers, setRecentPlayers] = useState<PlayerSummary[]>(() => readRecentPlayers());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      RECENT_PLAYERS_STORAGE_KEY,
      JSON.stringify(recentPlayers)
    );
  }, [recentPlayers]);

  function handlePlayer1Select(player: PlayerSummary) {
    setSelectedPlayer1(player);
    setRecentPlayers((currentPlayers) => mergeRecentPlayers(currentPlayers, player));
  }

  function handlePlayer2Select(player: PlayerSummary) {
    setSelectedPlayer2(player);
    setRecentPlayers((currentPlayers) => mergeRecentPlayers(currentPlayers, player));
  }

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
                Fase 2
              </div>
              <h2 className="text-2xl font-bold">Alineado con el schema real de Start.gg</h2>
              <p className="mt-2 text-sm text-slate-100">
                Esta iteración usa los campos reales del API alpha para rankings, standings y
                sets, y añade filtro explícito por juego de Smash.
              </p>
              <p className="mt-2 text-sm text-cyan-100">
                La API alpha actual no permite buscar por gamerTag de forma oficial, así que esta
                versión combina resolución oficial por `playerId`/`user slug` con búsqueda por
                nombre apoyada en perfiles públicos de Start.gg.
              </p>
            </div>
          </section>

          {!hasConfiguredApiKey && (
            <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-amber-900 shadow-sm">
              Falta configurar `VITE_STARTGG_API_KEY` en `.env`. Sin esa key la app no puede
              consultar datos en vivo de Start.gg.
            </section>
          )}

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-800">Juego Smash</div>
            <div className="flex flex-wrap gap-3">
              {SMASH_GAMES.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGameId(game.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedGameId === game.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {game.label}
                </button>
              ))}
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-800">Cómo resolver jugadores</div>
            <div className="mt-2 text-sm text-slate-600">
              Puedes escribir el nombre del jugador para ver candidatos, o bien usar directamente
              su `playerId`, `user slug` o la URL completa del perfil. Si la key pertenece a tu
              cuenta, también puedes usar el botón `Usar mi perfil`.
            </div>
          </section>

          {mode === 'stats' ? (
            <div className="space-y-8">
              <PlayerSearch
                label="Resolver jugador de Smash"
                selectedPlayer={selectedPlayer1}
                onPlayerSelect={handlePlayer1Select}
                onClearSelection={() => setSelectedPlayer1(null)}
                recentPlayers={recentPlayers}
              />
              {selectedPlayer1 && (
                <PlayerStats
                  playerId={selectedPlayer1.id}
                  videogameId={selectedGameId}
                />
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">Jugador 1</h3>
                  <PlayerSearch
                    label="Nombre, player ID o user slug"
                    selectedPlayer={selectedPlayer1}
                    onPlayerSelect={handlePlayer1Select}
                    onClearSelection={() => setSelectedPlayer1(null)}
                    recentPlayers={recentPlayers}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-4">Jugador 2</h3>
                  <PlayerSearch
                    label="Nombre, player ID o user slug"
                    selectedPlayer={selectedPlayer2}
                    onPlayerSelect={handlePlayer2Select}
                    onClearSelection={() => setSelectedPlayer2(null)}
                    recentPlayers={recentPlayers}
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlayer1(selectedPlayer2);
                    setSelectedPlayer2(selectedPlayer1);
                  }}
                  disabled={!selectedPlayer1 || !selectedPlayer2}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Intercambiar jugadores
                </button>
              </div>

              {selectedPlayer1 && selectedPlayer2 && (
                <HeadToHead
                  player1Id={selectedPlayer1.id}
                  player2Id={selectedPlayer2.id}
                  videogameId={selectedGameId}
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
