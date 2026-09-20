import { useEffect, useState } from 'react';
import { useMutation, useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeftRight, Gamepad2 } from 'lucide-react';
import { HeadToHead } from './components/HeadToHead';
import { PlayerSearch } from './components/PlayerSearch';
import { PlayerPrediction } from './components/PlayerPrediction';
import { PlayerStats } from './components/PlayerStats';
import { PlayerAnalytics } from './components/PlayerAnalytics';
import { TournamentList } from './components/TournamentList';
import {
  getPlayerCharacterStats,
  getPlayerStatsQuery,
  hasConfiguredApiKey,
  normalizeStartggUserSlug,
  refreshPlayerHistory,
  requestStartgg,
} from './lib/api';
import { DEFAULT_SMASH_GAME_ID, SMASH_GAMES } from './lib/smash';
import type { PlayerStatsResponse, PlayerSummary } from './lib/types';
import type { TournamentMode } from './lib/tournamentMode';
import { PlayerProfileHeader } from './components/PlayerProfileHeader';

const appQueryClient = new QueryClient();
const RECENT_PLAYERS_STORAGE_KEY = 'startgg-smash-recent-players';
const MAX_RECENT_PLAYERS = 6;

function readRecentPlayers() {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(RECENT_PLAYERS_STORAGE_KEY);
    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue) as PlayerSummary[];
    return Array.isArray(parsedValue)
      ? parsedValue.map((player) => ({
          ...player,
          user: player.user
            ? {
                ...player.user,
                slug: normalizeStartggUserSlug(player.user.slug),
              }
            : player.user,
        }))
      : [];
  } catch {
    return [];
  }
}

function mergeRecentPlayers(currentPlayers: PlayerSummary[], nextPlayer: PlayerSummary | null) {
  if (!nextPlayer) return currentPlayers;

  const dedupedPlayers = currentPlayers.filter((player) => player.id !== nextPlayer.id);
  return [nextPlayer, ...dedupedPlayers].slice(0, MAX_RECENT_PLAYERS);
}

function AppContent() {
  const [selectedPlayer1, setSelectedPlayer1] = useState<PlayerSummary | null>(null);
  const [selectedPlayer2, setSelectedPlayer2] = useState<PlayerSummary | null>(null);
  const [mode, setMode] = useState<'stats' | 'analytics' | 'tournaments' | 'headToHead'>('stats');
  const [selectedGameId, setSelectedGameId] = useState<number>(DEFAULT_SMASH_GAME_ID);
  const [tournamentMode, setTournamentMode] = useState<TournamentMode>('all');
  const [recentPlayers, setRecentPlayers] = useState<PlayerSummary[]>(() => readRecentPlayers());
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const { data: selectedCharacterStats, isLoading: isLoadingCharacterStats } = useQuery({
    queryKey: ['playerCharacters', selectedPlayer1?.id, selectedGameId],
    queryFn: () => getPlayerCharacterStats(selectedPlayer1!.id, selectedGameId),
    enabled: Boolean(selectedPlayer1) && mode === 'stats',
  });
  const { data: selectedPlayerStats, isLoading: isLoadingSelectedPlayerStats } =
    useQuery<PlayerStatsResponse>({
      queryKey: ['player', selectedPlayer1?.id, selectedGameId],
      queryFn: () =>
        requestStartgg<PlayerStatsResponse>(getPlayerStatsQuery, {
          playerId: selectedPlayer1!.id,
          videogameId: selectedGameId,
        }),
      enabled: Boolean(selectedPlayer1) && mode === 'stats',
    });
  const refreshMutation = useMutation({
    mutationFn: (player: PlayerSummary) => refreshPlayerHistory(player.id),
    onSuccess: (data, player) => {
      setRefreshNotice(
        `Actualización finalizada para ${player.gamerTag}: ${data.tournamentsSaved} torneos y ${data.setsSaved} sets sincronizados.`
      );
      void Promise.all([
        appQueryClient.invalidateQueries({ queryKey: ['player', player.id] }),
        appQueryClient.invalidateQueries({ queryKey: ['playerCharacters', player.id] }),
        appQueryClient.invalidateQueries({ queryKey: ['playerAnalytics', player.id] }),
        appQueryClient.invalidateQueries({ queryKey: ['tournaments', player.id] }),
        appQueryClient.invalidateQueries({ queryKey: ['playerPrediction', player.id] }),
        appQueryClient.invalidateQueries({ queryKey: ['localHeadToHead'] }),
      ]);
    },
    onError: (error, player) => {
      setRefreshNotice(
        `Actualización finalizada para ${player.gamerTag} con error: ${
          error instanceof Error ? error.message : 'no se pudo completar.'
        }`
      );
    },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_PLAYERS_STORAGE_KEY, JSON.stringify(recentPlayers));
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
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container app-header__inner">
          <div className="app-brand">
            <div className="app-brand__mark">
              <Gamepad2 />
            </div>
            <div>
              <h1>SmashRate</h1>
              <p>Competitive player intelligence</p>
            </div>
          </div>
          <nav className="app-nav" aria-label="Vistas principales">
            <button
              onClick={() => setMode('stats')}
              className={mode === 'stats' ? 'is-active' : undefined}
            >
              Player Profile
            </button>
            <button
              onClick={() => setMode('headToHead')}
              className={mode === 'headToHead' ? 'is-active' : undefined}
            >
              Head to Head
            </button>
          </nav>
        </div>
      </header>

      <main className="app-container app-main">
        {!hasConfiguredApiKey && (
          <section className="app-alert app-alert--warning">
            Falta configurar `VITE_STARTGG_API_KEY` en `.env`. Sin esa key la app no puede consultar
            datos en vivo de Start.gg.
          </section>
        )}

        <section className="app-toolbar">
          <div>
            <div className="ui-eyebrow">Base de datos</div>
            <div className="app-toolbar__title">Selecciona un juego</div>
          </div>
          <div className="app-game-picker">
            {SMASH_GAMES.map((game) => (
              <button
                key={game.id}
                type="button"
                onClick={() => setSelectedGameId(game.id)}
                className={selectedGameId === game.id ? 'is-active' : undefined}
              >
                {game.label}
              </button>
            ))}
          </div>
        </section>
        {refreshNotice && (
          <div className="ui-refresh-status" role="status">
            {refreshNotice}
          </div>
        )}

        {mode === 'tournaments' && selectedPlayer1 ? (
          <TournamentList
            player={selectedPlayer1}
            videogameId={selectedGameId}
            tournamentMode={tournamentMode}
            onTournamentModeChange={setTournamentMode}
            onBack={() => setMode('stats')}
          />
        ) : mode === 'analytics' && selectedPlayer1 ? (
          <PlayerAnalytics
            player={selectedPlayer1}
            videogameId={selectedGameId}
            tournamentMode={tournamentMode}
            onBack={() => setMode('stats')}
          />
        ) : mode === 'stats' ? (
          <div className="app-page-grid">
            <aside className="app-sidebar">
              {selectedPlayer1 && (
                <PlayerProfileHeader
                  player={selectedPlayer1}
                  videogameId={selectedGameId}
                  characterStats={selectedCharacterStats}
                  isLoadingCharacterStats={isLoadingCharacterStats}
                  rankings={selectedPlayerStats?.player?.rankings}
                  isLoadingRankings={isLoadingSelectedPlayerStats}
                  onOpenAnalytics={() => setMode('analytics')}
                  onRefresh={() => {
                    if (selectedPlayer1 && !refreshMutation.isPending) {
                      refreshMutation.mutate(selectedPlayer1);
                    }
                  }}
                  isRefreshing={refreshMutation.isPending}
                  canRefresh={selectedGameId === DEFAULT_SMASH_GAME_ID}
                  refreshData={refreshMutation.data}
                  refreshError={refreshMutation.error}
                />
              )}
              <PlayerSearch
                label="Buscar jugador"
                selectedPlayer={selectedPlayer1}
                onPlayerSelect={handlePlayer1Select}
                onClearSelection={() => setSelectedPlayer1(null)}
                recentPlayers={recentPlayers}
              />
            </aside>
            <div className="app-page-content">
              {selectedPlayer1 ? (
                <>
                  <PlayerStats
                    playerId={selectedPlayer1.id}
                    videogameId={selectedGameId}
                    tournamentMode={tournamentMode}
                    onTournamentModeChange={setTournamentMode}
                    onOpenTournaments={() => setMode('tournaments')}
                  />
                  {selectedGameId === DEFAULT_SMASH_GAME_ID && (
                    <PlayerPrediction playerId={selectedPlayer1.id} />
                  )}
                </>
              ) : (
                <div className="ui-placeholder">Selecciona un jugador para abrir su perfil.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="app-comparison-page">
            <div className="app-comparison-search app-comparison-search--compact">
              <div className="app-comparison-search__player">
                <div className="ui-eyebrow">Competidor A</div>
                <PlayerSearch
                  label="Nombre, player ID o user slug"
                  selectedPlayer={selectedPlayer1}
                  onPlayerSelect={handlePlayer1Select}
                  onClearSelection={() => setSelectedPlayer1(null)}
                  recentPlayers={recentPlayers}
                />
              </div>
              <div className="app-comparison-search__player">
                <div className="ui-eyebrow">Competidor B</div>
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
                className="ui-action-button"
              >
                <ArrowLeftRight className="h-4 w-4" />
                Intercambiar jugadores
              </button>
            </div>

            {selectedPlayer1 && selectedPlayer2 && (
              <>
                <HeadToHead
                  player1Id={selectedPlayer1.id}
                  player2Id={selectedPlayer2.id}
                  videogameId={selectedGameId}
                />
                {selectedGameId === DEFAULT_SMASH_GAME_ID && (
                  <PlayerPrediction playerId={selectedPlayer1.id} opponentId={selectedPlayer2.id} />
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
